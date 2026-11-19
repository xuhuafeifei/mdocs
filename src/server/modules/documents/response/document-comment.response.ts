/** 文档评论出参（驼峰，与现有 HTTP JSON 一致）。 */
export type DocumentCommentResponse = {
  commentId: string;
  documentId: string;
  visitorId: string;
  visitorName: string;
  parentId: string | null;
  replyToVisitorId: string | null;
  replyToVisitorName: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};
