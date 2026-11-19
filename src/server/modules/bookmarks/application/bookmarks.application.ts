import { getDb } from "../../../infra/db/connection.js";
import {
  deleteBookmark,
  insertBookmark,
  isBookmarked,
  listBookmarksByVisitor,
} from "../repo/bookmark.repo.js";
import { toBookmarkResponse } from "../mapper/bookmark.mapper.js";
import type { BookmarkResponse } from "../response/bookmark.response.js";
import { findDocumentById } from "../../documents/repo/document.repo.js";
import {
  DocumentError,
  canReadDocument,
  getDomainInfo,
} from "../../access/access-control.js";

export function listBookmarks(visitorId: string): BookmarkResponse[] {
  const db = getDb();
  const rows = listBookmarksByVisitor(visitorId, db);

  // 过滤掉无权限访问的文档；已删除的收藏保留（方便取消收藏）
  return rows
    .filter((row) => {
      if (row.domain_id == null) return true;
      const doc = findDocumentById(row.document_id, db);
      if (!doc) return true;
      const domainInfo = getDomainInfo(db, doc.domain_id, visitorId);
      return canReadDocument(doc, visitorId, domainInfo);
    })
    .map(toBookmarkResponse);
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
