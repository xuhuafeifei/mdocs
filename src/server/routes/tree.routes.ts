import { Router, type Request, type Response } from "express";
import { buildDocumentTree } from "../documents/tree.service.js";

export function buildTreeRouter(): Router {
  const router = Router();
  router.get("/", (req: Request, res: Response) => {
    const domainId = typeof req.query.domainId === "string" ? req.query.domainId : undefined;
    const visitorId = req.visitor?.visitor_id ?? null;
    res.json({ data: buildDocumentTree(domainId, visitorId) });
  });
  return router;
}
