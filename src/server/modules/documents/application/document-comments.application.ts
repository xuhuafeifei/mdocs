import { DocumentError } from "../../access/access-control.js";
import { documentCommentService } from "../document-comment.service.js";

function asBadRequest(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  throw new DocumentError("BAD_REQUEST", message, 400);
}

export async function listDocumentComments(documentId: string) {
  const comments = await documentCommentService.getCommentsByDocumentId(documentId);
  return {
    comments,
    total: comments.filter((c) => !c.isDeleted).length,
  };
}

export async function createDocumentComment(params: {
  documentId: string;
  visitorId: string;
  visitorName: string;
  content: string;
  parentId?: string | null;
  replyToVisitorId?: string | null;
  replyToVisitorName?: string | null;
}) {
  try {
    return await documentCommentService.createComment({
      documentId: params.documentId,
      visitorId: params.visitorId,
      visitorName: params.visitorName,
      parentId: params.parentId ?? null,
      replyToVisitorId: params.replyToVisitorId ?? null,
      replyToVisitorName: params.replyToVisitorName ?? null,
      content: params.content,
    });
  } catch (err) {
    asBadRequest(err);
  }
}

export async function deleteDocumentComment(commentId: string, visitorId: string) {
  try {
    const success = await documentCommentService.deleteComment(commentId, visitorId);
    return { success };
  } catch (err) {
    asBadRequest(err);
  }
}
