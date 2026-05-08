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
  findDomainById,
  insertDomain,
  deleteDomainRow,
} from "../db/repositories/domain.repo.js";
import {
  insertAuditLog,
  insertVisitorMigration,
} from "../db/repositories/audit.repo.js";
import { personalDomainDisplayName } from "../../shared/personalDomain.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("visitor-migration");

/** 访客迁移对各类数据的影响统计 */
export interface MigrationImpact {
  documents_owner: number;
  documents_created_by: number;
  documents_updated_by: number;
  attachments_owner: number;
  personal_domain_docs: number;
  personal_domain_files_moved: number;
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
  const cfg = getConfig();

  // 在数据库事务中原子化完成所有数据迁移与日志记录
  const tx = db.transaction(() => {
    // ---- 1. 转移个人域 ----
    const fromDomain = findDomainById(db, from.visitor_id);
    if (fromDomain) {
      // 确保目标访客也有个人域
      const toDomain = findDomainById(db, to.visitor_id);
      if (!toDomain) {
        const now = new Date().toISOString();
        insertDomain(db, {
          domainId: to.visitor_id,
          domainName: personalDomainDisplayName(to.visitor_name),
          creatorVisitorId: to.visitor_id,
          createdAt: now,
          updatedAt: now,
          permission: "private",
        });
      }

      // 将旧个人域下的文档迁移到新个人域
      const personalDocCount = db
        .prepare<[string], { c: number }>(
          `SELECT COUNT(*) AS c FROM documents WHERE domain_id = ?`,
        )
        .get(from.visitor_id)?.c ?? 0;
      if (personalDocCount > 0) {
        db.prepare(`UPDATE documents SET domain_id = ? WHERE domain_id = ?`).run(
          to.visitor_id,
          from.visitor_id,
        );
      }

      // 删除旧个人域
      deleteDomainRow(db, from.visitor_id);
    }

    // ---- 2. 转移所有权 ----
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

    // ---- 3. 转移域创建者身份 ----
    db.prepare(`UPDATE domains SET creator_visitor_id = ? WHERE creator_visitor_id = ?`).run(
      to.visitor_id,
      from.visitor_id,
    );

    // ---- 4. 转移域成员身份（旧访客曾是哪些域的成员） ----
    db.prepare(`UPDATE domain_members SET visitor_id = ? WHERE visitor_id = ?`).run(
      to.visitor_id,
      from.visitor_id,
    );

    // ---- 5. 转移成员模板 ----
    db.prepare(`UPDATE domain_member_templates SET create_visitor_id = ? WHERE create_visitor_id = ?`).run(
      to.visitor_id,
      from.visitor_id,
    );

    // ---- 6. 转移文档邀请 ----
    db.prepare(`UPDATE document_invites SET visitor_id = ? WHERE visitor_id = ?`).run(
      to.visitor_id,
      from.visitor_id,
    );

    // ---- 7. 吊销旧访客的 CLI Token ----
    db.prepare(`UPDATE cli_tokens SET revoked = 1 WHERE visitor_id = ? AND revoked = 0`).run(
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

  // ---- 8. 搬物理文件（事务外执行，避免事务内 IO 耗时） ----
  const fromDocDir = path.resolve(cfg.docsDir, from.visitor_id);
  const toDocDir = path.resolve(cfg.docsDir, to.visitor_id);

  if (fs.existsSync(fromDocDir)) {
    // 确保目标目录存在
    fs.mkdirSync(toDocDir, { recursive: true, mode: 0o700 });
    // 逐个搬文件（保留文件属性）
    const entries = fs.readdirSync(fromDocDir);
    let moved = 0;
    for (const entry of entries) {
      const src = path.join(fromDocDir, entry);
      const dst = path.join(toDocDir, entry);
      // 如果目标已存在同名文件，跳过（避免覆盖）
      if (!fs.existsSync(dst)) {
        fs.renameSync(src, dst);
        moved++;
      } else {
        log.warn("file exists at target, skipping: %s", entry);
      }
    }
    // 删除空的原目录
    if (fs.readdirSync(fromDocDir).length === 0) {
      fs.rmdirSync(fromDocDir);
    } else {
      log.warn("source personal domain dir not empty after migration: %s", fromDocDir);
    }
  }

  log.info(
    "migrated visitor %s -> %s (personal domain: %d docs, %d files moved)",
    from.visitor_id,
    to.visitor_id,
    impact.personal_domain_docs,
    impact.personal_domain_files_moved,
  );
  return { dryRun: false, from, to, impact, backupPath };
}

/**
 * 计算源访客在系统中关联的各类数据数量。
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
    personal_domain_docs: one(`SELECT COUNT(*) AS c FROM documents WHERE domain_id = ?`),
    personal_domain_files_moved: hasPersonalDomainDir(fromVisitorId) ? countFilesInPersonalDomain(fromVisitorId) : 0,
  };
}

/**
 * 检查源访客的个人域在磁盘上是否有目录。
 */
function hasPersonalDomainDir(visitorId: string): boolean {
  const cfg = getConfig();
  const dir = path.resolve(cfg.docsDir, visitorId);
  return fs.existsSync(dir);
}

/**
 * 统计个人域目录下的文件数量（不含子目录）。
 */
function countFilesInPersonalDomain(visitorId: string): number {
  const cfg = getConfig();
  const dir = path.resolve(cfg.docsDir, visitorId);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((e) => {
    try {
      return fs.statSync(path.join(dir, e)).isFile();
    } catch {
      return false;
    }
  }).length;
}

/**
 * 备份当前数据库文件到同级目录，文件名带时间戳。
 */
function backupDatabase(): string {
  const cfg = getConfig();
  const dir = path.dirname(cfg.dbFile);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(dir, `data.sqlite.backup-${ts}`);
  fs.copyFileSync(cfg.dbFile, target);
  return target;
}
