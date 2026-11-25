/**
 * document_embedding_chunks 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测 / 事务注入。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { DocumentEmbeddingChunks } from "../entity/search-index.entity.js";

export type { DocumentEmbeddingChunks } from "../entity/search-index.entity.js";

const COLUMNS = `document_id, domain_id, chunk_index, text, embedding, updated_at`;

export function deleteDocumentEmbeddingChunks(
  documentId: string,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(`DELETE FROM document_embedding_chunks WHERE document_id = ?`)
    .run(documentId);
}

/** 插入完整 Entity（复合主键）。 */
export function insertDocumentEmbeddingChunk(
  row: DocumentEmbeddingChunks,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO document_embedding_chunks (
        document_id, domain_id, chunk_index, text, embedding, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.document_id,
      row.domain_id,
      row.chunk_index,
      row.text,
      row.embedding,
      row.updated_at,
    );
}

/** 列出全部或按域过滤的块（语义近邻扫描）。 */
export function listDocumentEmbeddingChunks(params?: {
  domainId?: string;
  db?: Database.Database;
}): DocumentEmbeddingChunks[] {
  const domainId = params?.domainId;
  if (domainId) {
    return resolveDb(params?.db)
      .prepare<string, DocumentEmbeddingChunks>(
        `SELECT ${COLUMNS} FROM document_embedding_chunks WHERE domain_id = ?`,
      )
      .all(domainId);
  }
  return resolveDb(params?.db)
    .prepare<[], DocumentEmbeddingChunks>(
      `SELECT ${COLUMNS} FROM document_embedding_chunks`,
    )
    .all();
}

/** 该文档是否已有至少一块向量。 */
export function hasDocumentEmbeddingChunks(
  documentId: string,
  db?: Database.Database,
): boolean {
  const row = resolveDb(db)
    .prepare(
      `SELECT 1 AS ok FROM document_embedding_chunks WHERE document_id = ? LIMIT 1`,
    )
    .get(documentId) as { ok: number } | undefined;
  return Boolean(row);
}
