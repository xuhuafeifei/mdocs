import type Database from "better-sqlite3";

export interface VisitorRow {
  visitor_id: string;
  visitor_name: string;
  visitor_token_hash: string;
  created_at: string;
  last_seen_at: string | null;
  disabled_at: string | null;
  merged_into_visitor_id: string | null;
}

export interface InsertVisitorInput {
  visitorId: string;
  visitorName: string;
  visitorTokenHash: string;
  createdAt: string;
}

export function insertVisitor(db: Database.Database, input: InsertVisitorInput): void {
  db.prepare(
    `INSERT INTO visitors (
      visitor_id, visitor_name, visitor_token_hash, created_at
    ) VALUES (?, ?, ?, ?)`,
  ).run(input.visitorId, input.visitorName, input.visitorTokenHash, input.createdAt);
}

export function findVisitorByTokenHash(
  db: Database.Database,
  tokenHash: string,
): VisitorRow | undefined {
  return db
    .prepare<string, VisitorRow>(
      `SELECT * FROM visitors WHERE visitor_token_hash = ?`,
    )
    .get(tokenHash);
}

export function findVisitorById(
  db: Database.Database,
  visitorId: string,
): VisitorRow | undefined {
  return db
    .prepare<string, VisitorRow>(`SELECT * FROM visitors WHERE visitor_id = ?`)
    .get(visitorId);
}

export function updateVisitorLastSeen(
  db: Database.Database,
  visitorId: string,
  at: string,
): void {
  db.prepare(`UPDATE visitors SET last_seen_at = ? WHERE visitor_id = ?`).run(
    at,
    visitorId,
  );
}

export function disableVisitor(
  db: Database.Database,
  visitorId: string,
  mergedInto: string,
  at: string,
): void {
  db.prepare(
    `UPDATE visitors
       SET disabled_at = ?, merged_into_visitor_id = ?
     WHERE visitor_id = ?`,
  ).run(at, mergedInto, visitorId);
}

export function listVisitors(db: Database.Database): VisitorRow[] {
  return db
    .prepare<[], VisitorRow>(`SELECT * FROM visitors ORDER BY created_at DESC`)
    .all();
}

/** 目录用：未停用访客，按显示名排序 */
export function listActiveVisitorsDirectory(
  db: Database.Database,
): { visitor_id: string; visitor_name: string }[] {
  return db
    .prepare<[], { visitor_id: string; visitor_name: string }>(
      `SELECT visitor_id, visitor_name FROM visitors
       WHERE disabled_at IS NULL
       ORDER BY visitor_name COLLATE NOCASE`,
    )
    .all();
}
