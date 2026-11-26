import { randomUUID } from "node:crypto";
import { randomBytes } from "node:crypto";
import {
  insertCliToken,
  findCliTokenByHash,
  listCliTokensByVisitor,
  setCliTokenRevoked as setCliTokenRevokedRow,
  deleteCliTokenRow,
} from "../repo/cli-token.repo.js";
import { hashVisitorToken } from "./token.js";
import { findVisitorById } from "../repo/visitor.repo.js";
import type { Visitors } from "../entity/visitor.entity.js";
import { VisitorError } from "./visitor.service.js";
import {
  toCliTokenCreated,
  toCliTokenSummary,
  toCliTokensForCreate,
  type CliTokenCreated,
  type CliTokenSummary,
} from "../mapper/cli-token.mapper.js";

export type { CliTokenSummary, CliTokenCreated };

/**
 * 为指定访客创建 CLI Token。
 * 可与已有 Token 并存（不再 revokeAll）。
 * 返回原始 token（仅展示一次，服务端只存 hash）和元数据。
 */
export function createCliToken(params: {
  visitorId: string;
  name?: string;
}): CliTokenCreated {
  const rawToken = generateCliToken();
  const tokenHash = hashVisitorToken(rawToken);
  const now = new Date().toISOString();
  const name = params.name?.trim() || "cli-token";
  const tokenId = randomUUID();

  insertCliToken(
    toCliTokensForCreate(params, {
      tokenId,
      tokenHash,
      name,
      createdAt: now,
    }),
  );

  return toCliTokenCreated({ tokenId, rawToken, name, createdAt: now });
}

/** 列出指定访客的所有 CLI Token（含已停用；不含已硬删）。 */
export function listCliTokens(visitorId: string): CliTokenSummary[] {
  return listCliTokensByVisitor(visitorId).map(toCliTokenSummary);
}

/**
 * 停用或重新启用 CLI Token（软开关，可恢复）。
 */
export function setCliTokenRevoked(
  visitorId: string,
  tokenId: string,
  revoked: boolean,
): void {
  const rows = listCliTokensByVisitor(visitorId);
  const token = rows.find((r) => r.token_id === tokenId);
  if (!token) throw new VisitorError("NOT_FOUND", "CLI token not found", 404);
  setCliTokenRevokedRow(tokenId, revoked);
}

/**
 * @deprecated 用 setCliTokenRevoked(..., true)；保留兼容旧路由语义「吊销」= 停用。
 */
export function revokeCliToken(visitorId: string, tokenId: string): void {
  setCliTokenRevoked(visitorId, tokenId, true);
}

/** 硬删除 Token 行；旧明文永久失效。 */
export function deleteCliToken(visitorId: string, tokenId: string): void {
  const rows = listCliTokensByVisitor(visitorId);
  const token = rows.find((r) => r.token_id === tokenId);
  if (!token) throw new VisitorError("NOT_FOUND", "CLI token not found", 404);
  deleteCliTokenRow(tokenId);
}

/**
 * 通过原始 CLI token 解析对应的访客信息。
 * revoked=1 或行已删 → null。
 */
export function resolveCliVisitor(rawToken: string): Visitors | null {
  const tokenHash = hashVisitorToken(rawToken);

  const cliToken = findCliTokenByHash(tokenHash);
  if (!cliToken || cliToken.revoked === 1) return null;

  const visitor = findVisitorById(cliToken.visitor_id);
  if (!visitor || visitor.disabled_at) return null;

  return visitor;
}

function generateCliToken(): string {
  return randomBytes(32).toString("base64url");
}
