import { Router, type Request, type Response } from "express";
import {
  addDocumentInvite,
  createDocument,
  DocumentError,
  getDocument,
  getDocumentInvites,
  listDocuments,
  removeDocument,
  removeDocumentInvite,
  updateDocument,
} from "../documents/document.service.js";
import { requireDocumentAccess } from "../middleware/document-auth.middleware.js";
import { StoragePathError } from "../storage/paths.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("documents-route");

export function buildDocumentsRouter(): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const domainId = typeof req.query.domainId === "string" ? req.query.domainId : undefined;
    const visitorId = req.visitor?.visitor_id ?? null;
    const docs = listDocuments(domainId, visitorId);
    res.json({ data: docs });
  });

  router.post("/", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const body = (req.body ?? {}) as {
      relativePath?: unknown;
      displayName?: unknown;
      content?: unknown;
      domainId?: unknown;
      permission?: unknown;
    };
    if (typeof body.relativePath !== "string" || typeof body.content !== "string") {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "relativePath and content are required" } });
      return;
    }
    try {
      const doc = createDocument({
        actorVisitorId: req.visitor.visitor_id,
        relativePath: body.relativePath,
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        content: body.content,
        domainId: typeof body.domainId === "string" ? body.domainId : undefined,
        permission: typeof body.permission === "number" ? body.permission : undefined,
      });
      res.status(201).json({ data: doc });
    } catch (err) {
      respondError(res, err, "documents-route.create");
    }
  });

  router.get("/:documentId", requireDocumentAccess("read"), (req: Request, res: Response) => {
    const documentId = req.params.documentId!;
    try {
      const doc = getDocument(documentId);
      res.json({ data: doc });
    } catch (err) {
      respondError(res, err, "documents-route.get");
    }
  });

  router.put("/:documentId", requireDocumentAccess("edit"), (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const body = (req.body ?? {}) as { content?: unknown; displayName?: unknown; permission?: unknown };
    if (typeof body.content !== "string") {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "content is required" } });
      return;
    }
    const documentId = req.params.documentId!;
    try {
      const doc = updateDocument({
        actorVisitorId: req.visitor.visitor_id,
        documentId,
        content: body.content,
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        permission: typeof body.permission === "number" ? body.permission : undefined,
      });
      res.json({ data: doc });
    } catch (err) {
      respondError(res, err, "documents-route.update");
    }
  });

  router.delete("/:documentId", requireDocumentAccess("delete"), (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const documentId = req.params.documentId!;
    try {
      removeDocument({
        actorVisitorId: req.visitor.visitor_id,
        documentId,
      });
      res.status(204).end();
    } catch (err) {
      respondError(res, err, "documents-route.delete");
    }
  });

  router.get("/:documentId/invites", requireDocumentAccess("edit"), (req: Request, res: Response) => {
    const documentId = req.params.documentId!;
    try {
      const invites = getDocumentInvites(documentId);
      res.json({ data: invites });
    } catch (err) {
      respondError(res, err, "documents-route.invites.get");
    }
  });

  router.post("/:documentId/invites", requireDocumentAccess("edit"), (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const targetVisitorId = (req.body as { targetVisitorId?: string }).targetVisitorId;
    const targetPermission = (req.body as { targetPermission?: string }).targetPermission;
    if (typeof targetVisitorId !== "string" || !targetPermission) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "targetVisitorId and targetPermission are required" } });
      return;
    }
    const documentId = req.params.documentId!;
    try {
      addDocumentInvite(req.visitor.visitor_id, documentId, targetVisitorId, targetPermission);
      res.status(204).end();
    } catch (err) {
      respondError(res, err, "documents-route.invites.add");
    }
  });

  router.delete("/:documentId/invites/:targetVisitorId", requireDocumentAccess("edit"), (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }
    const documentId = req.params.documentId!;
    try {
      removeDocumentInvite(req.visitor.visitor_id, documentId, req.params.targetVisitorId!);
      res.status(204).end();
    } catch (err) {
      respondError(res, err, "documents-route.invites.remove");
    }
  });

  return router;
}

function respondError(res: Response, err: unknown, context: string): void {
  if (err instanceof DocumentError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof StoragePathError) {
    res.status(400).json({ error: { code: "INVALID_PATH", message: err.message } });
    return;
  }
  log.error("%s failed: %s", context, err instanceof Error ? err.message : String(err));
  res.status(500).json({ error: { code: "INTERNAL", message: "internal error" } });
}
