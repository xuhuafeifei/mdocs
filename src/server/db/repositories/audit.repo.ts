import type Database from "better-sqlite3";

export interface InsertAuditLogInput {
  actorVisitorId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

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

export interface InsertVisitorMigrationInput {
  fromVisitorId: string;
  toVisitorId: string;
  affectedCounts: Record<string, number>;
  executedAt: string;
}

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
