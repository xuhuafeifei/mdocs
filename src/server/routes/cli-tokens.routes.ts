import { Router, type Request, type Response } from "express";
import {
  createCliToken,
  listCliTokens,
  revokeCliToken,
} from "../identity/cli-token.service.js";

/**
 * 构建 CLI Token 管理路由。
 *
 * 包含以下接口：
 * - POST /api/cli/tokens              创建新 Token（创建前吊销所有已有 Token）
 * - GET  /api/cli/tokens              列出当前访客的所有 Token
 * - DELETE /api/cli/tokens/:tokenId   吊销单个 Token
 *
 * 所有接口均需经过身份认证中间件。
 */
export function buildCliTokensRouter(): Router {
  const router = Router();

  /**
   * POST /api/cli/tokens
   *
   * 创建新的 CLI Token。
   * 创建前会自动吊销该访客的所有已有 Token（确保同一时刻只有一个活跃 token）。
   * 原始 token 仅在响应中返回一次，服务端只存储 SHA-256 hash。
   */
  router.post("/tokens", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    const body = (req.body ?? {}) as { name?: unknown };
    const result = createCliToken({
      visitorId: req.visitor.visitor_id,
      name: typeof body.name === "string" ? body.name : undefined,
    });

    res.status(201).json({ data: result });
  });

  /**
   * GET /api/cli/tokens
   *
   * 列出当前访客的所有 CLI Token（含已吊销的），按创建时间倒序排列。
   * 返回值不包含 token_hash，避免泄露。
   */
  router.get("/tokens", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    const tokens = listCliTokens(req.visitor.visitor_id);
    res.json({ data: tokens });
  });

  /**
   * DELETE /api/cli/tokens/:tokenId
   *
   * 吊销指定的 CLI Token。
   * 仅该 Token 的创建者可以吊销自己的 Token。
   */
  router.delete("/tokens/:tokenId", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    try {
      revokeCliToken(req.visitor.visitor_id, req.params.tokenId!);
      res.status(204).end();
    } catch (err) {
      if (err instanceof Error && err.message === "CLI token not found") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "CLI token not found" } });
        return;
      }
      res.status(500).json({ error: { code: "INTERNAL", message: "internal error" } });
    }
  });

  return router;
}
