import type Database from "better-sqlite3";

export interface DomainRow {
  domain_id: string;
  domain_name: string;
  created_by: string;
  created_at: string;
}

export function listDomains(db: Database.Database): DomainRow[] {
  return db
    .prepare(`SELECT domain_id, domain_name, created_by, created_at FROM domains ORDER BY domain_id`)
    .all() as DomainRow[];
}
