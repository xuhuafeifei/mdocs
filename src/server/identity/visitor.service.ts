import { getDb } from "../db/connection.js";
import {
  findVisitorById,
  findVisitorByTokenHash,
  insertVisitor,
  listVisitors,
  updateVisitorLastSeen,
  type VisitorRow,
} from "../db/repositories/visitor.repo.js";
import { insertAuditLog } from "../db/repositories/audit.repo.js";
import { ensurePersonalDomain } from "../domains/personal-domain.service.js";
import {
  hashVisitorToken,
  newVisitorId,
  newVisitorToken,
} from "./token.js";
import { useLogger } from "../logger/logger.js";
import type { VisitorPublic } from "../../shared/types/visitor.js";

const log = useLogger("identity");

export interface RegisteredVisitor {
  visitor: VisitorPublic;
  visitorToken: string;
}

export function registerVisitor(visitorName: string): RegisteredVisitor {
  const trimmed = visitorName.trim();
  if (!trimmed) {
    throw new VisitorValidationError("visitor name is required");
  }
  if (trimmed.length > 60) {
    throw new VisitorValidationError("visitor name is too long");
  }
  const db = getDb();
  const visitorId = newVisitorId();
  const rawToken = newVisitorToken();
  const tokenHash = hashVisitorToken(rawToken);
  const createdAt = new Date().toISOString();

  const tx = db.transaction(() => {
    insertVisitor(db, {
      visitorId,
      visitorName: trimmed,
      visitorTokenHash: tokenHash,
      createdAt,
    });
    ensurePersonalDomain(db, visitorId, trimmed);
    insertAuditLog(db, {
      actorVisitorId: visitorId,
      action: "visitor.register",
      targetType: "visitor",
      targetId: visitorId,
      metadata: { visitorName: trimmed },
      createdAt,
    });
  });
  tx();

  log.info("registered visitor %s", visitorId);
  return {
    visitor: toPublic({
      visitor_id: visitorId,
      visitor_name: trimmed,
      visitor_token_hash: tokenHash,
      created_at: createdAt,
      last_seen_at: null,
      disabled_at: null,
      merged_into_visitor_id: null,
    }),
    visitorToken: rawToken,
  };
}

export function resolveVisitorByToken(rawToken: string): VisitorRow | null {
  const tokenHash = hashVisitorToken(rawToken);
  const db = getDb();
  const row = findVisitorByTokenHash(db, tokenHash);
  if (!row) return null;
  if (row.disabled_at) return null;
  updateVisitorLastSeen(db, row.visitor_id, new Date().toISOString());
  return row;
}

export function getVisitorById(visitorId: string): VisitorRow | null {
  const row = findVisitorById(getDb(), visitorId);
  return row ?? null;
}

export function listAllVisitors(): VisitorRow[] {
  return listVisitors(getDb());
}

export function toPublic(row: VisitorRow): VisitorPublic {
  return {
    visitorId: row.visitor_id,
    visitorName: row.visitor_name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    disabledAt: row.disabled_at,
    mergedIntoVisitorId: row.merged_into_visitor_id,
  };
}

export class VisitorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisitorValidationError";
  }
}
