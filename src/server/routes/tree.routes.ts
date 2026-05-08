import { Router, type Request, type Response } from "express";
import { buildDocumentTree } from "../documents/tree.service.js";

/**
 * 构建文档树路由。
 * 提供 GET / 接口，用于返回指定域的文档目录树。
 * @returns Express Router 实例
 */
export function buildTreeRouter(): Router {
  const router = Router();

  /**
   * GET /
   * 查询参数：domainId（可选）
   * 返回当前访客在指定域下可见的文档目录树。
   */
  router.get("/", (req: Request, res: Response) => {
    // 从查询参数中提取域ID
    const domainId = typeof req.query.domainId === "string" ? req.query.domainId : undefined;
    // 获取当前已认证访客的ID（未登录则为 null）
    const visitorId = req.visitor?.visitor_id ?? null;
    // 构建并返回目录树
    res.json({ data: buildDocumentTree(domainId, visitorId) });
  });

  return router;
}
