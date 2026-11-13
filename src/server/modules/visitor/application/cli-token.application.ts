import {
  createCliToken,
  deleteCliToken,
  listCliTokens,
  setCliTokenRevoked,
  type CliTokenSummary,
} from "../cli-token.service.js";

/** 签发 CLI Token（明文仅返回一次） */
export function issueCliToken(
  visitorId: string,
  name?: string,
): { tokenId: string; token: string; name: string; createdAt: string } {
  return createCliToken({ visitorId, name });
}

export function listVisitorCliTokens(visitorId: string): CliTokenSummary[] {
  return listCliTokens(visitorId);
}

export function updateCliTokenRevoked(
  visitorId: string,
  tokenId: string,
  revoked: boolean,
): void {
  setCliTokenRevoked(visitorId, tokenId, revoked);
}

export function removeCliToken(visitorId: string, tokenId: string): void {
  deleteCliToken(visitorId, tokenId);
}
