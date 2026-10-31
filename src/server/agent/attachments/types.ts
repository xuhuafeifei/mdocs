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

/** tool 通道一次返回的图片上限；超过让模型提示用户压缩重传，避免单条 tool result 撑爆上下文 */
export const TOOL_IMAGE_MAX_BYTES = 1 * 1024 * 1024;

/**
 * 落盘 tool 行的解析后字符上限。
 *
 * 注意这里量的是**解析后文本长度**，不是文件字节：一份 67KB 的 xlsx 展开成 JSON 是
 * 32 万字符（约 10.7 万 token），每轮重放会吃掉一整个上下文窗口的十分之一。
 * 20,000 字符 ≈ 5k~8k token，既能让模型下一轮直接看到表头和前若干行，又不会失控。
 *
 * 超过这个量的附件只落「前 N 行 + 用 offset 分段读取」的提示。
 */
export const PERSIST_TEXT_MAX_CHARS = 20_000;

/** 截断落盘时保留的开头字符数（下限），让模型至少看到表头与若干行 */
export const PERSIST_PREVIEW_MIN_CHARS = 4_000;

/**
 * 为了给落盘判定拿到真实长度而二次解析时的上限。
 * 必须远大于 PERSIST_TEXT_MAX_CHARS：真正超标的附件也要能算出准确字符数，
 * 否则会退化成「不知道有多长」而只写一句空提示。
 */
export const PARSED_LENGTH_PROBE_CHARS = 5_000_000;

/**
 * 历史重放：这份解析结果能否整段写成 tool 行。
 * 图片永不落字节（每轮重放视觉 token 太贵），只落一句「请调 read_attachment」。
 */
export function shouldPersistAssetBody(
  type: AssetParseType,
  parsedChars: number,
): boolean {
  if (type === "image") return false;
  return parsedChars <= PERSIST_TEXT_MAX_CHARS;
}

export type AssetParseType = "image" | "text" | "pdf";

/** 按扩展名归类；决定首轮怎么注入、历史怎么重放 */
export function assetParseTypeOf(name: string): AssetParseType {
  const lower = name.toLowerCase();
  if (/\.(png|jpe?g|webp|gif)$/.test(lower)) return "image";
  if (/\.pdf$/.test(lower)) return "pdf";
  return "text";
}
