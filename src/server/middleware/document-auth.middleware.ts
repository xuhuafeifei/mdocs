import type { Request, Response, NextFunction } from "express";
import { assertDocumentAccess, assertDocumentOwner, DocumentError } from "../access/access-control.js";

/**
 * 创建文档访问权限校验中间件。
 *
 * 返回一个 Express 中间件函数，该函数会：
 * 1. 从路由参数 `req.params.documentId` 中提取文档 ID。
 * 2. 从请求上下文 `req.visitor` 中提取当前访客 ID（未登录则为 null）。
 * 3. 调用核心鉴权函数 `assertDocumentAccess` 判断访客能否对文档执行指定操作。
 * 4. 鉴权通过则调用 `next()` 进入后续中间件/路由处理器。
 * 5. 鉴权失败则返回对应的 HTTP 错误（404 文档不存在 / 403 无权访问）。
 *
 * @param action - 要校验的操作类型："read"（读取）、"edit"（编辑）、"delete"（删除）
 * @returns Express 中间件函数
 */
export function requireDocumentAccess(action: "read" | "edit" | "delete") {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 从 Express 路由参数中取出文档 ID（如 /api/documents/:documentId）
    const documentId = req.params.documentId;
    // 如果路由里没有 documentId 参数，说明是路由配置错误，返回 400
    if (!documentId) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "documentId is required" } });
      return;
    }
    // 从请求上下文中取当前访客 ID：authMiddleware 之前会把解析成功的访客挂在 req.visitor 上
    // 如果访客未登录（如公开域的读请求可能不强制登录），则为 null
    const visitorId = req.visitor?.visitor_id ?? null;
    try {
      // 调用统一访问控制模块的核心鉴权函数
      // 该函数内部会查文档 → 查域 → 根据域类型和文档权限值判断访客是否有权执行 action
      assertDocumentAccess(documentId, visitorId, action);
      // 鉴权通过，放行到下一个中间件或路由处理函数
      next();
    } catch (err) {
      // 如果是已知的业务权限异常，按异常里指定的状态码返回 JSON 错误
      if (err instanceof DocumentError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      // 其他未预料的异常（如数据库连接失败），交给 Express 的错误处理中间件
      next(err);
    }
  };
}

/**
 * 仅文档创建者可通过（用于 invites 路由）。需先通过 auth，挂好 req.visitor。
 */
export function requireDocumentOwner(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const documentId = req.params.documentId;
    if (!documentId) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "documentId is required" } });
      return;
    }
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    try {
      assertDocumentOwner(documentId, req.visitor.visitor_id);
      next();
    } catch (err) {
      if (err instanceof DocumentError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      next(err);
    }
  };
}
