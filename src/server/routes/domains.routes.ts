import { Router, type Request, type Response } from "express";
import { getDb } from "../db/connection.js";
import { listDomains } from "../db/repositories/domain.repo.js";

export function buildDomainsRouter(): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const visitorId = req.visitor?.visitor_id ?? null;
    const rows = listDomains(getDb());
    const filtered = rows.filter((r) => {
      if (r.permission === "public") return true;
      if (r.permission === "private" && r.domain_id === visitorId) return true;
      return false;
    });
    res.json({
      data: filtered.map((r) => ({
        domainId: r.domain_id,
        domainName: r.domain_name,
        permission: r.permission,
      })),
    });
  });

  return router;
}
