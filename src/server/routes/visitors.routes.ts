import { Router, type Request, type Response } from "express";
import {
  registerVisitor,
  toPublic,
  VisitorValidationError,
} from "../identity/visitor.service.js";
import { getDb } from "../db/connection.js";
import { ensurePersonalDomain } from "../domains/personal-domain.service.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("visitors-route");

export function buildVisitorsRouter(): Router {
  const router = Router();

  router.post("/register", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { visitorName?: unknown };
    if (typeof body.visitorName !== "string") {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "visitorName is required" } });
      return;
    }
    try {
      const result = registerVisitor(body.visitorName);
      res.json({ data: { visitor: result.visitor, visitorToken: result.visitorToken } });
    } catch (err) {
      if (err instanceof VisitorValidationError) {
        res.status(400).json({ error: { code: "INVALID_VISITOR_NAME", message: err.message } });
        return;
      }
      log.error("register failed: %s", err instanceof Error ? err.message : String(err));
      res.status(500).json({ error: { code: "INTERNAL", message: "failed to register visitor" } });
    }
  });

  router.get("/me", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    ensurePersonalDomain(getDb(), req.visitor.visitor_id, req.visitor.visitor_name);
    res.json({ data: { visitor: toPublic(req.visitor) } });
  });

  return router;
}
