/**
 * visitors / visitor_sessions 表实体（与列一一对应）。
 * VisitorDirectory 等是查询投影，不是表实体。
 */

/** 表 visitors */
export interface Visitors {
  visitor_id: string;
  visitor_name: string;
  visitor_token_hash: string;
  recovery_code_hash: string | null;
  password_hash: string | null;
  created_at: string;
  last_seen_at: string | null;
  disabled_at: string | null;
  merged_into_visitor_id: string | null;
}

/** 表 visitor_sessions */
export interface VisitorSessions {
  session_id: string;
  visitor_id: string;
  token_hash: string;
  device_name: string | null;
  created_at: string;
  last_seen_at: string;
}

/** 查询投影：目录列表（非表） */
export interface VisitorDirectory {
  visitor_id: string;
  visitor_name: string;
}
