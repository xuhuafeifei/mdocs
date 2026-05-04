import type { Request, Response, NextFunction } from "express";
import { assertDocumentAccess, DocumentError } from "../access/access-control.js";

export function requireDocumentAccess(action: "read" | "edit" | "delete") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const documentId = req.params.documentId;
    if (!documentId) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "documentId is required" } });
      return;
    }
    const visitorId = req.visitor?.visitor_id ?? null;
    try {
      assertDocumentAccess(documentId, visitorId, action);
      next();
    } catch (err) {
      if (err instanceof DocumentError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      next(err);
    }
  };
}
