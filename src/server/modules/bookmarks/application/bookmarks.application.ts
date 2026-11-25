import {
  deleteBookmark,
  insertBookmark,
  isBookmarked,
  listBookmarksByVisitor,
} from "../repo/bookmark.repo.js";
import { toBookmarkResponse } from "../mapper/bookmark.mapper.js";
import type { BookmarkResponse } from "../response/bookmark.response.js";
import { getDocumentById } from "../../documents/service/document.service.js";
import { assertCanRead, canRead } from "../../access/access.js";
import { DocumentError } from "../../access/access-control.js";

export function listBookmarks(visitorId: string): BookmarkResponse[] {
  const rows = listBookmarksByVisitor(visitorId);

  // 过滤掉无权限访问的文档；已删除的收藏保留（方便取消收藏）
  return rows
    .filter((row) => {
      if (row.domain_id == null) return true;
      const doc = getDocumentById(row.document_id);
      if (!doc) return true;
      return canRead(visitorId, doc.domain_id, doc.document_id);
    })
    .map(toBookmarkResponse);
}

function assertCanReadBookmarkTarget(visitorId: string, documentId: string): void {
  const doc = getDocumentById(documentId);
  if (!doc) {
    throw new DocumentError("DOC_NOT_FOUND", "document not found", 404);
  }
  assertCanRead(visitorId, doc.domain_id, documentId);
}

export function checkBookmarked(visitorId: string, documentId: string) {
  assertCanReadBookmarkTarget(visitorId, documentId);
  return { bookmarked: isBookmarked(visitorId, documentId) };
}

export function addDocumentBookmark(visitorId: string, documentId: string) {
  assertCanReadBookmarkTarget(visitorId, documentId);
  insertBookmark({
    visitor_id: visitorId,
    document_id: documentId,
    created_at: new Date().toISOString(),
  });
  return { success: true };
}

export function removeDocumentBookmark(visitorId: string, documentId: string) {
  deleteBookmark(visitorId, documentId);
  return { success: true };
}
