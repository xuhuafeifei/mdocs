/**
 * cli_tokens 表实体（与列一一对应）。
 */

/** 表 cli_tokens */
export interface CliTokens {
  token_id: string;
  visitor_id: string;
  token_hash: string;
  name: string;
  revoked: number;
  created_at: string;
}
