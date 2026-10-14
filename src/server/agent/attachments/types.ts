export type AssetStatus = "staging" | "persisted";

export type AssetMeta = {
  id: string;
  sessionId: string;
  ownerVisitorId: string;
  sha256: string;
  name: string;
  mime: string;
  bytes: number;
  status: AssetStatus;
  createdAt: string;
  persistedAt?: string | null;
};

/** jsonl / API 引用（无字节） */
export type AssetRef = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
};

export type ParseLimits = {
  maxImageBytes: number;
  maxEmbedTextChars: number;
};

export type ParseResult =
  | { kind: "image"; mime: string; data: Uint8Array }
  | { kind: "text"; text: string; truncated?: boolean }
  | { kind: "deferred"; reason: "too_large" | "needs_tool"; hint?: string }
  | { kind: "unsupported"; reason: string };

export type LlmContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export const DEFAULT_PARSE_LIMITS: ParseLimits = {
  maxImageBytes: 4 * 1024 * 1024,
  maxEmbedTextChars: 12_000,
};

export const STAGING_TTL_MS = 24 * 60 * 60 * 1000;
