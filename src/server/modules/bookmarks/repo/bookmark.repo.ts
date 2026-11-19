/**
 * document_bookmarks 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 * 入参/返回均为表实体或查询 Row；不做 HTTP 映射。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type {
  DocumentBookmarks,
  DocumentBookmarksListRow,
} from "../entity/bookmark.entity.js";

export type {
  DocumentBookmarks,
  DocumentBookmarksListRow,
} from "../entity/bookmark.entity.js";

/** 插入收藏；已存在则忽略。 */
export function insertBookmark(
  input: DocumentBookmarks,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT OR IGNORE INTO document_bookmarks (visitor_id, document_id, created_at)
       VALUES (?, ?, ?)`,
    )
    .run(input.visitor_id, input.document_id, input.created_at);
}

export function deleteBookmark(
  visitorId: string,
  documentId: string,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `DELETE FROM document_bookmarks WHERE visitor_id = ? AND document_id = ?`,
    )
    .run(visitorId, documentId);
}

export function isBookmarked(
  visitorId: string,
  documentId: string,
  db?: Database.Database,
): boolean {
  const row = resolveDb(db)
    .prepare<[string, string], { c: number }>(
      `SELECT COUNT(*) as c FROM document_bookmarks WHERE visitor_id = ? AND document_id = ?`,
    )
    .get(visitorId, documentId);
  return (row?.c ?? 0) > 0;
}

/** 当前访客收藏列表（JOIN 文档与创建者名；文档已删则 domain_id 等为 null）。 */
export function listBookmarksByVisitor(
  visitorId: string,
  db?: Database.Database,
): DocumentBookmarksListRow[] {
  return resolveDb(db)
    .prepare<string, DocumentBookmarksListRow>(
      `SELECT
        b.document_id,
        b.created_at AS bookmarked_at,
        d.domain_id,
        d.relative_path,
        d.display_name,
        d.owner_visitor_id,
        v.visitor_name AS owner_visitor_name,
        d.permission,
        d.created_at
       FROM document_bookmarks b
       LEFT JOIN documents d ON b.document_id = d.document_id
       LEFT JOIN visitors v ON d.owner_visitor_id = v.visitor_id
       WHERE b.visitor_id = ?
       ORDER BY b.created_at DESC`,
    )
    .all(visitorId);
}
