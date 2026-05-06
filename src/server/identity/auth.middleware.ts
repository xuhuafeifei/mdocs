import type { NextFunction, Request, Response } from "express";
import { resolveVisitorByToken } from "./visitor.service.js";

// 无需身份认证即可访问的路径白名单
const EXEMPT_PATHS = new Set<string>([
  "/visitors/register",
  "/health",
]);

/**
 * Express 身份认证中间件。
 * 对非豁免路径要求请求头中携带有效的访客令牌（x-visitor-token）。
 * 若令牌有效，会将对应的访客信息附加到 req.visitor 上。
 *
 * @param req - Express 请求对象
 * @param res - Express 响应对象
 * @param next - 下一个中间件函数
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 对豁免路径仍尝试解析令牌（若有），但不强制要求
  if (EXEMPT_PATHS.has(req.path)) {
    const raw = readToken(req);
    if (raw) {
      const visitor = resolveVisitorByToken(raw);
      // 若令牌有效，将访客信息注入请求对象
      if (visitor) req.visitor = visitor;
    }
    next();
    return;
  }

  // 非豁免路径必须从请求头中读取令牌
  const raw = readToken(req);
  if (!raw) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "missing visitor token" } });
    return;
  }

  // 校验令牌并获取访客记录
  const visitor = resolveVisitorByToken(raw);
  if (!visitor) {
    res.status(401).json({ error: { code: "INVALID_TOKEN", message: "visitor token is not recognised" } });
    return;
  }

  // 认证通过，将访客信息挂载到请求对象供后续处理使用
  req.visitor = visitor;
  next();
}

/**
 * 从请求头中读取访客令牌。
 *
 * @param req - Express 请求对象
 * @returns 读取到的令牌字符串，不存在或为空时返回 null
 */
function readToken(req: Request): string | null {
  const header = req.header("x-visitor-token");
  if (header && header.trim()) return header.trim();
  return null;
}
