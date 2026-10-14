import type { ParseLimits, ParseResult } from "../types.js";

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function mimeForImageExt(ext: string): string | undefined {
  return IMAGE_MIME[ext.toLowerCase()];
}

export async function parseImage(input: {
  ext: string;
  data: Uint8Array;
  limits: ParseLimits;
}): Promise<ParseResult> {
  const mime = mimeForImageExt(input.ext) ?? "application/octet-stream";
  if (input.data.byteLength > input.limits.maxImageBytes) {
    return {
      kind: "deferred",
      reason: "too_large",
      hint: `图片超过 ${input.limits.maxImageBytes} 字节，请用 read_attachment 或压缩后重传`,
    };
  }
  return { kind: "image", mime, data: input.data };
}
