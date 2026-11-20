/**
 * Nest 全局访客鉴权：解析 token → VisitorContext（ALS）。
 *
 * 支持三种认证方式，按优先级：
 * 1. Cookie（浏览器会话）
 * 2. x-cli-token（外部 Agent）
 * 3. x-visitor-token header（匿名用户/旧前端）
 *
 * 对非豁免路径要求至少携带一种有效的令牌。
 * 对齐原 Express authMiddleware 白名单 / 可选鉴权行为。
 */
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import {
  requestHasAuthCredential,
  resolveVisitorFromRequest,
} from "../../modules/visitor/service/resolve-request-visitor.js";
import { VisitorError } from "../../modules/visitor/service/visitor.service.js";
import { VisitorContext } from "../context/visitor.context.js";

/** 无需身份认证即可访问的路径白名单（相对 /api，与旧 Express mount 一致） */
const EXEMPT_PATHS = new Set<string>([
  "/visitors/register",
  "/visitors/login",
  "/visitors/recover",
  "/health",
]);

@Injectable()
export class VisitorAuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const path = apiRelativePath(req);

    // 对豁免 / 可选鉴权路径仍尝试解析令牌（若有），但不强制要求
    if (isOptionalAuth(req.method, path, req)) {
      const visitor = resolveVisitorFromRequest(req);
      VisitorContext.run(visitor, () => next());
      return;
    }

    // 非豁免路径：三种认证方式都不行才拒绝
    const visitor = resolveVisitorFromRequest(req);
    if (!visitor) {
      if (!requestHasAuthCredential(req)) {
        throw new VisitorError(
          "UNAUTHENTICATED",
          "missing visitor token",
          401,
        );
      }
      // 提供了 token 但无效
      throw new VisitorError(
        "INVALID_TOKEN",
        "visitor token is not recognised",
        401,
      );
    }

    // 认证通过：写入请求级 ALS，供 Guard / @VisitorId 共用
    VisitorContext.run(visitor, () => next());
  }
}

export function apiRelativePath(req: Request): string {
  // Nest middleware 挂载后，Express 的 path、baseUrl 和 originalUrl 组合会随路由匹配层变化。
  // 优先使用完整请求路径，确保注册、登录和恢复接口始终能转换成同一种 API 相对路径。
  const candidates = [req.originalUrl, req.url, req.path];
  for (const candidate of candidates) {
    const raw = String(candidate || "").split("?")[0] || "";
    const normalized = stripApiPrefix(raw);
    if (normalized !== raw || raw.startsWith("/")) {
      return normalized;
    }
  }
  const base = String(req.baseUrl || "");
  if (base === "/api" || base.startsWith("/api/")) {
    return stripApiPrefix(String(req.path || req.url || ""));
  }
  return String(req.path || req.url || "").split("?")[0] || "";
}

function stripApiPrefix(raw: string): string {
  if (raw === "/api") return "/";
  if (raw.startsWith("/api/")) return raw.slice(4);
  return raw;
}

/**
 * 可选鉴权（有 token 则解析，无则放行）：
 * - register / login / recover / health（白名单）
 * - GET /documents/:documentId/comments
 * - GET /assets/:assetId
 */
function isOptionalAuth(method: string, path: string, req?: Request): boolean {
  if (EXEMPT_PATHS.has(path)) return true;
  // 兜底：originalUrl 直接命中健康检查（避免 path/baseUrl 组合漂移）
  const originalPath = String(req?.originalUrl ?? "").split("?")[0] || "";
  if (originalPath === "/api/health" || originalPath.endsWith("/api/health")) {
    return true;
  }
  if (method !== "GET") return false;
  if (/^\/documents\/[^/]+\/comments\/?$/.test(path)) return true;
  if (/^\/assets\/[^/]+\/?$/.test(path)) return true;
  return false;
}
