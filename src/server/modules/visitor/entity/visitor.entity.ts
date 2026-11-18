/**
 * visitor 聚合持久化模型（表行 / 插入入参）。
 * 与 repo 分离：跨模块要类型时 import 本文件，不要 import repo。
 */

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

/** 目录列表行（子集） */
export interface VisitorDirectoryRow {
  visitor_id: string;
  visitor_name: string;
}
