/**
 * domains / domain_members 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 * 入参/返回均为表实体（缺列传 null）。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type {
  DomainMemberRole,
  DomainMembers,
  Domains,
} from "../entity/domain.entity.js";

export type {
  DomainMemberRole,
  DomainMembers,
  Domains,
} from "../entity/domain.entity.js";

/**
 * 列出所有域，按 domain_id 排序。
 */
export function listDomains(db?: Database.Database): Domains[] {
  return resolveDb(db)
    .prepare(
      `SELECT domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission FROM domains ORDER BY domain_id`,
    )
    .all() as Domains[];
}

/**
 * 根据域 ID 查找单个域。
 * 返回对应行或 undefined。
 */
export function findDomainById(
  domainId: string,
  db?: Database.Database,
): Domains | undefined {
  return resolveDb(db)
    .prepare<string, Domains>(
      `SELECT domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission FROM domains WHERE domain_id = ?`,
    )
    .get(domainId);
}

/**
 * 根据域名（domain_name）查找单个域。
 * 返回对应行或 undefined。
 */
export function findDomainByName(
  domainName: string,
  db?: Database.Database,
): Domains | undefined {
  return resolveDb(db)
    .prepare<string, Domains>(
      `SELECT domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission FROM domains WHERE domain_name = ?`,
    )
    .get(domainName);
}

/**
 * 插入一条新的域记录。
 */
export function insertDomain(
  input: Domains,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.domain_id,
      input.domain_name,
      input.creator_visitor_id,
      input.created_at,
      input.updated_at,
      input.permission,
    );
}

/**
 * 更新指定域的名称，并自动将 updated_at 设为当前时间。
 */
export function updateDomainName(
  domainId: string,
  domainName: string,
  db?: Database.Database,
): void {
  const now = new Date().toISOString();
  resolveDb(db)
    .prepare(`UPDATE domains SET domain_name = ?, updated_at = ? WHERE domain_id = ?`)
    .run(domainName, now, domainId);
}

/**
 * 更新指定域的权限，并自动将 updated_at 设为当前时间。
 */
export function updateDomainPermission(
  domainId: string,
  permission: string,
  db?: Database.Database,
): void {
  const now = new Date().toISOString();
  resolveDb(db)
    .prepare(`UPDATE domains SET permission = ?, updated_at = ? WHERE domain_id = ?`)
    .run(permission, now, domainId);
}

/**
 * 删除指定域及其关联的成员记录。
 * 先清理 domain_members，再删除 domains 行。
 */
export function deleteDomainRow(domainId: string, db?: Database.Database): void {
  const conn = resolveDb(db);
  conn.prepare(`DELETE FROM domain_members WHERE domain_id = ?`).run(domainId);
  conn.prepare(`DELETE FROM domains WHERE domain_id = ?`).run(domainId);
}

function normalizeRole(role: DomainMemberRole | undefined): DomainMemberRole {
  return role === "write" ? "write" : "read";
}

/**
 * 向指定域添加一位成员（吃完整 DomainMembers）。
 * 已存在时：传入 write 可升级；传入 read 不降级；joined_at 不覆盖。
 */
export function addDomainMember(
  input: DomainMembers,
  db?: Database.Database,
): void {
  const role = normalizeRole(input.role);
  resolveDb(db)
    .prepare(
      `INSERT INTO domain_members (domain_id, visitor_id, joined_at, role) VALUES (?, ?, ?, ?)
     ON CONFLICT(domain_id, visitor_id) DO UPDATE SET
       role = CASE WHEN excluded.role = 'write' THEN 'write' ELSE domain_members.role END`,
    )
    .run(input.domain_id, input.visitor_id, input.joined_at, role);
}

/**
 * 判断指定访客是否是指定域的成员。
 */
export function isDomainMember(
  domainId: string,
  visitorId: string,
  db?: Database.Database,
): boolean {
  return getDomainMemberRole(domainId, visitorId, db) !== null;
}

/**
 * 查询成员角色；非成员返回 null。
 */
export function getDomainMemberRole(
  domainId: string,
  visitorId: string,
  db?: Database.Database,
): DomainMemberRole | null {
  const row = resolveDb(db)
    .prepare<[string, string], { role: string }>(
      `SELECT role FROM domain_members WHERE domain_id = ? AND visitor_id = ?`,
    )
    .get(domainId, visitorId);
  if (!row) return null;
  return row.role === "write" ? "write" : "read";
}

/**
 * 统计指定域的成员数量。
 */
export function countDomainMembers(
  domainId: string,
  db?: Database.Database,
): number {
  const row = resolveDb(db)
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) as c FROM domain_members WHERE domain_id = ?`,
    )
    .get(domainId);
  return row?.c ?? 0;
}

/**
 * 列出指定域的所有成员 visitor_id。
 */
export function listDomainMemberIds(
  domainId: string,
  db?: Database.Database,
): string[] {
  return listDomainMembers(domainId, db).map((r) => r.visitor_id);
}

/**
 * 列出指定域成员（含角色）。
 */
export function listDomainMembers(
  domainId: string,
  db?: Database.Database,
): DomainMembers[] {
  return resolveDb(db)
    .prepare<string, DomainMembers>(
      `SELECT domain_id, visitor_id, role, joined_at FROM domain_members WHERE domain_id = ?`,
    )
    .all(domainId);
}

/**
 * 替换域成员表（先删后插）；调用方传入完整 DomainMembers 行。
 * 整个操作在单个事务中完成。
 */
export function replaceDomainMembers(
  domainId: string,
  members: DomainMembers[],
  db?: Database.Database,
): void {
  const conn = resolveDb(db);
  const tx = conn.transaction(() => {
    conn.prepare(`DELETE FROM domain_members WHERE domain_id = ?`).run(domainId);
    const ins = conn.prepare(
      `INSERT INTO domain_members (domain_id, visitor_id, joined_at, role) VALUES (?, ?, ?, ?)`,
    );
    for (const m of members) {
      ins.run(m.domain_id, m.visitor_id, m.joined_at, normalizeRole(m.role));
    }
  });
  tx();
}
