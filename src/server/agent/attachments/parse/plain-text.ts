import type { ParseLimits, ParseResult } from "../types.js";

export async function parsePlainText(input: {
  data: Uint8Array;
  limits: ParseLimits;
}): Promise<ParseResult> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(input.data);
  } catch {
    return { kind: "unsupported", reason: "无法按 UTF-8 解码文本" };
  }
  if (text.length > input.limits.maxEmbedTextChars) {
    return {
      kind: "deferred",
      reason: "too_large",
      hint: `文本超过 ${input.limits.maxEmbedTextChars} 字符，请用 read_attachment 分段读取`,
    };
  }
  return { kind: "text", text };
}
