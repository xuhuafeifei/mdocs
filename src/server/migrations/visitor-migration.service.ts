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

/** 访客迁移对各类数据的影响统计 */
export interface MigrationImpact {
  documents_owner: number;
  documents_created_by: number;
  documents_updated_by: number;
  attachments_owner: number;
}

/** 访客迁移的执行结果 */
export interface MigrationResult {
  dryRun: boolean;
  from: VisitorRow;
  to: VisitorRow;
  impact: MigrationImpact;
  backupPath: string | null;
}

/** 迁移过程中出现的自定义错误 */
export class MigrationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * 将源访客的数据迁移到目标访客，并在确认后禁用源访客。
 * 如果 confirm 为 false，则仅执行预演（dry-run），返回影响统计但不修改数据。
 *
 * @param params.fromVisitorId - 源访客 ID
 * @param params.toVisitorId - 目标访客 ID
 * @param params.confirm - 是否真正执行迁移（true 执行，false 预演）
 * @returns 迁移结果，包含影响统计与备份路径
 */
export function migrateVisitor(params: {
  fromVisitorId: string;
  toVisitorId: string;
  confirm: boolean;
}): MigrationResult {
  const db = getDb();
  // 查询源访客和目标访客
  const from = findVisitorById(db, params.fromVisitorId);
  const to = findVisitorById(db, params.toVisitorId);

  // 校验双方访客是否存在且状态合法
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

  // 计算源访客在当前系统中拥有的各类资源数量
  const impact: MigrationImpact = computeImpact(db, from.visitor_id);

  // 若未确认，则返回预演结果，不做任何数据修改
  if (!params.confirm) {
    return { dryRun: true, from, to, impact, backupPath: null };
  }

  // 正式执行前先备份数据库文件
  const backupPath = backupDatabase();
  const executedAt = new Date().toISOString();

  // 在数据库事务中原子化完成所有数据迁移与日志记录
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

    // 禁用源访客并标记其合并目标
    disableVisitor(db, from.visitor_id, to.visitor_id, executedAt);

    // 记录迁移日志
    insertVisitorMigration(db, {
      fromVisitorId: from.visitor_id,
      toVisitorId: to.visitor_id,
      affectedCounts: impact as unknown as Record<string, number>,
      executedAt,
    });
    // 记录审计日志
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

/**
 * 计算源访客在系统中关联的各类数据数量。
 *
 * @param db - 数据库连接实例
 * @param fromVisitorId - 源访客 ID
 * @returns 影响统计对象
 */
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

/**
 * 备份当前数据库文件到同级目录，文件名带时间戳。
 *
 * @returns 备份文件的完整路径
 */
function backupDatabase(): string {
  const cfg = getConfig();
  const dir = path.dirname(cfg.dbFile);
  // 生成 ISO 格式时间戳并替换非法文件名字符
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(dir, `data.sqlite.backup-${ts}`);
  fs.copyFileSync(cfg.dbFile, target);
  return target;
}
