/**
 * 从 HTTP 请求解析访客。
 * 无 Nest / Express 中间件副作用；供 nest middleware 调用。
 *
 * 支持三种认证方式，按优先级：
 * 1. Cookie（浏览器会话，最稳定）
 * 2. x-cli-token（外部 Agent）
 * 3. x-visitor-token header（匿名用户/旧前端兼容）
 */
import type { Request } from "express";
import type { Visitors } from "../entity/visitor.entity.js";
import { resolveCliVisitor } from "./cli-token.service.js";
import { resolveVisitorByToken } from "./visitor.service.js";

/**
 * 依次尝试三种方式解析访客。
 *
 * @returns 解析到的访客信息，全部失败则返回 null
 */
export function resolveVisitorFromRequest(req: Request): Visitors | null {
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

/** 请求是否携带任一认证凭证（不论是否能解析成功） */
export function requestHasAuthCredential(req: Request): boolean {
  return !!(readCookieToken(req) || readCliToken(req) || readHeaderToken(req));
}

/** 从 Cookie 中读取访客令牌。 */
function readCookieToken(req: Request): string | null {
  const cookie = req.cookies?.visitor_token;
  if (cookie && cookie.trim()) return cookie.trim();
  return null;
}

/** 从 x-visitor-token 请求头中读取访客令牌。 */
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
