/**
 * domain_member_templates 表实体（蛇形，与 SQL 列对齐）。
 * HTTP 出参见 response/。
 */

/** 表 domain_member_templates */
export interface DomainMemberTemplates {
  /** 自增 PK；insert 传 null。 */
  id: number | null;
  display_name: string;
  /** 逗号分隔的 visitor_id 列表（去空、去重、保序）。 */
  domain_visitor_ids: string;
  create_visitor_id: string;
  create_time: string;
  update_time: string;
}
