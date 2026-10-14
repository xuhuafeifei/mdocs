import type { ParseLimits, ParseResult } from "../types.js";

/**
 * v1：PDF 默认 deferred（避免强绑 MarkItDown / 重型依赖）。
 * 小体积时可在后续换轻量抽文本实现，仍走同一策略签名。
 */
export async function parsePdfText(input: {
  data: Uint8Array;
  limits: ParseLimits;
}): Promise<ParseResult> {
  if (input.data.byteLength > input.limits.maxImageBytes * 4) {
    return {
      kind: "deferred",
      reason: "too_large",
      hint: "PDF 过大，请用 read_attachment；v1 仅返回元数据提示",
    };
  }
  return {
    kind: "deferred",
    reason: "needs_tool",
    hint: "PDF 正文请通过 read_attachment 按需读取（v1 抽文本有限）",
  };
}
