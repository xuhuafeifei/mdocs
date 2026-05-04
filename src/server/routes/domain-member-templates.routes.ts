import { Router, type Request, type Response } from "express";
import { getDb } from "../db/connection.js";
import {
  deleteDomainMemberTemplate,
  findDomainMemberTemplateById,
  insertDomainMemberTemplate,
  listDomainMemberTemplates,
  normaliseVisitorIdsToCsv,
  updateDomainMemberTemplate,
  visitorIdsFromStoredCsv,
  type DomainMemberTemplateRow,
} from "../db/repositories/domain-member-template.repo.js";

function rowToDto(row: DomainMemberTemplateRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    visitorIds: visitorIdsFromStoredCsv(row.domain_visitor_ids),
    createTime: row.create_time,
    updateTime: row.update_time,
  };
}

function parseVisitorIdsBody(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const v = (body as { visitorIds?: unknown }).visitorIds;
  if (v === undefined) return [];
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return null;
    out.push(item);
  }
  return out;
}

export function buildDomainMemberTemplatesRouter(): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const db = getDb();
    const rows = listDomainMemberTemplates(db, req.visitor.visitor_id);
    res.json({ data: rows.map(rowToDto) });
  });

  router.post("/", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const body = (req.body ?? {}) as { displayName?: unknown };
    if (typeof body.displayName !== "string" || !body.displayName.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "displayName is required" } });
      return;
    }
    const visitorIds = parseVisitorIdsBody(req.body);
    if (visitorIds === null) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "visitorIds must be an array of strings" } });
      return;
    }
    const now = new Date().toISOString();
    const db = getDb();
    const id = insertDomainMemberTemplate(db, {
      displayName: body.displayName.trim(),
      domainVisitorIdsCsv: normaliseVisitorIdsToCsv(visitorIds),
      createVisitorId: req.visitor.visitor_id,
      createTime: now,
      updateTime: now,
    });
    const row = findDomainMemberTemplateById(db, id, req.visitor.visitor_id);
    if (!row) {
      res.status(500).json({ error: { code: "INTERNAL", message: "failed to load created template" } });
      return;
    }
    res.status(201).json({ data: rowToDto(row) });
  });

  router.put("/:id", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "invalid id" } });
      return;
    }
    const body = (req.body ?? {}) as { displayName?: unknown };
    if (typeof body.displayName !== "string" || !body.displayName.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "displayName is required" } });
      return;
    }
    const visitorIds = parseVisitorIdsBody(req.body);
    if (visitorIds === null) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "visitorIds must be an array of strings" } });
      return;
    }
    const db = getDb();
    const updated = updateDomainMemberTemplate(db, id, req.visitor.visitor_id, {
      displayName: body.displayName.trim(),
      domainVisitorIdsCsv: normaliseVisitorIdsToCsv(visitorIds),
      updateTime: new Date().toISOString(),
    });
    if (!updated) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "template not found" } });
      return;
    }
    const row = findDomainMemberTemplateById(db, id, req.visitor.visitor_id)!;
    res.json({ data: rowToDto(row) });
  });

  router.delete("/:id", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "invalid id" } });
      return;
    }
    const db = getDb();
    const deleted = deleteDomainMemberTemplate(db, id, req.visitor.visitor_id);
    if (!deleted) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "template not found" } });
      return;
    }
    res.status(204).end();
  });

  return router;
}
