import type { AssetMeta, LlmContentPart, ParseResult } from "./types.js";

type InjectFn = (
  parts: LlmContentPart[],
  meta: AssetMeta,
  result: ParseResult,
) => void;

const injectByKind: Record<ParseResult["kind"], InjectFn> = {
  image(parts, _meta, r) {
    if (r.kind !== "image") return;
    const b64 = Buffer.from(r.data).toString("base64");
    parts.push({
      type: "image_url",
      image_url: { url: `data:${r.mime};base64,${b64}` },
    });
  },
  text(parts, meta, r) {
    if (r.kind !== "text") return;
    const body = r.truncated ? `${r.text}\n…(已截断)` : r.text;
    parts.push({ type: "text", text: `【附件 ${meta.name}】\n${body}` });
  },
  deferred(parts, meta, r) {
    if (r.kind !== "deferred") return;
    parts.push({
      type: "text",
      text: `[附件] ${meta.name} (id=${meta.id}, mime=${meta.mime}, ${meta.bytes} bytes) 未内嵌全文；可用 read_attachment 读取。${r.hint ?? ""}`,
    });
  },
  unsupported(parts, meta, r) {
    if (r.kind !== "unsupported") return;
    parts.push({
      type: "text",
      text: `[附件] ${meta.name} 暂不支持解析：${r.reason}`,
    });
  },
};

export function buildUserContentParts(
  userText: string,
  parsed: Array<{ meta: AssetMeta; result: ParseResult }>,
): LlmContentPart[] {
  const text = userText.trim();
  const parts: LlmContentPart[] = [];
  if (text) parts.push({ type: "text", text });
  for (const { meta, result } of parsed) {
    injectByKind[result.kind](parts, meta, result);
  }
  if (parts.length === 0) {
    parts.push({ type: "text", text: "(见附件)" });
  }
  return parts;
}

/** 转成 pi-ai prompt(string, images?) 形状 */
export function partsToPiPrompt(parts: LlmContentPart[]): {
  text: string;
  images: Array<{ type: "image"; data: string; mimeType: string }>;
} {
  const texts: string[] = [];
  const images: Array<{ type: "image"; data: string; mimeType: string }> = [];
  for (const p of parts) {
    if (p.type === "text") {
      texts.push(p.text);
      continue;
    }
    const url = p.image_url.url;
    const m = /^data:([^;]+);base64,(.+)$/s.exec(url);
    if (!m) continue;
    images.push({ type: "image", data: m[2]!, mimeType: m[1]! });
  }
  return {
    text: texts.join("\n\n") || (images.length ? "(见图片附件)" : ""),
    images,
  };
}
