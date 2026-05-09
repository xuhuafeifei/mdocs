import { getDb } from "../db/connection.js";
import {
  findVisitorById,
  findVisitorByName,
  findVisitorByRecoveryCodeHash,
  findVisitorByTokenHash,
  insertVisitor,
  listVisitors,
  updateRecoveryCodeHash,
  updateVisitorLastSeen,
  type VisitorRow,
} from "../db/repositories/visitor.repo.js";
import { insertAuditLog } from "../db/repositories/audit.repo.js";
import { ensurePersonalDomain } from "../domains/personal-domain.service.js";
import {
  hashRecoveryCode,
  hashVisitorToken,
  newRecoveryCode,
  newVisitorId,
  newVisitorToken,
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
 * @returns 包含访客公开信息与原始令牌的注册结果
 */
export function registerVisitor(visitorName: string): RegisteredVisitor {
  const trimmed = visitorName.trim();
  // 校验名称非空
  if (!trimmed) {
    throw new VisitorValidationError("visitor name is required");
  }
  // 校验名称长度不超过 60 字符
  if (trimmed.length > 60) {
    throw new VisitorValidationError("visitor name is too long");
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
  const createdAt = new Date().toISOString();

  // 在事务中插入访客记录（含恢复码哈希）、创建个人域并记录审计日志
  const tx = db.transaction(() => {
    insertVisitor(db, {
      visitorId,
      visitorName: trimmed,
      visitorTokenHash: tokenHash,
      recoveryCodeHash,
      createdAt,
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
 * 若令牌无效或对应访客已被禁用，则返回 null。
 *
 * @param rawToken - 原始访客令牌
 * @returns 访客数据库记录，解析失败时返回 null
 */
export function resolveVisitorByToken(rawToken: string): VisitorRow | null {
  const tokenHash = hashVisitorToken(rawToken);
  const db = getDb();
  const row = findVisitorByTokenHash(db, tokenHash);
  // 未找到记录或访客已禁用均视为无效
  if (!row) return null;
  if (row.disabled_at) return null;
  // 更新最后访问时间戳
  updateVisitorLastSeen(db, row.visitor_id, new Date().toISOString());
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
 * 验证恢复码 → 生成新 Token → 清除恢复码（一次性使用）→ 返回新的身份。
 *
 * @param recoveryCode - 用户输入的恢复码
 * @returns 新的身份信息（访客 + 新 Token），若恢复码无效则返回 null
 */
export function recoverVisitor(recoveryCode: string): RegisteredVisitor | null {
  const db = getDb();
  const codeHash = hashRecoveryCode(recoveryCode);
  const row = findVisitorByRecoveryCodeHash(db, codeHash);
  if (!row) return null;

  // 生成新 Token，更新数据库
  const rawToken = newVisitorToken();
  const tokenHash = hashVisitorToken(rawToken);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    // 更新 Token 并清除恢复码（一次性使用）
    db.prepare(
      `UPDATE visitors SET visitor_token_hash = ?, last_seen_at = ?, recovery_code_hash = NULL WHERE visitor_id = ?`,
    ).run(tokenHash, now, row.visitor_id);
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
