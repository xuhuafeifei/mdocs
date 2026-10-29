import path from "node:path";
import { parseImage } from "./parse/image.js";
import { parsePlainText } from "./parse/plain-text.js";
import { parsePdfText } from "./parse/pdf.js";
import { parseXlsx } from "./parse/xlsx.js";
import {
  DEFAULT_PARSE_LIMITS,
  type AssetMeta,
  type ParseLimits,
  type ParseResult,
} from "./types.js";

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

export const assetCapabilities: readonly AssetCapability[] = [
  { ext: ".png", parse: imageStrategy, maxBytes: DEFAULT_PARSE_LIMITS.maxImageBytes },
  { ext: ".jpg", parse: imageStrategy, maxBytes: DEFAULT_PARSE_LIMITS.maxImageBytes },
  { ext: ".jpeg", parse: imageStrategy, maxBytes: DEFAULT_PARSE_LIMITS.maxImageBytes },
  { ext: ".webp", parse: imageStrategy, maxBytes: DEFAULT_PARSE_LIMITS.maxImageBytes },
  { ext: ".gif", parse: imageStrategy, maxBytes: DEFAULT_PARSE_LIMITS.maxImageBytes },
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
  const max = cap.maxBytes ?? 20 * 1024 * 1024;
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
