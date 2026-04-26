import type Database from "better-sqlite3";
import { findDomainById, insertDomain } from "../db/repositories/domain.repo.js";
import { personalDomainDisplayName } from "../../shared/personalDomain.js";

/** Idempotent: one personal domain per visitor (`domain_id === visitor_id`). Private domains: single member only (`PRIVATE_DOMAIN_MAX_MEMBERS` in shared/types/domain). */
export function ensurePersonalDomain(db: Database.Database, visitorId: string, visitorName: string): void {
  if (findDomainById(db, visitorId)) return;
  const now = new Date().toISOString();
  insertDomain(db, {
    domainId: visitorId,
    domainName: personalDomainDisplayName(visitorName),
    createdBy: visitorId,
    createdAt: now,
    permission: "private",
  });
}
