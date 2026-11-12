import type Database from "better-sqlite3";

/** 访客在数据库中的行结构。 */
export interface VisitorRow {
  visitor_id: string;
  visitor_name: string;
  visitor_token_hash: string;
  recovery_code_hash: string | null;
  password_hash?: string | null;
  created_at: string;
  last_seen_at: string | null;
  disabled_at: string | null;
  merged_into_visitor_id: string | null;
}

/** 插入访客所需的输入参数。 */
export interface InsertVisitorInput {
  visitorId: string;
  visitorName: string;
  visitorTokenHash: string;
  recoveryCodeHash?: string;
  passwordHash?: string;
  createdAt: string;
}

/**
 * 插入一条新的访客记录。
 */
export function insertVisitor(db: Database.Database, input: InsertVisitorInput): void {
  db.prepare(
    `INSERT INTO visitors (
      visitor_id, visitor_name, visitor_token_hash, recovery_code_hash, password_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
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
  db: Database.Database,
  tokenHash: string,
): VisitorRow | undefined {
  return db
    .prepare<string, VisitorRow>(
      `SELECT * FROM visitors WHERE visitor_token_hash = ?`,
    )
    .get(tokenHash);
}

/**
 * 根据访客 ID 查找访客。
 */
export function findVisitorById(
  db: Database.Database,
  visitorId: string,
): VisitorRow | undefined {
  return db
    .prepare<string, VisitorRow>(`SELECT * FROM visitors WHERE visitor_id = ?`)
    .get(visitorId);
}

/**
 * 根据访客名称查找访客（支持按名称迁移）。
 * 只返回未禁用的访客。
 */
export function findVisitorByName(
  db: Database.Database,
  visitorName: string,
): VisitorRow | undefined {
  return db
    .prepare<string, VisitorRow>(`SELECT * FROM visitors WHERE visitor_name = ? AND disabled_at IS NULL`)
    .get(visitorName);
}

/**
 * 更新指定访客的 last_seen_at 字段。
 */
export function updateVisitorLastSeen(
  db: Database.Database,
  visitorId: string,
  at: string,
): void {
  db.prepare(`UPDATE visitors SET last_seen_at = ? WHERE visitor_id = ?`).run(
    at,
    visitorId,
  );
}

/**
 * 停用指定访客，并记录其被合并到的目标访客 ID。
 */
export function disableVisitor(
  db: Database.Database,
  visitorId: string,
  mergedInto: string,
  at: string,
): void {
  db.prepare(
    `UPDATE visitors
       SET disabled_at = ?, merged_into_visitor_id = ?
     WHERE visitor_id = ?`,
  ).run(at, mergedInto, visitorId);
}

/**
 * 列出所有访客，按创建时间降序排列。
 */
export function listVisitors(db: Database.Database, filter: "all" | "active" | "disabled" = "all"): VisitorRow[] {
  let sql = `SELECT * FROM visitors`;
  if (filter === "active") {
    sql += ` WHERE disabled_at IS NULL`;
  } else if (filter === "disabled") {
    sql += ` WHERE disabled_at IS NOT NULL`;
  }
  sql += ` ORDER BY created_at DESC`;
  return db.prepare<[], VisitorRow>(sql).all();
}

/**
 * 根据恢复码哈希查找访客。
 */
export function findVisitorByRecoveryCodeHash(
  db: Database.Database,
  recoveryCodeHash: string,
): VisitorRow | undefined {
  return db
    .prepare<string, VisitorRow>(
      `SELECT * FROM visitors WHERE recovery_code_hash = ? AND disabled_at IS NULL`,
    )
    .get(recoveryCodeHash);
}

/**
 * 更新访客的恢复码哈希。
 */
export function updateRecoveryCodeHash(
  db: Database.Database,
  visitorId: string,
  hash: string | null,
): void {
  db.prepare(`UPDATE visitors SET recovery_code_hash = ? WHERE visitor_id = ?`).run(
    hash,
    visitorId,
  );
}

/** 目录用：未停用访客，按显示名排序 */
export function listActiveVisitorsDirectory(
  db: Database.Database,
): { visitor_id: string; visitor_name: string }[] {
  return db
    .prepare<[], { visitor_id: string; visitor_name: string }>(
      `SELECT visitor_id, visitor_name FROM visitors
       WHERE disabled_at IS NULL
       ORDER BY visitor_name COLLATE NOCASE`,
    )
    .all();
}

// ==================== Session 相关 ====================

/** 访客会话在数据库中的行结构。 */
export interface VisitorSessionRow {
  session_id: string;
  visitor_id: string;
  token_hash: string;
  device_name: string | null;
  created_at: string;
  last_seen_at: string;
}

/** 插入一条新的会话记录。 */
export interface InsertSessionInput {
  sessionId: string;
  visitorId: string;
  tokenHash: string;
  deviceName?: string;
  createdAt: string;
  lastSeenAt: string;
}

export function insertSession(db: Database.Database, input: InsertSessionInput): void {
  db.prepare(
    `INSERT INTO visitor_sessions (
      session_id, visitor_id, token_hash, device_name, created_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(input.sessionId, input.visitorId, input.tokenHash, input.deviceName ?? null, input.createdAt, input.lastSeenAt);
}

/**
 * 根据 token 哈希查找会话，并关联访客信息。
 * 只返回未禁用访客的会话。
 */
export function findSessionByTokenHash(
  db: Database.Database,
  tokenHash: string,
): (VisitorSessionRow & VisitorRow) | undefined {
  return db
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
  db: Database.Database,
  sessionId: string,
  at: string,
): void {
  db.prepare(`UPDATE visitor_sessions SET last_seen_at = ? WHERE session_id = ?`).run(at, sessionId);
}

/** 删除指定会话（退出登录）。 */
export function deleteSession(db: Database.Database, sessionId: string): void {
  db.prepare(`DELETE FROM visitor_sessions WHERE session_id = ?`).run(sessionId);
}
