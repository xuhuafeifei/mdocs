import type Database from "better-sqlite3";

export interface CliTokenRow {
  token_id: string;
  visitor_id: string;
  token_hash: string;
  name: string;
  revoked: number;
  created_at: string;
}

export interface InsertCliTokenInput {
  tokenId: string;
  visitorId: string;
  tokenHash: string;
  name: string;
  createdAt: string;
}

export function insertCliToken(db: Database.Database, input: InsertCliTokenInput): void {
  db.prepare(
    `INSERT INTO cli_tokens (token_id, visitor_id, token_hash, name, revoked, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
  ).run(input.tokenId, input.visitorId, input.tokenHash, input.name, input.createdAt);
}

export function findCliTokenByHash(db: Database.Database, tokenHash: string): CliTokenRow | undefined {
  return db
    .prepare(`SELECT * FROM cli_tokens WHERE token_hash = ?`)
    .get(tokenHash) as CliTokenRow | undefined;
}

export function listCliTokensByVisitor(db: Database.Database, visitorId: string): CliTokenRow[] {
  return db
    .prepare(`SELECT * FROM cli_tokens WHERE visitor_id = ? ORDER BY created_at DESC`)
    .all(visitorId) as CliTokenRow[];
}

export function revokeCliToken(db: Database.Database, tokenId: string): void {
  db.prepare(`UPDATE cli_tokens SET revoked = 1 WHERE token_id = ?`).run(tokenId);
}

export function revokeAllCliTokensByVisitor(db: Database.Database, visitorId: string): void {
  db.prepare(`UPDATE cli_tokens SET revoked = 1 WHERE visitor_id = ?`).run(visitorId);
}
