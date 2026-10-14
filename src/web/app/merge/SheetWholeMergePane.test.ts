import { describe, expect, it } from "vitest";
import { serializeSheetDocument, createEmptySheetDocument } from "../../../shared/sheetDocument";
import { summarizeSheetContent } from "./SheetWholeMergePane";

describe("summarizeSheetContent", () => {
  it("empty → empty", () => {
    expect(summarizeSheetContent("")).toEqual({ ok: false, reason: "empty" });
    expect(summarizeSheetContent("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("invalid JSON → invalid", () => {
    expect(summarizeSheetContent("{not-json")).toEqual({ ok: false, reason: "invalid" });
  });

  it("valid workbook → tab stats", () => {
    const raw = serializeSheetDocument(createEmptySheetDocument());
    const summary = summarizeSheetContent(raw);
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    expect(summary.sheetCount).toBe(1);
    expect(summary.tabs[0]?.rows).toBeGreaterThanOrEqual(1);
    expect(summary.tabs[0]?.cols).toBeGreaterThanOrEqual(1);
    expect(summary.tabs[0]?.merges).toBe(0);
  });
});
