import { getDb } from "../db/connection.js";
import {
  findVisitorById,
  findVisitorByName,
  findVisitorByRecoveryCodeHash,
  findVisitorByTokenHash,
  findSessionByTokenHash,
  insertVisitor,
  insertSession,
  listVisitors,
  updateRecoveryCodeHash,
  updateSessionLastSeen,
  updateVisitorLastSeen,
  type VisitorRow,
} from "../db/repositories/visitor.repo.js";
import { insertAuditLog } from "../db/repositories/audit.repo.js";
import { ensurePersonalDomain } from "../domains/personal-domain.service.js";
import {
  hashPassword,
  hashRecoveryCode,
  hashVisitorToken,
  newRecoveryCode,
  newSessionId,
  newVisitorId,
  newVisitorToken,
  verifyPassword,
} from "./token.js";
import { useLogger } from "../logger/logger.js";
import type { VisitorPublic } from "../../shared/types/visitor.js";

const log = useLogger("identity");

/** 注册访客后的返回结果 */
export interface RegisteredVisitor {
  visitor: VisitorPublic;
  visitorToken: string;
  recoveryCode: string;
}

/**
 * 注册一个新访客。
 * 校验名称合法性后，生成访客 ID 与令牌，在数据库中创建记录并为其建立个人域。
 *
 * @param visitorName - 访客名称
 * @param password - 可选密码（留空则不设置密码保护）
 * @returns 包含访客公开信息与原始令牌的注册结果
 */
export function registerVisitor(visitorName: string, password?: string): RegisteredVisitor {
  const trimmed = visitorName.trim();
  // 校验名称非空
  if (!trimmed) {
    throw new VisitorValidationError("visitor name is required");
  }
  // 校验名称长度不超过 60 字符
  if (trimmed.length > 60) {
    throw new VisitorValidationError("visitor name is too long");
  }
  if (password && password.length < 4) {
    throw new VisitorValidationError("password must be at least 4 characters");
  }

  const db = getDb();
  // 检查名称是否已被占用（仅检查未被禁用的访客）
  const existingByName = db
    .prepare<string, { c: number }>(
      `SELECT 1 AS c FROM visitors WHERE visitor_name = ? AND disabled_at IS NULL`,
    )
    .get(trimmed);
  if (existingByName) {
    throw new VisitorValidationError("visitor name is already taken");
  }
  // 生成访客唯一标识、原始令牌、恢复码及其哈希
  const visitorId = newVisitorId();
  const rawToken = newVisitorToken();
  const tokenHash = hashVisitorToken(rawToken);
  const recoveryCode = newRecoveryCode();
  const recoveryCodeHash = hashRecoveryCode(recoveryCode);
  const passwordHash = password ? hashPassword(password) : undefined;
  const createdAt = new Date().toISOString();

  // 在事务中插入访客记录（含恢复码哈希和密码哈希）、创建会话、创建个人域并记录审计日志
  const tx = db.transaction(() => {
    insertVisitor(db, {
      visitorId,
      visitorName: trimmed,
      visitorTokenHash: tokenHash,
      recoveryCodeHash,
      passwordHash,
      createdAt,
    });
    // 同时创建会话记录（新架构）
    insertSession(db, {
      sessionId: newSessionId(),
      visitorId,
      tokenHash,
      deviceName: "New Device",
      createdAt,
      lastSeenAt: createdAt,
    });
    ensurePersonalDomain(db, visitorId, trimmed);
    insertAuditLog(db, {
      actorVisitorId: visitorId,
      action: "visitor.register",
      targetType: "visitor",
      targetId: visitorId,
      metadata: { visitorName: trimmed },
      createdAt,
    });
  });
  tx();

  log.info("registered visitor %s", visitorId);
  return {
    visitor: toPublic({
      visitor_id: visitorId,
      visitor_name: trimmed,
      visitor_token_hash: tokenHash,
      recovery_code_hash: recoveryCodeHash,
      password_hash: passwordHash ?? null,
      created_at: createdAt,
      last_seen_at: null,
      disabled_at: null,
      merged_into_visitor_id: null,
    }),
    visitorToken: rawToken,
    recoveryCode,
  };
}

/**
 * 根据原始访客令牌解析对应的访客记录，并更新最后访问时间。
 * 优先查 session 表（新架构），找不到再查 visitors 表的旧 token（向后兼容）。
 *
 * @param rawToken - 原始访客令牌
 * @returns 访客数据库记录，解析失败时返回 null
 */
export function resolveVisitorByToken(rawToken: string): VisitorRow | null {
  const tokenHash = hashVisitorToken(rawToken);
  const db = getDb();

  // 优先查 session 表
  const session = findSessionByTokenHash(db, tokenHash);
  if (session) {
    // 更新 session 最后活跃时间
    updateSessionLastSeen(db, session.session_id, new Date().toISOString());
    return {
      visitor_id: session.visitor_id,
      visitor_name: session.visitor_name,
      visitor_token_hash: session.visitor_token_hash,
      recovery_code_hash: session.recovery_code_hash,
      password_hash: session.password_hash,
      created_at: session.created_at,
      last_seen_at: session.last_seen_at,
      disabled_at: session.disabled_at,
      merged_into_visitor_id: session.merged_into_visitor_id,
    };
  }

  // 向后兼容：查旧的 visitors.visitor_token_hash
  const row = findVisitorByTokenHash(db, tokenHash);
  if (!row) return null;
  if (row.disabled_at) return null;

  // 找到旧 token → 迁移到 session 表
  const now = new Date().toISOString();
  insertSession(db, {
    sessionId: newSessionId(),
    visitorId: row.visitor_id,
    tokenHash: tokenHash,
    deviceName: "Migrated Device",
    createdAt: now,
    lastSeenAt: now,
  });

  // 更新 visitor 最后活跃时间
  updateVisitorLastSeen(db, row.visitor_id, now);
  return row;
}

/**
 * 根据访客 ID 获取访客记录。
 *
 * @param visitorId - 访客 ID
 * @returns 访客数据库记录，不存在时返回 null
 */
export function getVisitorById(visitorId: string): VisitorRow | null {
  const row = findVisitorById(getDb(), visitorId);
  return row ?? null;
}

/**
 * 列出系统中所有访客记录。
 *
 * @param filter - 过滤条件："all"（全部，默认）、"active"（仅启用）、"disabled"（仅禁用）
 * @returns 访客数据库记录数组
 */
export function listAllVisitors(filter: "all" | "active" | "disabled" = "all"): VisitorRow[] {
  return listVisitors(getDb(), filter);
}

/**
 * 使用恢复码找回访客身份。
 * 验证恢复码 → 生成新 Token + 新会话（旧会话仍然有效）→ 清除恢复码（一次性使用）→ 返回新的身份。
 *
 * @param recoveryCode - 用户输入的恢复码
 * @returns 新的身份信息（访客 + 新 Token），若恢复码无效则返回 null
 */
export function recoverVisitor(recoveryCode: string): RegisteredVisitor | null {
  const db = getDb();
  const codeHash = hashRecoveryCode(recoveryCode);
  const row = findVisitorByRecoveryCodeHash(db, codeHash);
  if (!row) return null;

  // 生成新 Token，创建新会话（不影响旧会话）
  const rawToken = newVisitorToken();
  const tokenHash = hashVisitorToken(rawToken);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    // 清除恢复码（一次性使用）
    db.prepare(
      `UPDATE visitors SET last_seen_at = ?, recovery_code_hash = NULL WHERE visitor_id = ?`,
    ).run(now, row.visitor_id);
    // 创建新会话（多设备同时在线）
    insertSession(db, {
      sessionId: newSessionId(),
      visitorId: row.visitor_id,
      tokenHash,
      deviceName: "Recovered Device",
      createdAt: now,
      lastSeenAt: now,
    });
    // 审计日志
    insertAuditLog(db, {
      actorVisitorId: row.visitor_id,
      action: "visitor.recover",
      targetType: "visitor",
      targetId: row.visitor_id,
      metadata: {},
      createdAt: now,
    });
  });
  tx();

  log.info("recovered visitor %s via recovery code", row.visitor_id);
  return {
    visitor: toPublic({
      ...row,
      visitor_token_hash: tokenHash,
      recovery_code_hash: codeHash,
    }),
    visitorToken: rawToken,
    recoveryCode: "",
  };
}

/**
 * 将数据库中的访客行转换为对外公开的访客信息结构。
 *
 * @param row - 访客数据库行
 * @returns 访客公开信息对象
 */
export function toPublic(row: VisitorRow): VisitorPublic {
  return {
    visitorId: row.visitor_id,
    visitorName: row.visitor_name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    disabledAt: row.disabled_at,
    mergedIntoVisitorId: row.merged_into_visitor_id,
  };
}

/**
 * 为已登录的访客生成新的恢复码（覆盖旧码）。
 *
 * @param visitorId - 当前已登录的访客 ID
 * @returns 新的恢复码字符串
 */
export function generateRecoveryCode(visitorId: string): string {
  const db = getDb();
  const recoveryCode = newRecoveryCode();
  const codeHash = hashRecoveryCode(recoveryCode);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    updateRecoveryCodeHash(db, visitorId, codeHash);
    insertAuditLog(db, {
      actorVisitorId: visitorId,
      action: "visitor.generate-recovery-code",
      targetType: "visitor",
      targetId: visitorId,
      metadata: {},
      createdAt: now,
    });
  });
  tx();

  log.info("generated new recovery code for visitor %s", visitorId);
  return recoveryCode;
}

/** 访客信息校验失败的自定义错误 */
export class VisitorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisitorValidationError";
  }
}

/**
 * 使用用户名+密码登录。
 * 验证成功则生成新会话（不影响其他设备），返回访客信息 + 新 token。
 *
 * @param visitorName - 访客名称
 * @param password - 密码
 * @returns 登录结果，失败或未设置密码时返回 null
 */
export function loginWithPassword(visitorName: string, password: string): RegisteredVisitor | null {
  const trimmed = visitorName.trim();
  if (!trimmed || !password) return null;

  const db = getDb();
  const row = findVisitorByName(db, trimmed);
  if (!row) return null;

  // 该访客未设置密码，不能使用密码登录
  if (!row.password_hash) return null;

  // 密码验证
  if (!verifyPassword(password, row.password_hash)) return null;

  // 生成新 token 和新会话
  const rawToken = newVisitorToken();
  const tokenHash = hashVisitorToken(rawToken);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    insertSession(db, {
      sessionId: newSessionId(),
      visitorId: row.visitor_id,
      tokenHash,
      deviceName: "Password Login",
      createdAt: now,
      lastSeenAt: now,
    });
    updateVisitorLastSeen(db, row.visitor_id, now);
    insertAuditLog(db, {
      actorVisitorId: row.visitor_id,
      action: "visitor.login-password",
      targetType: "visitor",
      targetId: row.visitor_id,
      metadata: {},
      createdAt: now,
    });
  });
  tx();

  log.info("visitor %s logged in with password", row.visitor_id);
  return {
    visitor: toPublic(row),
    visitorToken: rawToken,
    recoveryCode: "",
  };
}

/**
 * 为当前访客设置密码。
 * 空字符串表示清除密码（但前端可能不暴露这个功能）。
 *
 * @param visitorId - 访客 ID
 * @param password - 新密码
 */
export function setVisitorPassword(visitorId: string, password: string): void {
  const db = getDb();
  const passwordHash = password ? hashPassword(password) : undefined;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE visitors SET password_hash = ?, last_seen_at = ? WHERE visitor_id = ?`,
    ).run(passwordHash, now, visitorId);
    insertAuditLog(db, {
      actorVisitorId: visitorId,
      action: "visitor.set-password",
      targetType: "visitor",
      targetId: visitorId,
      metadata: {},
      createdAt: now,
    });
  });
  tx();

  log.info("visitor %s set password", visitorId);
}
