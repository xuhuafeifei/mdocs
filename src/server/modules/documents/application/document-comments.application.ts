import type Database from "better-sqlite3";
import { DocumentError } from "../../access/access-control.js";
import { findDocumentById } from "../repo/document.repo.js";
import {
  findDocumentCommentById,
  insertDocumentComment,
  listCommentsByDocumentId,
  markDocumentCommentDeleted,
} from "../repo/document-comment.repo.js";
import {
  toDocumentCommentResponse,
  toDocumentComments,
} from "../mapper/document-comment.mapper.js";
import type { DocumentCommentResponse } from "../response/document-comment.response.js";

const REPLY_DEPTH_MESSAGE = "只能回复根评论，不支持更深层级嵌套";
const EMPTY_CONTENT_MESSAGE = "评论内容不能为空";
const CONTENT_TOO_LONG_MESSAGE = "评论内容不能超过 512 个字符";
const MISSING_COMMENT_MESSAGE = "评论不存在";
const DELETE_FORBIDDEN_MESSAGE = "只能删除自己的评论或文档下的评论";

export function listDocumentComments(
  documentId: string,
  db?: Database.Database,
): { comments: DocumentCommentResponse[]; total: number } {
  const comments = listCommentsByDocumentId(documentId, db).map(toDocumentCommentResponse);
  return {
    comments,
    total: comments.filter((comment) => !comment.isDeleted).length,
  };
}

export function createDocumentComment(
  params: {
    documentId: string;
    visitorId: string;
    visitorName: string;
    content: string;
    parentId?: string | null;
    replyToVisitorId?: string | null;
    replyToVisitorName?: string | null;
  },
  db?: Database.Database,
): DocumentCommentResponse {
  if (!params.content.trim()) {
    throw new DocumentError("BAD_REQUEST", EMPTY_CONTENT_MESSAGE, 400);
  }
  if (params.content.length > 512) {
    throw new DocumentError("BAD_REQUEST", CONTENT_TOO_LONG_MESSAGE, 400);
  }

  const parentId = params.parentId ?? null;
  if (parentId) {
    const parent = findDocumentCommentById(parentId, db);
    if (!parent || parent.parent_id != null) {
      throw new DocumentError("BAD_REQUEST", REPLY_DEPTH_MESSAGE, 400);
    }
  }

  const row = toDocumentComments(params);
  insertDocumentComment(row, db);
  return toDocumentCommentResponse(row);
}

export function deleteDocumentComment(
  commentId: string,
  visitorId: string,
  db?: Database.Database,
): { success: boolean } {
  const comment = findDocumentCommentById(commentId, db);
  if (!comment) {
    throw new DocumentError("BAD_REQUEST", MISSING_COMMENT_MESSAGE, 400);
  }

  const doc = findDocumentById(comment.document_id, db);
  const isDocOwner = doc?.owner_visitor_id === visitorId;
  const isCommentAuthor = comment.visitor_id === visitorId;
  if (!isCommentAuthor && !isDocOwner) {
    throw new DocumentError("BAD_REQUEST", DELETE_FORBIDDEN_MESSAGE, 400);
  }

  const success = markDocumentCommentDeleted(commentId, new Date().toISOString(), db);
  return { success };
}
