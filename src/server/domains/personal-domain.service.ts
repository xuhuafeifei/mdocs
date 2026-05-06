import type Database from "better-sqlite3";
import { findDomainById, insertDomain } from "../db/repositories/domain.repo.js";
import { personalDomainDisplayName } from "../../shared/personalDomain.js";

/**
 * 确保指定访客拥有个人域（domain_id === visitor_id）。
 * 幂等操作：若该访客的个人域已存在则直接返回，否则创建一个新的私有域。
 * 私有域仅允许单一成员（参见 shared/types/domain 中的 PRIVATE_DOMAIN_MAX_MEMBERS）。
 *
 * @param db - 数据库连接实例
 * @param visitorId - 访客 ID，同时也作为个人域的 domain_id
 * @param visitorName - 访客名称，用于生成域的展示名称
 */
export function ensurePersonalDomain(db: Database.Database, visitorId: string, visitorName: string): void {
  // 若该访客的个人域已存在，无需重复创建
  if (findDomainById(db, visitorId)) return;

  const now = new Date().toISOString();
  // 插入新的私有域记录，domainId 与 visitorId 相同
  insertDomain(db, {
    domainId: visitorId,
    domainName: personalDomainDisplayName(visitorName),
    creatorVisitorId: visitorId,
    createdAt: now,
    updatedAt: now,
    permission: "private",
  });
}
