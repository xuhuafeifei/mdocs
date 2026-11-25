/**
 * domains 薄 service：本聚合只读查询门面。
 * access / 其它模块应经此层取域与成员信息，不直打 repo。
 * 可选末参 `db?` 仅单测 / 迁移期事务注入。
 */
import type Database from "better-sqlite3";
import type { DomainMemberRole, Domains } from "../entity/domain.entity.js";
import {
  findDomainById as findDomainByIdRepo,
  getDomainMemberRole as getDomainMemberRoleRepo,
  isDomainMember as isDomainMemberRepo,
  listDomains as listDomainsRepo,
} from "../repo/domain.repo.js";

export type { DomainMemberRole, Domains } from "../entity/domain.entity.js";

/** 按 id 查域；不存在返回 undefined。 */
export function getDomainById(
  domainId: string,
  db?: Database.Database,
): Domains | undefined {
  return findDomainByIdRepo(domainId, db);
}

/** 列出全部域（按 domain_id）。 */
export function listDomains(db?: Database.Database): Domains[] {
  return listDomainsRepo(db);
}

/** 是否为域成员。 */
export function isDomainMember(
  domainId: string,
  visitorId: string,
  db?: Database.Database,
): boolean {
  return isDomainMemberRepo(domainId, visitorId, db);
}

/** 成员角色；非成员 null。 */
export function getDomainMemberRole(
  domainId: string,
  visitorId: string,
  db?: Database.Database,
): DomainMemberRole | null {
  return getDomainMemberRoleRepo(domainId, visitorId, db);
}
