/**
 * domains / domain_members 表实体（与列一一对应）。
 * DomainMemberRole 与 shared 共用，避免双份定义。
 */
import type { DomainMemberRole } from "../../../../shared/types/domain.js";

export type { DomainMemberRole };

/** 表 domains */
export interface Domains {
  domain_id: string;
  domain_name: string;
  creator_visitor_id: string;
  created_at: string;
  updated_at: string;
  permission: string;
}

/** 表 domain_members */
export interface DomainMembers {
  domain_id: string;
  visitor_id: string;
  joined_at: string;
  role: DomainMemberRole;
}
