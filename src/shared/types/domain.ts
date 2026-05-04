export interface DomainSummary {
  domainId: string;
  domainName: string;
  permission: string;
  creatorVisitorId: string;
  docCount: number;
}

/**
 * 受限域成员列表 API 返回的单条成员记录。
 *
 * 成员可能处于三种状态之一：
 *
 * 1. 正常   — visitorId 在 visitors 表有行，且 disabled_at IS NULL
 *              → missing=false, disabled=false, visitorName=昵称
 *
 * 2. 已停用 — visitorId 在 visitors 表有行，但 disabled_at 非空
 *              （例如被 migrate --confirm 合并到了其他访客）
 *              → missing=false, disabled=true, visitorName=昵称
 *              前端左栏「活跃访客目录」不会展示此人，但在右栏能看到「昵称 · 已停用」
 *
 * 3. 已删除 — visitorId 在 visitors 表已无对应行（物理删除）
 *              （例如 migrate 后手动清理了旧访客，或数据迁移等操作）
 *              → missing=true, visitorName=空字符串
 *              前端右栏显示完整 UUID +「已删除的访客（库中无记录）」
 */
export interface DomainMemberListEntry {
  visitorId: string;
  visitorName: string;
  /** visitors 表中无此 id（物理删除） */
  missing: boolean;
  /** visitors 表有行，但 disabled_at 非空（已停用） */
  disabled: boolean;
}

/** Private-type domains: exactly one domain member (the domain owner). No multi-member list. */
export const PRIVATE_DOMAIN_MAX_MEMBERS = 1 as const;
