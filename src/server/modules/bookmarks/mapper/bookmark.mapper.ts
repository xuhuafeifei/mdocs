import type { DocumentBookmarksListRow } from "../entity/bookmark.entity.js";
import type { BookmarkResponse } from "../response/bookmark.response.js";

/** Row → Response（蛇形投影 → 驼峰出参）。 */
export function toBookmarkResponse(row: DocumentBookmarksListRow): BookmarkResponse {
  return {
    documentId: row.document_id,
    domainId: row.domain_id,
    relativePath: row.relative_path,
    displayName: row.display_name,
    ownerVisitorId: row.owner_visitor_id,
    ownerVisitorName: row.owner_visitor_name,
    permission: row.permission,
    createdAt: row.created_at,
    bookmarkedAt: row.bookmarked_at,
    isDeleted: row.domain_id == null,
  };
}
