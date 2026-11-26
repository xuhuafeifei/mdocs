/**
 * cli_tokens 映射：进参/事实 → 落库行；表行 → 对外摘要。
 */
import type { CliTokens } from "../entity/cli-token.entity.js";

export type CliTokenSummary = {
  tokenId: string;
  name: string;
  revoked: boolean;
  createdAt: string;
};

export type CliTokenCreated = {
  tokenId: string;
  token: string;
  name: string;
  createdAt: string;
};

/** 创建 CLI Token：params + 已生成事实 → 插入行。 */
export function toCliTokensForCreate(
  params: { visitorId: string },
  facts: {
    tokenId: string;
    tokenHash: string;
    name: string;
    createdAt: string;
  },
): CliTokens {
  return {
    token_id: facts.tokenId,
    visitor_id: params.visitorId,
    token_hash: facts.tokenHash,
    name: facts.name,
    revoked: 0,
    created_at: facts.createdAt,
  };
}

/** 表行 → 列表摘要（revoked 转 boolean）。 */
export function toCliTokenSummary(row: CliTokens): CliTokenSummary {
  return {
    tokenId: row.token_id,
    name: row.name,
    revoked: row.revoked === 1,
    createdAt: row.created_at,
  };
}

/** 创建成功出参（含仅展示一次的明文 token）。 */
export function toCliTokenCreated(
  facts: { tokenId: string; rawToken: string; name: string; createdAt: string },
): CliTokenCreated {
  return {
    tokenId: facts.tokenId,
    token: facts.rawToken,
    name: facts.name,
    createdAt: facts.createdAt,
  };
}
