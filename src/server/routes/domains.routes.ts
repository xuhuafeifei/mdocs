import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { getDb } from "../db/connection.js";
import {
  findDomainById,
  listDomains,
  insertDomain,
  updateDomainName,
  updateDomainPermission,
  deleteDomainRow,
  addDomainMember,
} from "../db/repositories/domain.repo.js";
import {
  countDocumentsByDomain,
  listDomainIdsWithDocumentInviteForVisitor,
} from "../db/repositories/document.repo.js";
import { resolveDomainAccess } from "../access/domain-access.js";
import { useLogger } from "../logger/logger.js";

export function buildDomainsRouter(): Router {
  const router = Router();

  // list visible domains
  router.get("/", (req: Request, res: Response) => {
    const visitorId = req.visitor?.visitor_id ?? null;
    const db = getDb();
    const rows = listDomains(db);
    const documentInviteDomainIds =
      visitorId ? new Set(listDomainIdsWithDocumentInviteForVisitor(db, visitorId)) : undefined;
    const filtered = rows.filter(
      (r) =>
        resolveDomainAccess(db, r, r.domain_id, visitorId, { documentInviteDomainIds }).kind !== "none",
    );
    res.json({
      data: filtered.map((r) => ({
        domainId: r.domain_id,
        domainName: r.domain_name,
        permission: r.permission,
        creatorVisitorId: r.creator_visitor_id,
        docCount: countDocumentsByDomain(db, r.domain_id),
      })),
    });
  });

  // create domain
  router.post("/", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const body = (req.body ?? {}) as { domainName?: unknown; permission?: unknown };
    if (typeof body.domainName !== "string" || !body.domainName.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "domainName is required" } });
      return;
    }
    const permission = typeof body.permission === "string" ? body.permission : "restricted";
    if (!["public", "restricted", "private"].includes(permission)) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "invalid permission" } });
      return;
    }
    const now = new Date().toISOString();
    const domainId = randomUUID();
    const db = getDb();
    insertDomain(db, {
      domainId,
      domainName: body.domainName.trim(),
      creatorVisitorId: req.visitor.visitor_id,
      createdAt: now,
      updatedAt: now,
      permission,
    });
    if (permission === "restricted") {
      addDomainMember(db, domainId, req.visitor.visitor_id);
    }
    res.status(201).json({
      data: {
        domainId,
        domainName: body.domainName.trim(),
        permission,
        creatorVisitorId: req.visitor.visitor_id,
        docCount: 0,
      },
    });
  });

  // rename domain
  router.put("/:id", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const domainId = req.params.id!;
    const body = (req.body ?? {}) as { domainName?: unknown };
    if (typeof body.domainName !== "string" || !body.domainName.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "domainName is required" } });
      return;
    }
    const db = getDb();
    const domain = findDomainById(db, domainId);
    if (!domain) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "domain not found" } });
      return;
    }
    if (domain.creator_visitor_id !== req.visitor.visitor_id) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "only the creator can modify this domain" } });
      return;
    }
    const docCount = countDocumentsByDomain(db, domainId);
    if (docCount > 0) {
      res.status(400).json({ error: { code: "DOMAIN_HAS_DOCUMENTS", message: "cannot modify domain with documents" } });
      return;
    }
    updateDomainName(db, domainId, body.domainName.trim());
    res.json({ data: { domainId, domainName: body.domainName.trim() } });
  });

  // change domain permission
  router.put("/:id/permission", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const domainId = req.params.id!;
    const body = (req.body ?? {}) as { permission?: unknown };
    if (typeof body.permission !== "string" || !["public", "restricted", "private"].includes(body.permission)) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "invalid permission" } });
      return;
    }
    const db = getDb();
    const domain = findDomainById(db, domainId);
    if (!domain) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "domain not found" } });
      return;
    }
    if (domain.creator_visitor_id !== req.visitor.visitor_id) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "only the creator can modify this domain" } });
      return;
    }
    const docCount = countDocumentsByDomain(db, domainId);
    if (docCount > 0) {
      res.status(400).json({ error: { code: "DOMAIN_HAS_DOCUMENTS", message: "cannot modify domain with documents" } });
      return;
    }
    updateDomainPermission(db, domainId, body.permission);
    res.json({ data: { domainId, permission: body.permission } });
  });

  // delete domain
  router.delete("/:id", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const domainId = req.params.id!;
    const db = getDb();
    const domain = findDomainById(db, domainId);
    if (!domain) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "domain not found" } });
      return;
    }
    if (domain.creator_visitor_id !== req.visitor.visitor_id) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "only the creator can delete this domain" } });
      return;
    }
    const docCount = countDocumentsByDomain(db, domainId);
    if (docCount > 0) {
      res.status(400).json({ error: { code: "DOMAIN_HAS_DOCUMENTS", message: "cannot delete domain with documents" } });
      return;
    }
    deleteDomainRow(db, domainId);
    res.status(204).end();
  });

  return router;
}
