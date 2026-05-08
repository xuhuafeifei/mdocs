import type Database from "better-sqlite3";

/** 插入审计日志所需的输入参数。 */
export interface InsertAuditLogInput {
  actorVisitorId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * 插入一条审计日志记录。
 * metadata 对象会被序列化为 JSON 字符串存储；若为空则存 NULL。
 */
export function insertAuditLog(
  db: Database.Database,
  input: InsertAuditLogInput,
): void {
  const metadataText = input.metadata ? JSON.stringify(input.metadata) : null;
  db.prepare(
    `INSERT INTO audit_logs (
      actor_visitor_id, action, target_type, target_id, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.actorVisitorId,
    input.action,
    input.targetType ?? null,
    input.targetId ?? null,
    metadataText,
    input.createdAt,
  );
}

/** 插入访客迁移记录所需的输入参数。 */
export interface InsertVisitorMigrationInput {
  fromVisitorId: string;
  toVisitorId: string;
  affectedCounts: Record<string, number>;
  executedAt: string;
}

/**
 * 插入一条访客迁移历史记录。
 * affectedCounts 对象会被序列化为 JSON 字符串存储。
 */
export function insertVisitorMigration(
  db: Database.Database,
  input: InsertVisitorMigrationInput,
): void {
  db.prepare(
    `INSERT INTO visitor_migrations (
      from_visitor_id, to_visitor_id, affected_counts_json, executed_at
    ) VALUES (?, ?, ?, ?)`,
  ).run(
    input.fromVisitorId,
    input.toVisitorId,
    JSON.stringify(input.affectedCounts),
    input.executedAt,
  );
}
