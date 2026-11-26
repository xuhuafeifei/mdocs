/**
 * audit 薄 service：本聚合对 `audit.repo` 的唯一出口。
 * 业务代码只依赖本文件，不直打 repo。
 * 对外不透传 Database；连接由 repo 内 getDb() 解析（单测 mock getDb）。
 */
import type { AuditLogs, VisitorMigrations } from "../entity/audit.entity.js";
import {
  findAuditById as findAuditByIdRepo,
  insertAuditLog as insertAuditLogRepo,
  insertVisitorMigration as insertVisitorMigrationRepo,
  listDocumentDeleteAuditsByActor as listDocumentDeleteAuditsByActorRepo,
} from "../repo/audit.repo.js";

export type { AuditLogs, VisitorMigrations } from "../entity/audit.entity.js";

export function insertAuditLog(input: AuditLogs): number {
  return insertAuditLogRepo(input);
}

export function findAuditById(auditId: number): AuditLogs | undefined {
  return findAuditByIdRepo(auditId);
}

export function listDocumentDeleteAuditsByActor(
  actorVisitorId: string,
  limit: number,
): AuditLogs[] {
  return listDocumentDeleteAuditsByActorRepo(actorVisitorId, limit);
}

export function insertVisitorMigration(input: VisitorMigrations): number {
  return insertVisitorMigrationRepo(input);
}
