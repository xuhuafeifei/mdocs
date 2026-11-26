/**
 * domains 薄 service：本聚合只读查询门面。
 * access / 其它模块应经此层取域与成员信息，不直打 repo。
 * DB 藏在 repo（默认 getDb）；本层不接收、不传递 Database。
 */
import type { DomainMemberRole, Domains } from "../entity/domain.entity.js";
import {
  findDomainById as findDomainByIdRepo,
  getDomainMemberRole as getDomainMemberRoleRepo,
  isDomainMember as isDomainMemberRepo,
  listDomainIdsWhereVisitorIsMember as listDomainIdsWhereVisitorIsMemberRepo,
  listDomains as listDomainsRepo,
} from "../repo/domain.repo.js";

export type { DomainMemberRole, Domains } from "../entity/domain.entity.js";

/** 按 id 查域；不存在返回 undefined。 */
export function getDomainById(domainId: string): Domains | undefined {
  return findDomainByIdRepo(domainId);
}

/** 列出全部域（按 domain_id）。 */
export function listDomains(): Domains[] {
  return listDomainsRepo();
}

/** 是否为域成员。 */
export function isDomainMember(domainId: string, visitorId: string): boolean {
  return isDomainMemberRepo(domainId, visitorId);
}

/** 成员角色；非成员 null。 */
export function getDomainMemberRole(
  domainId: string,
  visitorId: string,
): DomainMemberRole | null {
  return getDomainMemberRoleRepo(domainId, visitorId);
}

/** 访客在给定域集合中是成员的 domain_id（批量；供 canEnterDomains）。 */
export function listDomainIdsWhereVisitorIsMember(
  visitorId: string,
  domainIds: string[],
): string[] {
  return listDomainIdsWhereVisitorIsMemberRepo(visitorId, domainIds);
}
