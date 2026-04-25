import type { NextFunction, Request, Response } from "express";
import { resolveVisitorByToken } from "./visitor.service.js";

const EXEMPT_PATHS = new Set<string>([
  "/visitors/register",
  "/health",
]);

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (EXEMPT_PATHS.has(req.path)) {
    const raw = readToken(req);
    if (raw) {
      const visitor = resolveVisitorByToken(raw);
      if (visitor) req.visitor = visitor;
    }
    next();
    return;
  }

  const raw = readToken(req);
  if (!raw) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "missing visitor token" } });
    return;
  }
  const visitor = resolveVisitorByToken(raw);
  if (!visitor) {
    res.status(401).json({ error: { code: "INVALID_TOKEN", message: "visitor token is not recognised" } });
    return;
  }
  req.visitor = visitor;
  next();
}

function readToken(req: Request): string | null {
  const header = req.header("x-visitor-token");
  if (header && header.trim()) return header.trim();
  return null;
}
