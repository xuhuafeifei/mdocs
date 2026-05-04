import type Database from "better-sqlite3";

export interface DomainRow {
  domain_id: string;
  domain_name: string;
  creator_visitor_id: string;
  created_at: string;
  updated_at: string;
  permission: string;
}

export function listDomains(db: Database.Database): DomainRow[] {
  return db
    .prepare(
      `SELECT domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission FROM domains ORDER BY domain_id`,
    )
    .all() as DomainRow[];
}

export function findDomainById(db: Database.Database, domainId: string): DomainRow | undefined {
  return db
    .prepare<string, DomainRow>(
      `SELECT domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission FROM domains WHERE domain_id = ?`,
    )
    .get(domainId);
}

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

export function updateDomainName(db: Database.Database, domainId: string, domainName: string): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE domains SET domain_name = ?, updated_at = ? WHERE domain_id = ?`).run(
    domainName,
    now,
    domainId,
  );
}

export function updateDomainPermission(db: Database.Database, domainId: string, permission: string): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE domains SET permission = ?, updated_at = ? WHERE domain_id = ?`).run(
    permission,
    now,
    domainId,
  );
}

export function deleteDomainRow(db: Database.Database, domainId: string): void {
  db.prepare(`DELETE FROM domain_members WHERE domain_id = ?`).run(domainId);
  db.prepare(`DELETE FROM domains WHERE domain_id = ?`).run(domainId);
}

export function addDomainMember(db: Database.Database, domainId: string, visitorId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO domain_members (domain_id, visitor_id, joined_at) VALUES (?, ?, ?)`,
  ).run(domainId, visitorId, now);
}

export function isDomainMember(db: Database.Database, domainId: string, visitorId: string): boolean {
  const row = db
    .prepare<[string, string], { c: number }>(
      `SELECT COUNT(*) as c FROM domain_members WHERE domain_id = ? AND visitor_id = ?`,
    )
    .get(domainId, visitorId);
  return (row?.c ?? 0) > 0;
}

export function countDomainMembers(db: Database.Database, domainId: string): number {
  const row = db
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) as c FROM domain_members WHERE domain_id = ?`,
    )
    .get(domainId);
  return row?.c ?? 0;
}

export function listDomainMemberIds(db: Database.Database, domainId: string): string[] {
  const rows = db
    .prepare<string, { visitor_id: string }>(
      `SELECT visitor_id FROM domain_members WHERE domain_id = ?`,
    )
    .all(domainId);
  return rows.map((r) => r.visitor_id);
}

/** 替换域成员表（先删后插）；调用方保证 visitorId 列表已校验。 */
export function replaceDomainMembers(
  db: Database.Database,
  domainId: string,
  visitorIds: string[],
  joinedAt: string,
): void {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM domain_members WHERE domain_id = ?`).run(domainId);
    const ins = db.prepare(
      `INSERT INTO domain_members (domain_id, visitor_id, joined_at) VALUES (?, ?, ?)`,
    );
    for (const vid of visitorIds) {
      ins.run(domainId, vid, joinedAt);
    }
  });
  tx();
}
