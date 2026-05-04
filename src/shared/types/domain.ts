export interface DomainSummary {
  domainId: string;
  domainName: string;
  permission: string;
  creatorVisitorId: string;
  docCount: number;
}

/** 受限域成员列表 API（含停用、库中已删） */
export interface DomainMemberListEntry {
  visitorId: string;
  visitorName: string;
  /** visitors 表中无此 id */
  missing: boolean;
  /** 有行且 disabled_at 非空 */
  disabled: boolean;
}

/** Private-type domains: exactly one domain member (the domain owner). No multi-member list. */
export const PRIVATE_DOMAIN_MAX_MEMBERS = 1 as const;
