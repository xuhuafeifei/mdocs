/**
 * documents_fts* / *_rowid 访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测 / 事务注入。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type {
  DocumentsFts,
  DocumentsFtsHitRow,
  DocumentsFtsTitle,
} from "../entity/search-index.entity.js";

export type {
  DocumentsFts,
  DocumentsFtsHitRow,
  DocumentsFtsRowid,
  DocumentsFtsTitle,
  DocumentsFtsTitleRowid,
} from "../entity/search-index.entity.js";

/** 删除正文 FTS 条目及其 rowid 映射。 */
export function deleteDocumentsFtsBody(
  documentId: string,
  db?: Database.Database,
): void {
  deleteFtsPair(resolveDb(db), "documents_fts", "documents_fts_rowid", documentId);
}

/** 删除标题 FTS 条目及其 rowid 映射。 */
export function deleteDocumentsFtsTitle(
  documentId: string,
  db?: Database.Database,
): void {
  deleteFtsPair(resolveDb(db), "documents_fts_title", "documents_fts_title_rowid", documentId);
}

/** 插入正文 FTS + rowid 映射；吃完整 DocumentsFts。 */
export function insertDocumentsFtsBody(
  row: DocumentsFts,
  db?: Database.Database,
): void {
  const conn = resolveDb(db);
  const result = conn
    .prepare(
      `INSERT INTO documents_fts(
        content, document_id, display_name, relative_path, domain_id, owner_visitor_id, permission
      ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.content,
      row.document_id,
      row.display_name,
      row.relative_path,
      row.domain_id,
      row.owner_visitor_id,
      row.permission,
    );
  conn
    .prepare(`INSERT INTO documents_fts_rowid(document_id, fts_rowid) VALUES(?, ?)`)
    .run(row.document_id, result.lastInsertRowid);
}

/** 插入标题 FTS + rowid 映射；吃完整 DocumentsFtsTitle。 */
export function insertDocumentsFtsTitle(
  row: DocumentsFtsTitle,
  db?: Database.Database,
): void {
  const conn = resolveDb(db);
  const result = conn
    .prepare(
      `INSERT INTO documents_fts_title(
        title, document_id, display_name, relative_path, domain_id, owner_visitor_id, permission
      ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.title,
      row.document_id,
      row.display_name,
      row.relative_path,
      row.domain_id,
      row.owner_visitor_id,
      row.permission,
    );
  conn
    .prepare(`INSERT INTO documents_fts_title_rowid(document_id, fts_rowid) VALUES(?, ?)`)
    .run(row.document_id, result.lastInsertRowid);
}

/** 标题路 MATCH；失败返回 []。 */
export function matchDocumentsFtsTitle(params: {
  matchQuery: string;
  limit: number;
  domainId?: string;
  db?: Database.Database;
}): DocumentsFtsHitRow[] {
  return matchFts({
    table: "documents_fts_title",
    selectExtra: "",
    ...params,
  });
}

/** 正文路 MATCH（含 content）；失败返回 []。 */
export function matchDocumentsFtsBody(params: {
  matchQuery: string;
  limit: number;
  domainId?: string;
  db?: Database.Database;
}): DocumentsFtsHitRow[] {
  return matchFts({
    table: "documents_fts",
    selectExtra: ", content",
    ...params,
  });
}

function matchFts(params: {
  table: "documents_fts" | "documents_fts_title";
  selectExtra: string;
  matchQuery: string;
  limit: number;
  domainId?: string;
  db?: Database.Database;
}): DocumentsFtsHitRow[] {
  const domainClause = params.domainId ? "AND domain_id = ?" : "";
  const sqlParams: unknown[] = params.domainId
    ? [params.matchQuery, params.domainId, params.limit]
    : [params.matchQuery, params.limit];
  try {
    return resolveDb(params.db)
      .prepare(
        `SELECT document_id, display_name, relative_path, domain_id, owner_visitor_id, permission${params.selectExtra},
                bm25(${params.table}) AS bm25_score
         FROM ${params.table}
         WHERE ${params.table} MATCH ? ${domainClause}
         ORDER BY bm25_score ASC
         LIMIT ?`,
      )
      .all(...sqlParams) as DocumentsFtsHitRow[];
  } catch {
    return [];
  }
}

function deleteFtsPair(
  db: Database.Database,
  ftsTable: "documents_fts" | "documents_fts_title",
  mapTable: "documents_fts_rowid" | "documents_fts_title_rowid",
  documentId: string,
): void {
  const mapRow = db
    .prepare(`SELECT fts_rowid FROM ${mapTable} WHERE document_id = ?`)
    .get(documentId) as { fts_rowid: number } | undefined;
  if (!mapRow) return;
  try {
    db.prepare(`DELETE FROM ${ftsTable} WHERE rowid = ?`).run(mapRow.fts_rowid);
  } catch {
    // 忽略删除失败
  }
  db.prepare(`DELETE FROM ${mapTable} WHERE document_id = ?`).run(documentId);
}
