import type Database from "better-sqlite3";
import { domainPermissionChange } from "../../shared/domainPermissionRank.js";
import { getDb } from "../db/connection.js";
import { findDomainById, updateDomainPermission } from "../db/repositories/domain.repo.js";

export class DomainPermissionError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** 仅创建者。允许升级（含已有文档）；拒绝下降。相同值直接成功。 */
export function changeDomainPermission(
  actorVisitorId: string,
  domainId: string,
  next: string,
  db: Database.Database = getDb(),
): { domainId: string; permission: string } {
  const domain = findDomainById(db, domainId);
  if (!domain) {
    throw new DomainPermissionError("NOT_FOUND", "domain not found", 404);
  }
  if (domain.creator_visitor_id !== actorVisitorId) {
    throw new DomainPermissionError("FORBIDDEN", "only the creator can modify this domain", 403);
  }
  const change = domainPermissionChange(domain.permission, next);
  if (change === "invalid") {
    throw new DomainPermissionError("BAD_REQUEST", "invalid permission", 400);
  }
  if (change === "downgrade") {
    throw new DomainPermissionError(
      "DOMAIN_PERMISSION_DOWNGRADE",
      "工作空间权限只能升级（private → restricted → public），不能下降",
      400,
    );
  }
  if (change === "upgrade") {
    updateDomainPermission(db, domainId, next);
  }
  return { domainId, permission: change === "same" ? domain.permission : next };
}
