import { Router, type Request, type Response } from "express";
import { documentCommentService } from "../documents/document-comment.service.js";

export const documentCommentsRouter = Router();

/** 获取文档评论列表 */
documentCommentsRouter.get("/:documentId/comments", async (req: Request, res: Response) => {
  const { documentId } = req.params;

  if (!documentId) {
    return res.status(400).json({ error: "缺少 documentId" });
  }

  try {
    const comments = await documentCommentService.getCommentsByDocumentId(documentId);
    res.json({
      data: {
        comments,
        total: comments.filter((c) => !c.isDeleted).length,
      },
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/** 发表评论 */
documentCommentsRouter.post("/:documentId/comments", async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const { content, parentId, replyToVisitorId, replyToVisitorName } = req.body;

  if (!documentId) {
    return res.status(400).json({ error: "缺少 documentId" });
  }

  if (!req.visitor) {
    return res.status(401).json({ error: "请先登录" });
  }

  try {
    const comment = await documentCommentService.createComment({
      documentId,
      visitorId: req.visitor.visitor_id,
      visitorName: req.visitor.visitor_name,
      parentId: parentId || null,
      replyToVisitorId: replyToVisitorId || null,
      replyToVisitorName: replyToVisitorName || null,
      content,
    });

    res.json({ data: comment });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/** 删除评论 */
documentCommentsRouter.delete("/:documentId/comments/:commentId", async (req: Request, res: Response) => {
  const { commentId } = req.params;

  if (!commentId) {
    return res.status(400).json({ error: "缺少 commentId" });
  }

  if (!req.visitor) {
    return res.status(401).json({ error: "请先登录" });
  }

  try {
    const success = await documentCommentService.deleteComment(commentId, req.visitor.visitor_id);
    res.json({ data: { success } });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
