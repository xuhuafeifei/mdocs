/**
 * audit_logs / visitor_migrations 表访问。SQL 只活在本文件。
 * **仅** `modules/documents/service/audit.service.ts` 可 import；其余走薄 service。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 * 入参/返回均为表实体；插入 audit_logs 不带 id，返回主键。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { AuditLogs, VisitorMigrations } from "../entity/audit.entity.js";

export type { AuditLogs, VisitorMigrations } from "../entity/audit.entity.js";

/** 插入审计日志；忽略 input.id（应为 null），返回新主键。 */
export function insertAuditLog(
  input: AuditLogs,
  db?: Database.Database,
): number {
  const result = resolveDb(db)
    .prepare(
      `INSERT INTO audit_logs (
      actor_visitor_id, action, target_type, target_id, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.actor_visitor_id,
      input.action,
      input.target_type,
      input.target_id,
      input.metadata_json,
      input.created_at,
    );
  return Number(result.lastInsertRowid);
}

export function findAuditById(
  auditId: number,
  db?: Database.Database,
): AuditLogs | undefined {
  return resolveDb(db)
    .prepare<number, AuditLogs>(
      `SELECT id, actor_visitor_id, action, target_type, target_id, metadata_json, created_at
       FROM audit_logs WHERE id = ?`,
    )
    .get(auditId);
}

/** 当前访客作为 actor 的 document.delete（带 recovery）最近 N 条。 */
export function listDocumentDeleteAuditsByActor(
  actorVisitorId: string,
  limit: number,
  db?: Database.Database,
): AuditLogs[] {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 50), 200);
  return resolveDb(db)
    .prepare<[string, number], AuditLogs>(
      `SELECT id, actor_visitor_id, action, target_type, target_id, metadata_json, created_at
       FROM audit_logs
       WHERE actor_visitor_id = ?
         AND action = 'document.delete'
         AND metadata_json IS NOT NULL
         AND instr(metadata_json, '"recovery"') > 0
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(actorVisitorId, safeLimit);
}

/** 插入访客迁移记录；忽略 input.id（应为 null），返回新主键。 */
export function insertVisitorMigration(
  input: VisitorMigrations,
  db?: Database.Database,
): number {
  const result = resolveDb(db)
    .prepare(
      `INSERT INTO visitor_migrations (
      from_visitor_id, to_visitor_id, affected_counts_json, executed_at
    ) VALUES (?, ?, ?, ?)`,
    )
    .run(
      input.from_visitor_id,
      input.to_visitor_id,
      input.affected_counts_json,
      input.executed_at,
    );
  return Number(result.lastInsertRowid);
}
