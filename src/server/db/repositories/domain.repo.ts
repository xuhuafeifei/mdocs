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
