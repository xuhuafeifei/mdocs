import { Router, type Request, type Response } from "express";
import {
  addBookmark,
  removeBookmark,
  isBookmarked,
  listBookmarksByVisitor,
} from "../db/repositories/bookmark.repo.js";
import { getDb } from "../db/connection.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { canReadDocument, getDomainInfo } from "../access/access-control.js";

/**
 * 构建书签相关路由。
 *
 * 包含以下接口：
 * - GET    /             获取当前访客的所有收藏
 * - GET    /:documentId  检查是否已收藏某文档
 * - POST   /:documentId  添加收藏
 * - DELETE /:documentId  取消收藏
 *
 * @returns Express Router 实例
 */
export function buildBookmarksRouter(): Router {
  const router = Router();

  /**
   * GET /
   * 获取当前访客的所有收藏，按收藏时间倒序排列。
   */
  router.get("/", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    const db = getDb();
    const bookmarks = listBookmarksByVisitor(db, req.visitor.visitor_id);

    // 过滤掉无权限访问的文档，但已删除的收藏保留显示（让用户可以取消收藏）
    const accessibleBookmarks = bookmarks.filter((bookmark) => {
      if (bookmark.isDeleted) return true;
      const doc = findDocumentById(db, bookmark.documentId);
      if (!doc) return true;
      const domainInfo = getDomainInfo(db, doc.domain_id, req.visitor?.visitor_id ?? null);
      return canReadDocument(doc, req.visitor?.visitor_id ?? null, domainInfo);
    });

    res.json({ data: accessibleBookmarks });
  });

  /**
   * GET /:documentId
   * 检查是否已收藏某文档。
   */
  router.get("/:documentId", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    const { documentId } = req.params;
    const db = getDb();

    // 检查文档是否存在且当前访客有读权限
    const doc = findDocumentById(db, documentId);
    if (!doc) {
      res.status(404).json({ error: { code: "DOC_NOT_FOUND", message: "document not found" } });
      return;
    }

    const domainInfo = getDomainInfo(db, doc.domain_id, req.visitor.visitor_id);
    if (!canReadDocument(doc, req.visitor.visitor_id, domainInfo)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "no access" } });
      return;
    }

    const bookmarked = isBookmarked(db, req.visitor.visitor_id, documentId);
    res.json({ data: { bookmarked } });
  });

  /**
   * POST /:documentId
   * 添加收藏。
   */
  router.post("/:documentId", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    const { documentId } = req.params;
    const db = getDb();

    // 检查文档是否存在且当前访客有读权限
    const doc = findDocumentById(db, documentId);
    if (!doc) {
      res.status(404).json({ error: { code: "DOC_NOT_FOUND", message: "document not found" } });
      return;
    }

    const domainInfo = getDomainInfo(db, doc.domain_id, req.visitor.visitor_id);
    if (!canReadDocument(doc, req.visitor.visitor_id, domainInfo)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "no access" } });
      return;
    }

    addBookmark(db, req.visitor.visitor_id, documentId);
    res.json({ data: { success: true } });
  });

  /**
   * DELETE /:documentId
   * 取消收藏。
   */
  router.delete("/:documentId", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    const { documentId } = req.params;
    const db = getDb();

    removeBookmark(db, req.visitor.visitor_id, documentId);
    res.json({ data: { success: true } });
  });

  return router;
}
