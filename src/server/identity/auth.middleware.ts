import type { NextFunction, Request, Response } from "express";
import type { VisitorRow } from "../db/repositories/visitor.repo.js";
import { resolveVisitorByToken } from "./visitor.service.js";
import { resolveCliVisitor } from "./cli-token.service.js";

// 无需身份认证即可访问的路径白名单
const EXEMPT_PATHS = new Set<string>([
  "/visitors/register",
  "/visitors/recover",
  "/health",
]);

/**
 * Express 身份认证中间件。
 *
 * 支持两种认证方式：
 * 1. Web 端：x-visitor-token 请求头（访客 token）
 * 2. CLI 端：x-cli-token 请求头（CLI token）
 *
 * 两种 token 都会被解析为 req.visitor，后续业务逻辑无需区分来源。
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

  // 非豁免路径：依次尝试访客 token 和 CLI token
  const visitor = tryResolveVisitor(req);
  if (!visitor) {
    // 两种 token 都没提供
    const hasVisitorToken = !!readVisitorToken(req);
    const hasCliToken = !!readCliToken(req);
    if (!hasVisitorToken && !hasCliToken) {
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
 * 依次尝试通过两种认证方式解析访客。
 * 先尝试 Web 端访客 token，失败后尝试 CLI token。
 *
 * @returns 解析到的访客信息，两种方式都失败则返回 null
 */
function tryResolveVisitor(req: Request): VisitorRow | null {
  // 方式一：Web 端访客 token
  const visitorToken = readVisitorToken(req);
  if (visitorToken) {
    const visitor = resolveVisitorByToken(visitorToken);
    if (visitor) return visitor;
  }

  // 方式二：CLI token
  const cliToken = readCliToken(req);
  if (cliToken) {
    const visitor = resolveCliVisitor(cliToken);
    if (visitor) return visitor;
  }

  return null;
}

/**
 * 从请求头中读取 Web 端访客令牌。
 *
 * @param req - Express 请求对象
 * @returns 读取到的令牌字符串，不存在或为空时返回 null
 */
function readVisitorToken(req: Request): string | null {
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
