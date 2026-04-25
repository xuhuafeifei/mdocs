import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../config/index.js";
import { getDb } from "../db/connection.js";
import {
  disableVisitor,
  findVisitorById,
  type VisitorRow,
} from "../db/repositories/visitor.repo.js";
import {
  insertAuditLog,
  insertVisitorMigration,
} from "../db/repositories/audit.repo.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("visitor-migration");

export interface MigrationImpact {
  documents_owner: number;
  documents_created_by: number;
  documents_updated_by: number;
  attachments_owner: number;
}

export interface MigrationResult {
  dryRun: boolean;
  from: VisitorRow;
  to: VisitorRow;
  impact: MigrationImpact;
  backupPath: string | null;
}

export class MigrationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function migrateVisitor(params: {
  fromVisitorId: string;
  toVisitorId: string;
  confirm: boolean;
}): MigrationResult {
  const db = getDb();
  const from = findVisitorById(db, params.fromVisitorId);
  const to = findVisitorById(db, params.toVisitorId);
  if (!from) throw new MigrationError("FROM_NOT_FOUND", `from visitor ${params.fromVisitorId} not found`);
  if (!to) throw new MigrationError("TO_NOT_FOUND", `to visitor ${params.toVisitorId} not found`);
  if (from.visitor_id === to.visitor_id) {
    throw new MigrationError("SAME_VISITOR", "from and to visitors are the same");
  }
  if (from.disabled_at) {
    throw new MigrationError("FROM_DISABLED", "from visitor is already disabled");
  }
  if (to.disabled_at) {
    throw new MigrationError("TO_DISABLED", "to visitor is disabled");
  }

  const impact: MigrationImpact = computeImpact(db, from.visitor_id);

  if (!params.confirm) {
    return { dryRun: true, from, to, impact, backupPath: null };
  }

  const backupPath = backupDatabase();
  const executedAt = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`UPDATE documents SET owner_visitor_id = ? WHERE owner_visitor_id = ?`).run(
      to.visitor_id,
      from.visitor_id,
    );
    db.prepare(`UPDATE documents SET created_by = ? WHERE created_by = ?`).run(
      to.visitor_id,
      from.visitor_id,
    );
    db.prepare(`UPDATE documents SET updated_by = ? WHERE updated_by = ?`).run(
      to.visitor_id,
      from.visitor_id,
    );
    db.prepare(`UPDATE attachments SET owner_visitor_id = ? WHERE owner_visitor_id = ?`).run(
      to.visitor_id,
      from.visitor_id,
    );

    disableVisitor(db, from.visitor_id, to.visitor_id, executedAt);

    insertVisitorMigration(db, {
      fromVisitorId: from.visitor_id,
      toVisitorId: to.visitor_id,
      affectedCounts: impact as unknown as Record<string, number>,
      executedAt,
    });
    insertAuditLog(db, {
      actorVisitorId: null,
      action: "visitor.migrate",
      targetType: "visitor",
      targetId: from.visitor_id,
      metadata: {
        fromVisitorId: from.visitor_id,
        toVisitorId: to.visitor_id,
        impact,
        backupPath,
      },
      createdAt: executedAt,
    });
  });
  tx();

  log.info("migrated visitor %s -> %s", from.visitor_id, to.visitor_id);
  return { dryRun: false, from, to, impact, backupPath };
}

function computeImpact(db: ReturnType<typeof getDb>, fromVisitorId: string): MigrationImpact {
  const one = (sql: string): number => {
    const row = db
      .prepare<string, { c: number }>(sql)
      .get(fromVisitorId);
    return row?.c ?? 0;
  };
  return {
    documents_owner: one(`SELECT COUNT(*) AS c FROM documents WHERE owner_visitor_id = ?`),
    documents_created_by: one(`SELECT COUNT(*) AS c FROM documents WHERE created_by = ?`),
    documents_updated_by: one(`SELECT COUNT(*) AS c FROM documents WHERE updated_by = ?`),
    attachments_owner: one(`SELECT COUNT(*) AS c FROM attachments WHERE owner_visitor_id = ?`),
  };
}

function backupDatabase(): string {
  const cfg = getConfig();
  const dir = path.dirname(cfg.dbFile);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(dir, `data.sqlite.backup-${ts}`);
  fs.copyFileSync(cfg.dbFile, target);
  return target;
}
