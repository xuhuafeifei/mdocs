/**
 * visitors / visitor_sessions 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type {
  InsertSessionInput,
  InsertVisitorInput,
  VisitorDirectoryRow,
  VisitorRow,
  VisitorSessionRow,
} from "../entity/visitor.entity.js";

export type {
  InsertSessionInput,
  InsertVisitorInput,
  VisitorDirectoryRow,
  VisitorRow,
  VisitorSessionRow,
} from "../entity/visitor.entity.js";

/**
 * 插入一条新的访客记录。
 */
export function insertVisitor(
  input: InsertVisitorInput,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO visitors (
      visitor_id, visitor_name, visitor_token_hash, recovery_code_hash, password_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.visitorId,
      input.visitorName,
      input.visitorTokenHash,
      input.recoveryCodeHash ?? null,
      input.passwordHash ?? null,
      input.createdAt,
    );
}

/**
 * 根据 token 哈希查找访客。
 */
export function findVisitorByTokenHash(
  tokenHash: string,
  db?: Database.Database,
): VisitorRow | undefined {
  return resolveDb(db)
    .prepare<string, VisitorRow>(
      `SELECT * FROM visitors WHERE visitor_token_hash = ?`,
    )
    .get(tokenHash);
}

/**
 * 根据访客 ID 查找访客。
 */
export function findVisitorById(
  visitorId: string,
  db?: Database.Database,
): VisitorRow | undefined {
  return resolveDb(db)
    .prepare<string, VisitorRow>(`SELECT * FROM visitors WHERE visitor_id = ?`)
    .get(visitorId);
}

/**
 * 根据访客名称查找访客（支持按名称迁移）。
 * 只返回未禁用的访客。
 */
export function findVisitorByName(
  visitorName: string,
  db?: Database.Database,
): VisitorRow | undefined {
  return resolveDb(db)
    .prepare<string, VisitorRow>(
      `SELECT * FROM visitors WHERE visitor_name = ? AND disabled_at IS NULL`,
    )
    .get(visitorName);
}

/** 未停用访客是否已占用该显示名（注册冲突检测）。 */
export function existsActiveVisitorName(
  visitorName: string,
  db?: Database.Database,
): boolean {
  const row = resolveDb(db)
    .prepare<string, { c: number }>(
      `SELECT 1 AS c FROM visitors WHERE visitor_name = ? AND disabled_at IS NULL`,
    )
    .get(visitorName);
  return !!row;
}

/**
 * 更新指定访客的 last_seen_at 字段。
 */
export function updateVisitorLastSeen(
  visitorId: string,
  at: string,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(`UPDATE visitors SET last_seen_at = ? WHERE visitor_id = ?`)
    .run(at, visitorId);
}

/**
 * 停用指定访客，并记录其被合并到的目标访客 ID。
 */
export function disableVisitor(
  visitorId: string,
  mergedInto: string,
  at: string,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `UPDATE visitors
       SET disabled_at = ?, merged_into_visitor_id = ?
     WHERE visitor_id = ?`,
    )
    .run(at, mergedInto, visitorId);
}

/**
 * 列出所有访客，按创建时间降序排列。
 */
export function listVisitors(
  filter: "all" | "active" | "disabled" = "all",
  db?: Database.Database,
): VisitorRow[] {
  let sql = `SELECT * FROM visitors`;
  if (filter === "active") {
    sql += ` WHERE disabled_at IS NULL`;
  } else if (filter === "disabled") {
    sql += ` WHERE disabled_at IS NOT NULL`;
  }
  sql += ` ORDER BY created_at DESC`;
  return resolveDb(db).prepare<[], VisitorRow>(sql).all();
}

/**
 * 根据恢复码哈希查找访客。
 */
export function findVisitorByRecoveryCodeHash(
  recoveryCodeHash: string,
  db?: Database.Database,
): VisitorRow | undefined {
  return resolveDb(db)
    .prepare<string, VisitorRow>(
      `SELECT * FROM visitors WHERE recovery_code_hash = ? AND disabled_at IS NULL`,
    )
    .get(recoveryCodeHash);
}

/**
 * 更新访客的恢复码哈希。
 */
export function updateRecoveryCodeHash(
  visitorId: string,
  hash: string | null,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(`UPDATE visitors SET recovery_code_hash = ? WHERE visitor_id = ?`)
    .run(hash, visitorId);
}

/**
 * 恢复身份后：清除恢复码（一次性）并刷新 last_seen_at。
 */
export function clearRecoveryCodeAndTouch(
  visitorId: string,
  at: string,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `UPDATE visitors SET last_seen_at = ?, recovery_code_hash = NULL WHERE visitor_id = ?`,
    )
    .run(at, visitorId);
}

/**
 * 设置或清除密码哈希，并刷新 last_seen_at。
 */
export function updatePasswordHashAndLastSeen(
  visitorId: string,
  passwordHash: string | null,
  at: string,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `UPDATE visitors SET password_hash = ?, last_seen_at = ? WHERE visitor_id = ?`,
    )
    .run(passwordHash, at, visitorId);
}

/** 目录用：未停用访客，按显示名排序 */
export function listActiveVisitorsDirectory(
  db?: Database.Database,
): VisitorDirectoryRow[] {
  return resolveDb(db)
    .prepare<[], VisitorDirectoryRow>(
      `SELECT visitor_id, visitor_name FROM visitors
       WHERE disabled_at IS NULL
       ORDER BY visitor_name COLLATE NOCASE`,
    )
    .all();
}

export function insertSession(
  input: InsertSessionInput,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO visitor_sessions (
      session_id, visitor_id, token_hash, device_name, created_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sessionId,
      input.visitorId,
      input.tokenHash,
      input.deviceName ?? null,
      input.createdAt,
      input.lastSeenAt,
    );
}

/**
 * 根据 token 哈希查找会话，并关联访客信息。
 * 只返回未禁用访客的会话。
 */
export function findSessionByTokenHash(
  tokenHash: string,
  db?: Database.Database,
): (VisitorSessionRow & VisitorRow) | undefined {
  return resolveDb(db)
    .prepare<string, VisitorSessionRow & VisitorRow>(
      `SELECT vs.*, v.*
       FROM visitor_sessions vs
       JOIN visitors v ON vs.visitor_id = v.visitor_id
       WHERE vs.token_hash = ? AND v.disabled_at IS NULL`,
    )
    .get(tokenHash);
}

/** 更新指定会话的 last_seen_at 字段。 */
export function updateSessionLastSeen(
  sessionId: string,
  at: string,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(`UPDATE visitor_sessions SET last_seen_at = ? WHERE session_id = ?`)
    .run(at, sessionId);
}

/** 删除指定会话（退出登录）。 */
export function deleteSession(sessionId: string, db?: Database.Database): void {
  resolveDb(db)
    .prepare(`DELETE FROM visitor_sessions WHERE session_id = ?`)
    .run(sessionId);
}
