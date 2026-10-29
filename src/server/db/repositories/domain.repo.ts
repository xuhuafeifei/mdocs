import type Database from "better-sqlite3";

/** 域（domain）在数据库中的行结构。 */
export interface DomainRow {
  domain_id: string;
  domain_name: string;
  creator_visitor_id: string;
  created_at: string;
  updated_at: string;
  permission: string;
}

/** 受限域成员角色：默认可读；write 才有资格写 domain_write 文档。 */
export type DomainMemberRole = "read" | "write";

export interface DomainMemberRow {
  visitor_id: string;
  role: DomainMemberRole;
  joined_at: string;
}

/**
 * 列出所有域，按 domain_id 排序。
 */
export function listDomains(db: Database.Database): DomainRow[] {
  return db
    .prepare(
      `SELECT domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission FROM domains ORDER BY domain_id`,
    )
    .all() as DomainRow[];
}

/**
 * 根据域 ID 查找单个域。
 * 返回对应行或 undefined。
 */
export function findDomainById(db: Database.Database, domainId: string): DomainRow | undefined {
  return db
    .prepare<string, DomainRow>(
      `SELECT domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission FROM domains WHERE domain_id = ?`,
    )
    .get(domainId);
}

/**
 * 根据域名（domain_name）查找单个域。
 * 返回对应行或 undefined。
 */
export function findDomainByName(db: Database.Database, domainName: string): DomainRow | undefined {
  return db
    .prepare<string, DomainRow>(
      `SELECT domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission FROM domains WHERE domain_name = ?`,
    )
    .get(domainName);
}

/**
 * 插入一条新的域记录。
 * permission 未提供时默认为 public。
 */
export function insertDomain(
  db: Database.Database,
  input: {
    domainId: string;
    domainName: string;
    creatorVisitorId: string;
    createdAt: string;
    updatedAt: string;
    permission?: string;
  },
): void {
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.domainId,
    input.domainName,
    input.creatorVisitorId,
    input.createdAt,
    input.updatedAt,
    input.permission ?? "public",
  );
}

/**
 * 更新指定域的名称，并自动将 updated_at 设为当前时间。
 */
export function updateDomainName(db: Database.Database, domainId: string, domainName: string): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE domains SET domain_name = ?, updated_at = ? WHERE domain_id = ?`).run(
    domainName,
    now,
    domainId,
  );
}

/**
 * 更新指定域的权限，并自动将 updated_at 设为当前时间。
 */
export function updateDomainPermission(db: Database.Database, domainId: string, permission: string): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE domains SET permission = ?, updated_at = ? WHERE domain_id = ?`).run(
    permission,
    now,
    domainId,
  );
}

/**
 * 删除指定域及其关联的成员记录。
 * 先清理 domain_members，再删除 domains 行。
 */
export function deleteDomainRow(db: Database.Database, domainId: string): void {
  db.prepare(`DELETE FROM domain_members WHERE domain_id = ?`).run(domainId);
  db.prepare(`DELETE FROM domains WHERE domain_id = ?`).run(domainId);
}

function normalizeRole(role: DomainMemberRole | undefined): DomainMemberRole {
  return role === "write" ? "write" : "read";
}

/**
 * 向指定域添加一位成员。
 * 已存在时：传入 write 可升级；传入 read 不降级。
 */
export function addDomainMember(
  db: Database.Database,
  domainId: string,
  visitorId: string,
  role: DomainMemberRole = "read",
): void {
  const now = new Date().toISOString();
  const r = normalizeRole(role);
  db.prepare(
    `INSERT INTO domain_members (domain_id, visitor_id, joined_at, role) VALUES (?, ?, ?, ?)
     ON CONFLICT(domain_id, visitor_id) DO UPDATE SET
       role = CASE WHEN excluded.role = 'write' THEN 'write' ELSE domain_members.role END`,
  ).run(domainId, visitorId, now, r);
}

/**
 * 判断指定访客是否是指定域的成员。
 */
export function isDomainMember(db: Database.Database, domainId: string, visitorId: string): boolean {
  return getDomainMemberRole(db, domainId, visitorId) !== null;
}

/**
 * 查询成员角色；非成员返回 null。
 */
export function getDomainMemberRole(
  db: Database.Database,
  domainId: string,
  visitorId: string,
): DomainMemberRole | null {
  const row = db
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
export function countDomainMembers(db: Database.Database, domainId: string): number {
  const row = db
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) as c FROM domain_members WHERE domain_id = ?`,
    )
    .get(domainId);
  return row?.c ?? 0;
}

/**
 * 列出指定域的所有成员 visitor_id。
 */
export function listDomainMemberIds(db: Database.Database, domainId: string): string[] {
  return listDomainMembers(db, domainId).map((r) => r.visitor_id);
}

/**
 * 列出指定域成员（含角色）。
 */
export function listDomainMembers(db: Database.Database, domainId: string): DomainMemberRow[] {
  const rows = db
    .prepare<string, { visitor_id: string; role: string; joined_at: string }>(
      `SELECT visitor_id, role, joined_at FROM domain_members WHERE domain_id = ?`,
    )
    .all(domainId);
  return rows.map((r) => ({
    visitor_id: r.visitor_id,
    role: r.role === "write" ? "write" : "read",
    joined_at: r.joined_at,
  }));
}

/**
 * 替换域成员表（先删后插）；调用方保证列表已校验。
 * 整个操作在单个事务中完成。
 */
export function replaceDomainMembers(
  db: Database.Database,
  domainId: string,
  members: Array<{ visitorId: string; role?: DomainMemberRole }>,
  joinedAt: string,
): void {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM domain_members WHERE domain_id = ?`).run(domainId);
    const ins = db.prepare(
      `INSERT INTO domain_members (domain_id, visitor_id, joined_at, role) VALUES (?, ?, ?, ?)`,
    );
    for (const m of members) {
      ins.run(domainId, m.visitorId, joinedAt, normalizeRole(m.role));
    }
  });
  tx();
}
