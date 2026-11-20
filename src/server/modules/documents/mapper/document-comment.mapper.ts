import { randomUUID } from "crypto";
import type { DocumentComments } from "../entity/document-comment.entity.js";
import type { DocumentCommentResponse } from "../response/document-comment.response.js";

/** 进参 → 待插入的表行。补 comment_id、时间、is_deleted。 */
export function toDocumentComments(input: {
  documentId: string;
  visitorId: string;
  visitorName: string;
  content: string;
  parentId?: string | null;
  replyToVisitorId?: string | null;
  replyToVisitorName?: string | null;
}): DocumentComments {
  const now = new Date().toISOString();
  return {
    comment_id: randomUUID(),
    document_id: input.documentId,
    visitor_id: input.visitorId,
    visitor_name: input.visitorName,
    parent_id: input.parentId ?? null,
    reply_to_visitor_id: input.replyToVisitorId ?? null,
    reply_to_visitor_name: input.replyToVisitorName ?? null,
    content: input.content,
    is_deleted: 0,
    created_at: now,
    updated_at: now,
  };
}

/** Entity → Response（蛇形表行 → 驼峰出参）。 */
export function toDocumentCommentResponse(row: DocumentComments): DocumentCommentResponse {
  return {
    commentId: row.comment_id,
    documentId: row.document_id,
    visitorId: row.visitor_id,
    visitorName: row.visitor_name,
    parentId: row.parent_id,
    replyToVisitorId: row.reply_to_visitor_id,
    replyToVisitorName: row.reply_to_visitor_name,
    content: row.content,
    isDeleted: row.is_deleted !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
