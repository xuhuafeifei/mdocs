import type Database from "better-sqlite3";

export interface DomainRow {
  domain_id: string;
  domain_name: string;
  created_by: string;
  created_at: string;
  permission: string;
}

export function listDomains(db: Database.Database): DomainRow[] {
  return db
    .prepare(`SELECT domain_id, domain_name, created_by, created_at, permission FROM domains ORDER BY domain_id`)
    .all() as DomainRow[];
}

export function findDomainById(db: Database.Database, domainId: string): DomainRow | undefined {
  return db
    .prepare<string, DomainRow>(`SELECT domain_id, domain_name, created_by, created_at, permission FROM domains WHERE domain_id = ?`)
    .get(domainId);
}

export function insertDomain(
  db: Database.Database,
  input: { domainId: string; domainName: string; createdBy: string; createdAt: string; permission?: string },
): void {
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, created_by, created_at, permission) VALUES (?, ?, ?, ?, ?)`,
  ).run(input.domainId, input.domainName, input.createdBy, input.createdAt, input.permission ?? "public");
}
