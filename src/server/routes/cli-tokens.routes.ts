import { Router, type Request, type Response } from "express";
import {
  createCliToken,
  listCliTokens,
  setCliTokenRevoked,
  deleteCliToken,
} from "../identity/cli-token.service.js";

/**
 * CLI Token 管理：
 * - POST   /api/cli/tokens              新建（可与已有并存）
 * - GET    /api/cli/tokens              列表（含停用）
 * - PATCH  /api/cli/tokens/:tokenId     启停 { revoked }
 * - DELETE /api/cli/tokens/:tokenId     硬删
 */
export function buildCliTokensRouter(): Router {
  const router = Router();

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

  router.get("/tokens", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    const tokens = listCliTokens(req.visitor.visitor_id);
    res.json({ data: tokens });
  });

  router.patch("/tokens/:tokenId", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    const body = (req.body ?? {}) as { revoked?: unknown };
    if (typeof body.revoked !== "boolean") {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "revoked (boolean) is required" },
      });
      return;
    }

    try {
      setCliTokenRevoked(req.visitor.visitor_id, req.params.tokenId!, body.revoked);
      res.status(204).end();
    } catch (err) {
      if (err instanceof Error && err.message === "CLI token not found") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "CLI token not found" } });
        return;
      }
      res.status(500).json({ error: { code: "INTERNAL", message: "internal error" } });
    }
  });

  router.delete("/tokens/:tokenId", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    try {
      deleteCliToken(req.visitor.visitor_id, req.params.tokenId!);
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
