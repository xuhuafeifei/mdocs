import { randomUUID } from "node:crypto";
import { randomBytes } from "node:crypto";
import { getDb } from "../db/connection.js";
import {
  insertCliToken,
  findCliTokenByHash,
  listCliTokensByVisitor,
  revokeAllCliTokensByVisitor,
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
 *
 * 创建前会吊销该访客的所有已有 Token（确保同一时刻只有一个活跃 token）。
 * 返回原始 token（仅展示一次，服务端只存 hash）和元数据。
 *
 * @param params.visitorId - 绑定的访客 ID
 * @param params.name - Token 别名，不传则使用默认名
 */
export function createCliToken(params: {
  visitorId: string;
  name?: string;
}): { tokenId: string; token: string; name: string; createdAt: string } {
  // 生成高熵随机原始 token（32 字节，base64url 编码）
  const rawToken = generateCliToken();
  // 服务端只存 hash，原始 token 返回给调用方后丢弃
  const tokenHash = hashVisitorToken(rawToken);
  const now = new Date().toISOString();
  const name = params.name?.trim() || "cli-token";
  const tokenId = randomUUID();

  // 在事务中：先吊销已有，再插入新记录
  const db = getDb();
  const tx = db.transaction(() => {
    // 吊销该访客的所有已有 CLI Token（重置语义）
    revokeAllCliTokensByVisitor(db, params.visitorId);
    // 插入新 token 记录
    insertCliToken(db, {
      tokenId,
      visitorId: params.visitorId,
      tokenHash,
      name,
      createdAt: now,
    });
  });
  tx();

  return { tokenId, token: rawToken, name, createdAt: now };
}

/**
 * 列出指定访客的所有 CLI Token（含已吊销的）。
 * 按创建时间倒序排列，最新的在前。
 * 返回值不包含 token_hash，避免泄露。
 */
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
 * 吊销指定 CLI Token。
 * 仅该 Token 的创建者可以吊销自己的 Token。
 */
export function revokeCliToken(visitorId: string, tokenId: string): void {
  const db = getDb();
  const rows = listCliTokensByVisitor(db, visitorId);
  const token = rows.find((r) => r.token_id === tokenId);
  if (!token) throw new Error("CLI token not found");
  db.prepare(`UPDATE cli_tokens SET revoked = 1 WHERE token_id = ?`).run(tokenId);
}

/**
 * 通过原始 CLI token 解析对应的访客信息。
 *
 * 认证流程：
 * 1. 对原始 token 做 SHA-256 hash
 * 2. 在 cli_tokens 表中查找匹配的 hash
 * 3. 检查是否已吊销（revoked=1 则拒绝）
 * 4. 通过 visitor_id 查询访客信息
 * 5. 检查访客是否已停用（disabled_at 存在则拒绝）
 *
 * @returns 访客信息，若 token 无效或已吊销则返回 null
 */
export function resolveCliVisitor(rawToken: string): VisitorRow | null {
  // 计算 token hash
  const tokenHash = hashVisitorToken(rawToken);
  const db = getDb();

  // 查找 CLI token 记录
  const cliToken = findCliTokenByHash(db, tokenHash);
  if (!cliToken || cliToken.revoked === 1) return null;

  // 查询对应的访客信息
  const visitor = findVisitorById(db, cliToken.visitor_id);
  if (!visitor || visitor.disabled_at) return null;

  return visitor;
}

/**
 * 生成高熵随机 CLI token（32 字节，base64url 编码）。
 * 与访客 token 使用相同的生成方式，保持一致性。
 */
function generateCliToken(): string {
  return randomBytes(32).toString("base64url");
}
