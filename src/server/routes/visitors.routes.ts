import { Router, type Request, type Response } from "express";
import {
  generateRecoveryCode,
  recoverVisitor,
  registerVisitor,
  toPublic,
  VisitorValidationError,
} from "../identity/visitor.service.js";
import { getDb } from "../db/connection.js";
import { listActiveVisitorsDirectory } from "../db/repositories/visitor.repo.js";
import { ensurePersonalDomain } from "../domains/personal-domain.service.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("visitors-route");

/**
 * 构建访客相关路由。
 * 包含注册、恢复、查询活跃访客目录、获取当前访客信息等接口。
 * @returns Express Router 实例
 */
export function buildVisitorsRouter(): Router {
  const router = Router();

  /**
   * POST /register
   * 注册新访客。
   * 返回 { visitor, visitorToken, recoveryCode }
   */
  router.post("/register", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { visitorName?: unknown };
    // 校验访客名是否为有效字符串
    if (typeof body.visitorName !== "string") {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "visitorName is required" } });
      return;
    }
    try {
      const result = registerVisitor(body.visitorName);
      // 设置 HttpOnly Cookie（10 年有效期，约等于永久）
      res.cookie("visitor_token", result.visitorToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
      });
      res.json({
        data: {
          visitor: result.visitor,
          recoveryCode: result.recoveryCode,
        },
      });
    } catch (err) {
      if (err instanceof VisitorValidationError) {
        res.status(400).json({ error: { code: "INVALID_VISITOR_NAME", message: err.message } });
        return;
      }
      // 非预期异常记录日志后返回 500
      log.error("register failed: %s", err instanceof Error ? err.message : String(err));
      res.status(500).json({ error: { code: "INTERNAL", message: "failed to register visitor" } });
    }
  });

  /**
   * POST /recover
   * 使用恢复码找回访客身份。
   * 请求体: { recoveryCode: string }
   * 返回: { visitor, visitorToken } 或 404
   */
  router.post("/recover", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { recoveryCode?: unknown };
    if (typeof body.recoveryCode !== "string" || !body.recoveryCode.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "recoveryCode is required" } });
      return;
    }
    const result = recoverVisitor(body.recoveryCode.trim());
    if (!result) {
      res.status(404).json({ error: { code: "INVALID_RECOVERY_CODE", message: "recovery code is invalid or expired" } });
      return;
    }
    // 设置 HttpOnly Cookie（10 年有效期，约等于永久）
    res.cookie("visitor_token", result.visitorToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
    });
    res.json({
      data: {
        visitor: result.visitor,
      },
    });
  });

  /**
   * POST /recovery-code
   * 为当前已登录的访客生成新的恢复码（覆盖旧的）。
   * 需要认证。返回 { recoveryCode: string }
   */
  router.post("/recovery-code", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const code = generateRecoveryCode(req.visitor.visitor_id);
    res.json({ data: { recoveryCode: code } });
  });

  /**
   * GET /
   * 获取活跃访客目录（不含已停用/已删除的访客）。
   */
  router.get("/", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    /* 取「活跃」访客目录：WHERE disabled_at IS NULL，停用/已删除的不在左栏出现 */
    const rows = listActiveVisitorsDirectory(getDb());
    res.json({
      data: {
        visitors: rows.map((r) => ({
          visitorId: r.visitor_id,
          visitorName: r.visitor_name,
        })),
      },
    });
  });

  /**
   * GET /me
   * 获取当前登录访客的信息，并确保其个人域已创建。
   */
  router.get("/me", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    // 确保该访客拥有对应的个人域
    ensurePersonalDomain(getDb(), req.visitor.visitor_id, req.visitor.visitor_name);
    res.json({ data: { visitor: toPublic(req.visitor) } });
  });

  /**
   * POST /logout
   * 注销当前访客，清除 Cookie。
   */
  router.post("/logout", (_req: Request, res: Response) => {
    res.clearCookie("visitor_token", { path: "/" });
    res.json({ data: { ok: true } });
  });

  return router;
}
