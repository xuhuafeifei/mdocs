import * as XLSX from "xlsx";
import type { ParseLimits, ParseResult } from "../types.js";

export type XlsxSheetJson = {
  name: string;
  rows: Record<string, unknown>[];
};

export type XlsxWorkbookJson = {
  sheets: XlsxSheetJson[];
};

/** Excel → JSON 文本；超 maxEmbedTextChars 则 deferred。 */
export async function parseXlsx(input: {
  data: Uint8Array;
  limits: ParseLimits;
}): Promise<ParseResult> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(input.data, { type: "array", cellDates: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "unsupported", reason: `无法解析 Excel：${msg}` };
  }

  const sheets: XlsxSheetJson[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      sheets.push({ name, rows: [] });
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
    });
    sheets.push({ name, rows });
  }

  const payload: XlsxWorkbookJson = { sheets };
  const text = JSON.stringify(payload, null, 2);
  if (text.length > input.limits.maxEmbedTextChars) {
    return {
      kind: "deferred",
      reason: "too_large",
      hint: `Excel JSON 超过 ${input.limits.maxEmbedTextChars} 字符，请用 read_attachment 分段读取`,
    };
  }
  return { kind: "text", text };
}
