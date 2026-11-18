/**
 * cli_tokens 持久化模型。
 * 与 repo 分离：跨模块要类型时 import 本文件，不要 import repo。
 */

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
