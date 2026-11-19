/**
 * document_bookmarks 表实体与查询 Row（蛇形，与 SQL 列对齐）。
 * HTTP 出参见 response/。
 */

/** 表 document_bookmarks */
export interface DocumentBookmarks {
  visitor_id: string;
  document_id: string;
  created_at: string;
}

/**
 * 查询投影：收藏列表 JOIN documents / visitors。
 * bookmarked_at = document_bookmarks.created_at；created_at = documents.created_at。
 */
export interface DocumentBookmarksListRow {
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
