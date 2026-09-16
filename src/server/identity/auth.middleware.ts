import type { NextFunction, Request, Response } from "express";
import type { VisitorRow } from "../db/repositories/visitor.repo.js";
import { resolveVisitorByToken } from "./visitor.service.js";
import { resolveCliVisitor } from "./cli-token.service.js";

// 无需身份认证即可访问的路径白名单
const EXEMPT_PATHS = new Set<string>([
  "/visitors/register",
  "/visitors/login",
  "/visitors/recover",
  "/health",
]);

/**
 * Express 身份认证中间件。
 *
 * 支持三种认证方式，按优先级：
 * 1. Cookie（浏览器会话）
 * 2. x-cli-token（外部 Agent）
 * 3. x-visitor-token header（匿名用户/旧前端）
 *
 * 对非豁免路径要求至少携带一种有效的令牌。
 *
 * @param req - Express 请求对象
 * @param res - Express 响应对象
 * @param next - 下一个中间件函数
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 对豁免路径仍尝试解析令牌（若有），但不强制要求
  if (EXEMPT_PATHS.has(req.path)) {
    const visitor = tryResolveVisitor(req);
    if (visitor) req.visitor = visitor;
    next();
    return;
  }

  // 非豁免路径：三种认证方式都不行才拒绝
  const visitor = tryResolveVisitor(req);
  if (!visitor) {
    const hasCookie = !!readCookieToken(req);
    const hasCli = !!readCliToken(req);
    const hasHeader = !!readHeaderToken(req);
    if (!hasCookie && !hasCli && !hasHeader) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "missing visitor token" } });
      return;
    }
    // 提供了 token 但无效
    res.status(401).json({ error: { code: "INVALID_TOKEN", message: "visitor token is not recognised" } });
    return;
  }

  // 认证通过，将访客信息挂载到请求对象
  req.visitor = visitor;
  next();
}

/**
 * 依次尝试三种方式解析访客。
 * 优先级：Cookie > CLI Token > x-visitor-token header
 *
 * @returns 解析到的访客信息，全部失败则返回 null
 */
function tryResolveVisitor(req: Request): VisitorRow | null {
  // 方式一：Cookie（浏览器会话，最稳定）
  const cookieToken = readCookieToken(req);
  if (cookieToken) {
    const visitor = resolveVisitorByToken(cookieToken);
    if (visitor) return visitor;
  }

  // 方式二：CLI token（外部 Agent）
  const cliToken = readCliToken(req);
  if (cliToken) {
    const visitor = resolveCliVisitor(cliToken);
    if (visitor) return visitor;
  }

  // 方式三：x-visitor-token header（匿名用户/旧前端兼容）
  const headerToken = readHeaderToken(req);
  if (headerToken) {
    const visitor = resolveVisitorByToken(headerToken);
    if (visitor) return visitor;
  }

  return null;
}

/**
 * 从 Cookie 中读取访客令牌。
 */
function readCookieToken(req: Request): string | null {
  const cookie = req.cookies?.visitor_token;
  if (cookie && cookie.trim()) return cookie.trim();
  return null;
}

/**
 * 从 x-visitor-token 请求头中读取访客令牌。
 */
function readHeaderToken(req: Request): string | null {
  const header = req.header("x-visitor-token");
  if (header && header.trim()) return header.trim();
  return null;
}

/**
 * 从请求头中读取 CLI 令牌。
 *
 * @param req - Express 请求对象
 * @returns 读取到的令牌字符串，不存在或为空时返回 null
 */
function readCliToken(req: Request): string | null {
  const header = req.header("x-cli-token");
  if (header && header.trim()) return header.trim();
  return null;
}
