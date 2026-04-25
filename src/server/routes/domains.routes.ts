import { Router, type Request, type Response } from "express";
import { getDb } from "../db/connection.js";
import { listDomains } from "../db/repositories/domain.repo.js";

export function buildDomainsRouter(): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    const rows = listDomains(getDb());
    res.json({
      data: rows.map((r) => ({
        domainId: r.domain_id,
        domainName: r.domain_name,
      })),
    });
  });

  return router;
}
