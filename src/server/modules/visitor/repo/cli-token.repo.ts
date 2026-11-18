/**
 * cli_tokens 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 * 入参/返回均为表实体（缺列传 null）。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { CliTokens } from "../entity/cli-token.entity.js";

export type { CliTokens } from "../entity/cli-token.entity.js";

export function insertCliToken(
  input: CliTokens,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO cli_tokens (token_id, visitor_id, token_hash, name, revoked, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.token_id,
      input.visitor_id,
      input.token_hash,
      input.name,
      input.revoked,
      input.created_at,
    );
}

export function findCliTokenByHash(
  tokenHash: string,
  db?: Database.Database,
): CliTokens | undefined {
  return resolveDb(db)
    .prepare(`SELECT * FROM cli_tokens WHERE token_hash = ?`)
    .get(tokenHash) as CliTokens | undefined;
}

export function listCliTokensByVisitor(
  visitorId: string,
  db?: Database.Database,
): CliTokens[] {
  return resolveDb(db)
    .prepare(`SELECT * FROM cli_tokens WHERE visitor_id = ? ORDER BY created_at DESC`)
    .all(visitorId) as CliTokens[];
}

export function revokeCliToken(tokenId: string, db?: Database.Database): void {
  resolveDb(db)
    .prepare(`UPDATE cli_tokens SET revoked = 1 WHERE token_id = ?`)
    .run(tokenId);
}

export function setCliTokenRevoked(
  tokenId: string,
  revoked: boolean,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(`UPDATE cli_tokens SET revoked = ? WHERE token_id = ?`)
    .run(revoked ? 1 : 0, tokenId);
}

/** 物理删除 Token 行；hash 消失后旧明文不可恢复。 */
export function deleteCliTokenRow(tokenId: string, db?: Database.Database): void {
  resolveDb(db)
    .prepare(`DELETE FROM cli_tokens WHERE token_id = ?`)
    .run(tokenId);
}

export function revokeAllCliTokensByVisitor(
  visitorId: string,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(`UPDATE cli_tokens SET revoked = 1 WHERE visitor_id = ?`)
    .run(visitorId);
}
