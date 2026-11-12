import path from "node:path";
import { getMaxAgentImageBytes } from "../../../infra/config/server-settings";
import { parseImage } from "./parse/image";
import { parsePlainText } from "./parse/plain-text";
import { parsePdfText } from "./parse/pdf";
import { parseXlsx } from "./parse/xlsx";
import {
  type AssetMeta,
  type ParseLimits,
  type ParseResult,
} from "./types";

export type ParseStrategy = (input: {
  meta: AssetMeta;
  data: Uint8Array;
  limits: ParseLimits;
}) => Promise<ParseResult>;

export type AssetCapability = {
  ext: string;
  parse: ParseStrategy;
  maxBytes?: number;
};

function extOf(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext || "";
}

const imageStrategy: ParseStrategy = async ({ meta, data, limits }) =>
  parseImage({ ext: extOf(meta.name), data, limits });

const plainStrategy: ParseStrategy = async ({ data, limits }) =>
  parsePlainText({ data, limits });

const pdfStrategy: ParseStrategy = async ({ data, limits }) =>
  parsePdfText({ data, limits });

const xlsxStrategy: ParseStrategy = async ({ data, limits }) =>
  parseXlsx({ data, limits });

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export const assetCapabilities: readonly AssetCapability[] = [
  // 图片字节上限运行时取 getMaxAgentImageBytes()（上传上限 ∩ 6MiB），不在此写死
  { ext: ".png", parse: imageStrategy },
  { ext: ".jpg", parse: imageStrategy },
  { ext: ".jpeg", parse: imageStrategy },
  { ext: ".webp", parse: imageStrategy },
  { ext: ".gif", parse: imageStrategy },
  { ext: ".txt", parse: plainStrategy, maxBytes: 2 * 1024 * 1024 },
  { ext: ".md", parse: plainStrategy, maxBytes: 2 * 1024 * 1024 },
  { ext: ".csv", parse: plainStrategy, maxBytes: 2 * 1024 * 1024 },
  { ext: ".json", parse: plainStrategy, maxBytes: 2 * 1024 * 1024 },
  { ext: ".pdf", parse: pdfStrategy, maxBytes: 20 * 1024 * 1024 },
  { ext: ".xlsx", parse: xlsxStrategy, maxBytes: 5 * 1024 * 1024 },
  { ext: ".xls", parse: xlsxStrategy, maxBytes: 5 * 1024 * 1024 },
];

const byExt = new Map(assetCapabilities.map((c) => [c.ext, c]));

export function findCapability(filename: string): AssetCapability | undefined {
  return byExt.get(extOf(filename));
}

export function assertUploadAllowed(filename: string, byteLength: number): void {
  const cap = findCapability(filename);
  if (!cap) {
    throw new Error("unsupported_type");
  }
  const max = IMAGE_EXTS.has(cap.ext)
    ? getMaxAgentImageBytes()
    : (cap.maxBytes ?? 20 * 1024 * 1024);
  if (byteLength > max) {
    throw new Error("file_too_large");
  }
}

export function resolveParseStrategy(filename: string): ParseStrategy {
  const cap = findCapability(filename);
  if (!cap) {
    return async () => ({
      kind: "unsupported",
      reason: `未注册类型: ${extOf(filename) || "(无后缀)"}`,
    });
  }
  return cap.parse;
}

export function allowedUploadAccept(): string {
  return assetCapabilities.map((c) => c.ext).join(",");
}
