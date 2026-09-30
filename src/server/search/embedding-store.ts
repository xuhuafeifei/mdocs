/**
 * 文档向量块：切块、写入、删除、近邻扫描（纯 SQLite BLOB + JS cosine，无 sqlite-vec 硬依赖）。
 */
import type Database from "better-sqlite3";
import { getDb } from "../db/connection.js";
import { useLogger } from "../logger/logger.js";
import { EMBEDDING_DIM, embedText, isEmbeddingReady } from "./embedding-model.js";

const log = useLogger("embedding-store");

const CHUNK_MAX_CHARS = 500;
const CHUNK_OVERLAP = 50;
const SEMANTIC_TOP_K = 30;

export interface SemanticHit {
  documentId: string;
  domainId: string;
  score: number;
  snippet: string;
}

/** 按字符窗切块，轻微重叠 */
export function chunkPlainText(text: string, maxChars = CHUNK_MAX_CHARS, overlap = CHUNK_OVERLAP): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(cleaned.length, start + maxChars);
    chunks.push(cleaned.slice(start, end));
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

export function float32ToBlob(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

export function blobToFloat32(buf: Buffer): Float32Array {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(ab);
}

/** cosine similarity；零向量返回 0 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function deleteEmbeddingChunks(db: Database.Database, documentId: string): void {
  db.prepare(`DELETE FROM document_embedding_chunks WHERE document_id = ?`).run(documentId);
}

/**
 * 用纯文本重建某文档的全部向量块。模型未就绪时 no-op。
 * 失败只 warn，不抛给调用方。
 */
export async function upsertDocumentEmbeddings(params: {
  documentId: string;
  domainId: string;
  plainText: string;
}): Promise<void> {
  try {
    if (!isEmbeddingReady()) return;

    const chunks = chunkPlainText(params.plainText);
    const db = getDb();
    const now = new Date().toISOString();

    if (chunks.length === 0) {
      deleteEmbeddingChunks(db, params.documentId);
      return;
    }

    const rows: Array<{ index: number; text: string; embedding: Buffer }> = [];
    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i]!;
      const vec = await embedText(text, "document");
      if (!vec) {
        log.warn("skip embedding chunk %s#%d: embed returned null", params.documentId, i);
        return; // 半态不如整篇跳过；下次 dirty/补扫再试
      }
      if (vec.length < EMBEDDING_DIM) {
        log.warn("skip embedding: dim %d < %d", vec.length, EMBEDDING_DIM);
        return;
      }
      rows.push({ index: i, text: text.slice(0, 240), embedding: float32ToBlob(vec) });
    }

    const tx = db.transaction(() => {
      deleteEmbeddingChunks(db, params.documentId);
      const insert = db.prepare(
        `INSERT INTO document_embedding_chunks (document_id, domain_id, chunk_index, text, embedding, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const row of rows) {
        insert.run(params.documentId, params.domainId, row.index, row.text, row.embedding, now);
      }
    });
    tx();
  } catch (err) {
    log.warn(
      "upsertDocumentEmbeddings failed for %s: %s",
      params.documentId,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * 语义近邻：对 query embed 后，扫表算 cosine，按 document 取 max 分。
 * 任一步失败返回 []。
 */
export async function querySemanticNeighbors(params: {
  query: string;
  domainId?: string;
  topK?: number;
}): Promise<SemanticHit[]> {
  try {
    if (!isEmbeddingReady()) return [];

    const qVec = await embedText(params.query, "query");
    if (!qVec) return [];

    const db = getDb();
    const domainClause = params.domainId ? "WHERE domain_id = ?" : "";
    const sqlParams: unknown[] = params.domainId ? [params.domainId] : [];
    const rows = db
      .prepare(
        `SELECT document_id, domain_id, text, embedding
         FROM document_embedding_chunks ${domainClause}`,
      )
      .all(...sqlParams) as Array<{
      document_id: string;
      domain_id: string;
      text: string;
      embedding: Buffer;
    }>;

    if (rows.length === 0) return [];

    const best = new Map<string, SemanticHit>();
    for (const row of rows) {
      let vec: Float32Array;
      try {
        vec = blobToFloat32(row.embedding);
      } catch {
        continue;
      }
      const score = cosineSimilarity(qVec, vec);
      const prev = best.get(row.document_id);
      if (!prev || score > prev.score) {
        best.set(row.document_id, {
          documentId: row.document_id,
          domainId: row.domain_id,
          score,
          snippet: row.text,
        });
      }
    }

    const topK = params.topK ?? SEMANTIC_TOP_K;
    return Array.from(best.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch (err) {
    log.warn(
      "querySemanticNeighbors failed: %s",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}
