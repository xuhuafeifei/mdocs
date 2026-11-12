import type Database from "better-sqlite3";

/** 收藏在数据库中的行结构，对应 document_bookmarks 表。 */
export interface BookmarkRow {
  visitor_id: string;
  document_id: string;
  created_at: string;
}

/** 收藏的文档详情，包含文档信息。 */
export interface BookmarkWithDocument {
  documentId: string;
  domainId: string | null;
  relativePath: string | null;
  displayName: string | null;
  ownerVisitorId: string | null;
  ownerVisitorName: string | null;
  permission: number | null;
  createdAt: string | null;
  bookmarkedAt: string;
  isDeleted: boolean;
}

/**
 * 添加收藏。
 *
 * @param db - better-sqlite3 数据库实例
 * @param visitorId - 访客 ID
 * @param documentId - 文档 ID
 */
export function addBookmark(db: Database.Database, visitorId: string, documentId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO document_bookmarks (visitor_id, document_id, created_at)
     VALUES (?, ?, ?)`,
  ).run(visitorId, documentId, now);
}

/**
 * 取消收藏。
 *
 * @param db - better-sqlite3 数据库实例
 * @param visitorId - 访客 ID
 * @param documentId - 文档 ID
 */
export function removeBookmark(db: Database.Database, visitorId: string, documentId: string): void {
  db.prepare(
    `DELETE FROM document_bookmarks WHERE visitor_id = ? AND document_id = ?`,
  ).run(visitorId, documentId);
}

/**
 * 检查是否已收藏。
 *
 * @param db - better-sqlite3 数据库实例
 * @param visitorId - 访客 ID
 * @param documentId - 文档 ID
 * @returns 是否已收藏
 */
export function isBookmarked(db: Database.Database, visitorId: string, documentId: string): boolean {
  const row = db
    .prepare<[string, string], { c: number }>(
      `SELECT COUNT(*) as c FROM document_bookmarks WHERE visitor_id = ? AND document_id = ?`,
    )
    .get(visitorId, documentId);
  return (row?.c ?? 0) > 0;
}

/**
 * 获取指定访客的所有收藏，按收藏时间倒序排列。
 *
 * @param db - better-sqlite3 数据库实例
 * @param visitorId - 访客 ID
 * @returns 收藏的文档列表
 */
/** 收藏查询结果行类型 */
interface BookmarkQueryRow {
  document_id: string;
  bookmarked_at: string;
  domain_id: string | null;
  relative_path: string | null;
  display_name: string | null;
  owner_visitor_id: string | null;
  owner_visitor_name: string | null;
  permission: number | null;
  created_at: string | null;
}

export function listBookmarksByVisitor(db: Database.Database, visitorId: string): BookmarkWithDocument[] {
  const rows = db
    .prepare<string, BookmarkQueryRow>(
      `SELECT
        b.document_id,
        b.created_at as bookmarked_at,
        d.domain_id,
        d.relative_path,
        d.display_name,
        d.owner_visitor_id,
        v.visitor_name as owner_visitor_name,
        d.permission,
        d.created_at
       FROM document_bookmarks b
       LEFT JOIN documents d ON b.document_id = d.document_id
       LEFT JOIN visitors v ON d.owner_visitor_id = v.visitor_id
       WHERE b.visitor_id = ?
       ORDER BY b.created_at DESC`,
    )
    .all(visitorId);

  return rows.map((row) => ({
    documentId: row.document_id,
    domainId: row.domain_id ?? null,
    relativePath: row.relative_path ?? null,
    displayName: row.display_name ?? null,
    ownerVisitorId: row.owner_visitor_id ?? null,
    ownerVisitorName: row.owner_visitor_name ?? null,
    permission: row.permission ?? null,
    createdAt: row.created_at ?? null,
    bookmarkedAt: row.bookmarked_at,
    isDeleted: row.domain_id == null,
  }));
}


