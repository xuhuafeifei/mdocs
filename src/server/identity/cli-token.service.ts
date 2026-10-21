import { randomUUID } from "node:crypto";
import { randomBytes } from "node:crypto";
import { getDb } from "../db/connection.js";
import {
  insertCliToken,
  findCliTokenByHash,
  listCliTokensByVisitor,
  setCliTokenRevoked as setCliTokenRevokedRow,
  deleteCliTokenRow,
} from "../db/repositories/cli-token.repo.js";
import { hashVisitorToken } from "../identity/token.js";
import { findVisitorById, type VisitorRow } from "../db/repositories/visitor.repo.js";

export interface CliTokenSummary {
  tokenId: string;
  name: string;
  revoked: boolean;
  createdAt: string;
}

/**
 * 为指定访客创建 CLI Token。
 * 可与已有 Token 并存（不再 revokeAll）。
 * 返回原始 token（仅展示一次，服务端只存 hash）和元数据。
 */
export function createCliToken(params: {
  visitorId: string;
  name?: string;
}): { tokenId: string; token: string; name: string; createdAt: string } {
  const rawToken = generateCliToken();
  const tokenHash = hashVisitorToken(rawToken);
  const now = new Date().toISOString();
  const name = params.name?.trim() || "cli-token";
  const tokenId = randomUUID();

  const db = getDb();
  insertCliToken(db, {
    tokenId,
    visitorId: params.visitorId,
    tokenHash,
    name,
    createdAt: now,
  });

  return { tokenId, token: rawToken, name, createdAt: now };
}

/** 列出指定访客的所有 CLI Token（含已停用；不含已硬删）。 */
export function listCliTokens(visitorId: string): CliTokenSummary[] {
  const db = getDb();
  const rows = listCliTokensByVisitor(db, visitorId);
  return rows.map((r) => ({
    tokenId: r.token_id,
    name: r.name,
    revoked: r.revoked === 1,
    createdAt: r.created_at,
  }));
}

/**
 * 停用或重新启用 CLI Token（软开关，可恢复）。
 */
export function setCliTokenRevoked(
  visitorId: string,
  tokenId: string,
  revoked: boolean,
): void {
  const db = getDb();
  const rows = listCliTokensByVisitor(db, visitorId);
  const token = rows.find((r) => r.token_id === tokenId);
  if (!token) throw new Error("CLI token not found");
  setCliTokenRevokedRow(db, tokenId, revoked);
}

/**
 * @deprecated 用 setCliTokenRevoked(..., true)；保留兼容旧路由语义「吊销」= 停用。
 */
export function revokeCliToken(visitorId: string, tokenId: string): void {
  setCliTokenRevoked(visitorId, tokenId, true);
}

/** 硬删除 Token 行；旧明文永久失效。 */
export function deleteCliToken(visitorId: string, tokenId: string): void {
  const db = getDb();
  const rows = listCliTokensByVisitor(db, visitorId);
  const token = rows.find((r) => r.token_id === tokenId);
  if (!token) throw new Error("CLI token not found");
  deleteCliTokenRow(db, tokenId);
}

/**
 * 通过原始 CLI token 解析对应的访客信息。
 * revoked=1 或行已删 → null。
 */
export function resolveCliVisitor(rawToken: string): VisitorRow | null {
  const tokenHash = hashVisitorToken(rawToken);
  const db = getDb();

  const cliToken = findCliTokenByHash(db, tokenHash);
  if (!cliToken || cliToken.revoked === 1) return null;

  const visitor = findVisitorById(db, cliToken.visitor_id);
  if (!visitor || visitor.disabled_at) return null;

  return visitor;
}

function generateCliToken(): string {
  return randomBytes(32).toString("base64url");
}
