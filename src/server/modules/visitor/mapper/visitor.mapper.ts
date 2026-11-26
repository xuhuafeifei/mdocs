/**
 * visitor 聚合映射：进参/事实 → 落库行；表行 → 对外形状。
 */
import type {
  VisitorDirectoryEntry,
  VisitorPublic,
} from "../../../../shared/types/visitor.js";
import type {
  VisitorDirectoryRow,
  Visitors,
  VisitorSessions,
} from "../entity/visitor.entity.js";

/** Visitors 行 → 对外公开信息（不含 hash）。 */
export function toVisitorPublic(row: Visitors): VisitorPublic {
  return {
    visitorId: row.visitor_id,
    visitorName: row.visitor_name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    disabledAt: row.disabled_at,
    mergedIntoVisitorId: row.merged_into_visitor_id,
  };
}

/** 目录投影行 → 目录出参。 */
export function toVisitorDirectoryEntry(row: VisitorDirectoryRow): VisitorDirectoryEntry {
  return {
    visitorId: row.visitor_id,
    visitorName: row.visitor_name,
  };
}

/** 注册：已生成的 id/hash/时间 → visitors 插入行。 */
export function toVisitorsForRegister(facts: {
  visitorId: string;
  visitorName: string;
  tokenHash: string;
  recoveryCodeHash: string;
  passwordHash: string | null;
  createdAt: string;
}): Visitors {
  return {
    visitor_id: facts.visitorId,
    visitor_name: facts.visitorName,
    visitor_token_hash: facts.tokenHash,
    recovery_code_hash: facts.recoveryCodeHash,
    password_hash: facts.passwordHash,
    created_at: facts.createdAt,
    last_seen_at: null,
    disabled_at: null,
    merged_into_visitor_id: null,
  };
}

/** 新建会话行（注册 / 恢复 / 密码登录 / 旧 token 迁移）。 */
export function toVisitorSessionsRow(facts: {
  sessionId: string;
  visitorId: string;
  tokenHash: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt?: string;
}): VisitorSessions {
  return {
    session_id: facts.sessionId,
    visitor_id: facts.visitorId,
    token_hash: facts.tokenHash,
    device_name: facts.deviceName,
    created_at: facts.createdAt,
    last_seen_at: facts.lastSeenAt ?? facts.createdAt,
  };
}

/**
 * session JOIN 投影 → Visitors 形状（鉴权解析用）。
 * 字段名与 Visitors 对齐，便于后续 toVisitorPublic。
 */
export function toVisitorsFromSessionJoin(session: {
  visitor_id: string;
  visitor_name: string;
  visitor_token_hash: string;
  recovery_code_hash: string | null;
  password_hash: string | null;
  created_at: string;
  last_seen_at: string | null;
  disabled_at: string | null;
  merged_into_visitor_id: string | null;
}): Visitors {
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
