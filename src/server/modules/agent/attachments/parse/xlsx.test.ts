import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseXlsx } from "./xlsx.js";
import { DEFAULT_PARSE_LIMITS } from "../types.js";

function workbookBytes(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Uint8Array(buf);
}

describe("parseXlsx", () => {
  it("parses multi-sheet workbook to JSON text", async () => {
    const data = workbookBytes({
      Sheet1: [
        ["列A", "列B"],
        ["v1", 2],
      ],
      Empty: [],
    });
    const result = await parseXlsx({ data, limits: DEFAULT_PARSE_LIMITS });
    expect(result.kind).toBe("text");
    if (result.kind !== "text") return;
    const json = JSON.parse(result.text) as {
      sheets: Array<{ name: string; rows: Record<string, unknown>[] }>;
    };
    expect(json.sheets.map((s) => s.name)).toEqual(["Sheet1", "Empty"]);
    expect(json.sheets[0]?.rows).toEqual([{ 列A: "v1", 列B: 2 }]);
    expect(json.sheets[1]?.rows).toEqual([]);
  });

  it("defers when JSON exceeds maxEmbedTextChars", async () => {
    const rows: unknown[][] = [["k"]];
    for (let i = 0; i < 500; i++) rows.push([`value-${i}-${"x".repeat(40)}`]);
    const data = workbookBytes({ Big: rows });
    const result = await parseXlsx({
      data,
      limits: { ...DEFAULT_PARSE_LIMITS, maxEmbedTextChars: 200 },
    });
    expect(result).toMatchObject({
      kind: "deferred",
      reason: "too_large",
    });
  });
});
