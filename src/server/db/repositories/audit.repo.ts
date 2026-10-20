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

export interface AuditLogRow {
  id: number;
  actor_visitor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata_json: string | null;
  created_at: string;
}

/**
 * 插入一条审计日志记录。
 * metadata 对象会被序列化为 JSON 字符串存储；若为空则存 NULL。
 * @returns 新行 id
 */
export function insertAuditLog(
  db: Database.Database,
  input: InsertAuditLogInput,
): number {
  const metadataText = input.metadata ? JSON.stringify(input.metadata) : null;
  const result = db
    .prepare(
      `INSERT INTO audit_logs (
      actor_visitor_id, action, target_type, target_id, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.actorVisitorId,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      metadataText,
      input.createdAt,
    );
  return Number(result.lastInsertRowid);
}

export function findAuditById(
  db: Database.Database,
  auditId: number,
): AuditLogRow | undefined {
  return db
    .prepare<number, AuditLogRow>(
      `SELECT id, actor_visitor_id, action, target_type, target_id, metadata_json, created_at
       FROM audit_logs WHERE id = ?`,
    )
    .get(auditId);
}

/** 当前访客作为 actor 的 document.delete（带 recovery）最近 N 条。 */
export function listDocumentDeleteAuditsByActor(
  db: Database.Database,
  actorVisitorId: string,
  limit: number,
): AuditLogRow[] {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 50), 200);
  return db
    .prepare<[string, number], AuditLogRow>(
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
