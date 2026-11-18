/**
 * domains / domain_members 表行与写入入参（与 SQL 列对齐）。
 * DomainMemberRole 与 shared 共用，避免双份定义。
 */
import type { DomainMemberRole } from "../../../../shared/types/domain.js";

export type { DomainMemberRole };

/** 域（domain）在数据库中的行结构。 */
export interface DomainRow {
  domain_id: string;
  domain_name: string;
  creator_visitor_id: string;
  created_at: string;
  updated_at: string;
  permission: string;
}

export interface DomainMemberRow {
  visitor_id: string;
  role: DomainMemberRole;
  joined_at: string;
}

export interface InsertDomainInput {
  domainId: string;
  domainName: string;
  creatorVisitorId: string;
  createdAt: string;
  updatedAt: string;
  permission?: string;
}

export interface ReplaceDomainMemberInput {
  visitorId: string;
  role?: DomainMemberRole;
}
