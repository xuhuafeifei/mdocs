/**
 * 语义索引管理：列表（含上次构建时间）+ 按文档勾选重建。
 */
import { getDb } from "../db/connection.js";
import { findDomainById, isDomainMember, listDomains } from "../db/repositories/domain.repo.js";
import type { DocumentRow } from "../db/repositories/document.repo.js";
import { canReadDocument, type DomainAccessInfo } from "../access/access-control.js";
import { resolveDomainAccess } from "../access/domain-access.js";
import { readDocument } from "../storage/file-store.js";
import { listDomainIdsWithDocumentInviteForVisitor } from "../db/repositories/document.repo.js";
import { useLogger } from "../logger/logger.js";
import { isEmbeddingReady } from "./embedding-model.js";
import { upsertDocumentEmbeddings } from "./embedding-store.js";
import { extractLexicalPlainText } from "./document-index-manager.js";

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

  const documentInviteDomainIds =
    visitorId ? new Set(listDomainIdsWithDocumentInviteForVisitor(db, visitorId)) : undefined;

  const allDomains = listDomains(db);
  const visibleDomains = allDomains.filter(
    (r) =>
      resolveDomainAccess(db, r, r.domain_id, visitorId, { documentInviteDomainIds }).kind !== "none",
  );
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
              d.owner_visitor_id, d.permission, d.updated_at AS document_updated_at,
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
    owner_visitor_id: string;
    permission: number;
    document_updated_at: string;
    chunk_count: number;
    embedding_updated_at: string | null;
  }>;

  const domainCache = new Map<string, DomainAccessInfo>();
  const items: EmbeddingIndexRow[] = [];

  for (const row of rows) {
    let domainInfo = domainCache.get(row.domain_id);
    if (!domainInfo) {
      const domain = findDomainById(db, row.domain_id);
      const domainPermission = domain?.permission ?? "public";
      const isMember = !!(visitorId && domain && isDomainMember(db, row.domain_id, visitorId));
      domainInfo = { domainPermission, isDomainMember: isMember };
      domainCache.set(row.domain_id, domainInfo);
    }

    const docRow: DocumentRow = {
      document_id: row.document_id,
      domain_id: row.domain_id,
      relative_path: row.relative_path,
      display_name: row.display_name,
      owner_visitor_id: row.owner_visitor_id,
      created_by: row.owner_visitor_id,
      updated_by: row.owner_visitor_id,
      content_hash: "",
      head_commit_id: null,
      created_at: "",
      updated_at: row.document_updated_at,
      permission: row.permission,
      file_type: "md",
      parent_id: null,
    };
    if (!canReadDocument(docRow, visitorId, domainInfo)) continue;

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
    for (const id of params.documentIds) {
      failed.push({ documentId: id, reason: "embedding model not ready" });
    }
    return { modelReady, ok, skipped, failed };
  }

  const db = getDb();
  const ids = Array.from(new Set(params.documentIds.filter(Boolean))).slice(0, 100);

  for (const documentId of ids) {
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
        skipped.push(documentId);
        continue;
      }

      const domain = findDomainById(db, row.domain_id);
      const domainPermission = domain?.permission ?? "public";
      const isMember = !!(
        params.visitorId &&
        domain &&
        isDomainMember(db, row.domain_id, params.visitorId)
      );
      const domainInfo: DomainAccessInfo = { domainPermission, isDomainMember: isMember };
      const docRow: DocumentRow = {
        document_id: row.document_id,
        domain_id: row.domain_id,
        relative_path: row.relative_path,
        display_name: row.display_name,
        owner_visitor_id: row.owner_visitor_id,
        created_by: row.owner_visitor_id,
        updated_by: row.owner_visitor_id,
        content_hash: "",
        head_commit_id: null,
        created_at: "",
        updated_at: row.updated_at,
        permission: row.permission,
        file_type: "md",
        parent_id: null,
      };
      if (!canReadDocument(docRow, params.visitorId, domainInfo)) {
        skipped.push(documentId);
        continue;
      }

      const { content } = readDocument(row.domain_id, row.relative_path);
      const plainText = extractLexicalPlainText(content);
      await upsertDocumentEmbeddings({
        documentId,
        domainId: row.domain_id,
        plainText,
      });
      ok.push(documentId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.warn("rebuild embedding failed for %s: %s", documentId, reason);
      failed.push({ documentId, reason });
    }
  }

  return { modelReady, ok, skipped, failed };
}
