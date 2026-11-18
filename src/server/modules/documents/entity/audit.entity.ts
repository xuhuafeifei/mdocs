/**
 * audit_logs / visitor_migrations 表实体（与列一一对应）。
 */

/** 表 audit_logs；未落库时 id 为 null，insert 返回主键后再拼回去。 */
export interface AuditLogs {
  id: number | null;
  actor_visitor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata_json: string | null;
  created_at: string;
}

/** 表 visitor_migrations；未落库时 id 为 null，insert 返回主键。 */
export interface VisitorMigrations {
  id: number | null;
  from_visitor_id: string;
  to_visitor_id: string;
  affected_counts_json: string;
  executed_at: string;
}
