import { getDb } from "../../../infra/db/connection.js";
import {
  addBookmark,
  isBookmarked,
  listBookmarksByVisitor,
  removeBookmark,
} from "../../../infra/db/repositories/bookmark.repo.js";
import { findDocumentById } from "../../documents/repo/document.repo.js";
import {
  DocumentError,
  canReadDocument,
  getDomainInfo,
} from "../../access/access-control.js";

export function listBookmarks(visitorId: string) {
  const db = getDb();
  const bookmarks = listBookmarksByVisitor(db, visitorId);

  // 过滤掉无权限访问的文档；已删除的收藏保留（方便取消收藏）
  return bookmarks.filter((bookmark) => {
    if (bookmark.isDeleted) return true;
    const doc = findDocumentById(bookmark.documentId, db);
    if (!doc) return true;
    const domainInfo = getDomainInfo(db, doc.domain_id, visitorId);
    return canReadDocument(doc, visitorId, domainInfo);
  });
}

function assertCanReadBookmarkTarget(visitorId: string, documentId: string): void {
  const db = getDb();
  const doc = findDocumentById(documentId, db);
  if (!doc) {
    throw new DocumentError("DOC_NOT_FOUND", "document not found", 404);
  }
  const domainInfo = getDomainInfo(db, doc.domain_id, visitorId);
  if (!canReadDocument(doc, visitorId, domainInfo)) {
    throw new DocumentError("FORBIDDEN", "no access", 403);
  }
}

export function checkBookmarked(visitorId: string, documentId: string) {
  assertCanReadBookmarkTarget(visitorId, documentId);
  return { bookmarked: isBookmarked(getDb(), visitorId, documentId) };
}

export function addDocumentBookmark(visitorId: string, documentId: string) {
  assertCanReadBookmarkTarget(visitorId, documentId);
  addBookmark(getDb(), visitorId, documentId);
  return { success: true };
}

export function removeDocumentBookmark(visitorId: string, documentId: string) {
  removeBookmark(getDb(), visitorId, documentId);
  return { success: true };
}
