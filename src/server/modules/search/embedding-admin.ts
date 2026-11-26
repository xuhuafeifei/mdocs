/**
 * 语义索引管理：列表（含上次构建时间）+ 按文档勾选重建。
 */
import { getDb } from "../../infra/db/connection";
import { listDomains } from "../domains/service/domain.service.js";
import { canEnterDomains, canRead } from "../access/access";
import { readDocument } from "../../infra/storage/file-store";
import { useLogger } from "../../infra/logger/logger";
import { isEmbeddingReady } from "./embedding-model";
import { upsertDocumentEmbeddings } from "./embedding-store";
import { extractLexicalPlainText } from "./document-index-manager";

const log = useLogger("embedding-admin");

const LIST_LIMIT = 500;

export interface EmbeddingIndexRow {
  documentId: string;
  displayName: string;
  relativePath: string;
  domainId: string;
  domainName: string;
  chunkCount: number;
  /** 语义索引上次构建时间（chunk MAX(updated_at)）；未建则为 null */
  embeddingUpdatedAt: string | null;
  documentUpdatedAt: string;
}

export function listEmbeddingIndex(params: {
  visitorId: string | null;
  domainId?: string;
}): { modelReady: boolean; items: EmbeddingIndexRow[] } {
  const db = getDb();
  const visitorId = params.visitorId;

  const allDomains = listDomains();
  const visibleIds = canEnterDomains(
    visitorId,
    allDomains.map((d) => d.domain_id),
  );
  const visibleDomains = allDomains.filter((r) => visibleIds.has(r.domain_id));
  const domainNameById = new Map(visibleDomains.map((d) => [d.domain_id, d.domain_name]));

  let domainIds = visibleDomains.map((d) => d.domain_id);
  if (params.domainId) {
    if (!domainNameById.has(params.domainId)) {
      return { modelReady: isEmbeddingReady(), items: [] };
    }
    domainIds = [params.domainId];
  }
  if (domainIds.length === 0) {
    return { modelReady: isEmbeddingReady(), items: [] };
  }

  const placeholders = domainIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT d.document_id, d.display_name, d.relative_path, d.domain_id,
              d.updated_at AS document_updated_at,
              COUNT(c.chunk_index) AS chunk_count,
              MAX(c.updated_at) AS embedding_updated_at
       FROM documents d
       LEFT JOIN document_embedding_chunks c ON c.document_id = d.document_id
       WHERE d.file_type = 'md'
         AND d.domain_id IN (${placeholders})
       GROUP BY d.document_id
       ORDER BY d.updated_at DESC
       LIMIT ?`,
    )
    .all(...domainIds, LIST_LIMIT) as Array<{
    document_id: string;
    display_name: string;
    relative_path: string;
    domain_id: string;
    document_updated_at: string;
    chunk_count: number;
    embedding_updated_at: string | null;
  }>;

  const items: EmbeddingIndexRow[] = [];

  for (const row of rows) {
    if (!canRead(visitorId, row.domain_id, row.document_id)) continue;

    items.push({
      documentId: row.document_id,
      displayName: row.display_name,
      relativePath: row.relative_path,
      domainId: row.domain_id,
      domainName: domainNameById.get(row.domain_id) ?? row.domain_id,
      chunkCount: Number(row.chunk_count) || 0,
      embeddingUpdatedAt: row.embedding_updated_at,
      documentUpdatedAt: row.document_updated_at,
    });
  }

  return { modelReady: isEmbeddingReady(), items };
}

/**
 * 对勾选的文档尽力重建语义索引。无读权限的跳过。
 */
export async function rebuildEmbeddingIndex(params: {
  visitorId: string | null;
  documentIds: string[];
}): Promise<{
  modelReady: boolean;
  ok: string[];
  skipped: string[];
  failed: Array<{ documentId: string; reason: string }>;
}> {
  const modelReady = isEmbeddingReady();
  const ok: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ documentId: string; reason: string }> = [];

  if (!modelReady) {
    log.warn("semantic rebuild batch aborted: embedding model not ready");
    for (const id of params.documentIds) {
      failed.push({ documentId: id, reason: "embedding model not ready" });
    }
    return { modelReady, ok, skipped, failed };
  }

  const db = getDb();
  const ids = Array.from(new Set(params.documentIds.filter(Boolean))).slice(0, 100);

  log.info("semantic rebuild batch start: %d document(s)", ids.length);
  const batchT0 = Date.now();

  for (let i = 0; i < ids.length; i++) {
    const documentId = ids[i]!;
    try {
      const row = db
        .prepare(
          `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id, permission, updated_at, file_type
           FROM documents WHERE document_id = ?`,
        )
        .get(documentId) as
        | {
            document_id: string;
            domain_id: string;
            relative_path: string;
            display_name: string;
            owner_visitor_id: string;
            permission: number;
            updated_at: string;
            file_type: string;
          }
        | undefined;

      if (!row || row.file_type !== "md") {
        log.info("semantic rebuild %d/%d skip %s: not md", i + 1, ids.length, documentId);
        skipped.push(documentId);
        continue;
      }

      if (!canRead(params.visitorId, row.domain_id, documentId)) {
        log.info("semantic rebuild %d/%d skip %s: no read access", i + 1, ids.length, row.display_name || documentId);
        skipped.push(documentId);
        continue;
      }

      const label = row.display_name || row.relative_path || documentId;
      log.info("semantic rebuild %d/%d begin %s", i + 1, ids.length, label);
      const { content } = readDocument(row.domain_id, row.relative_path);
      const plainText = extractLexicalPlainText(content);
      await upsertDocumentEmbeddings({
        documentId,
        domainId: row.domain_id,
        plainText,
        label,
      });
      ok.push(documentId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.warn("semantic rebuild %d/%d failed %s: %s", i + 1, ids.length, documentId, reason);
      failed.push({ documentId, reason });
    }
  }

  log.info(
    "semantic rebuild batch done: ok=%d skipped=%d failed=%d (%dms)",
    ok.length,
    skipped.length,
    failed.length,
    Date.now() - batchT0,
  );
  return { modelReady, ok, skipped, failed };
}
