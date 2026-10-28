import { describe, expect, it } from "vitest";
import {
  applyBatchSlotRangesToBlocks,
  validateBatchSlotRanges,
} from "./batchSlotRanges.js";

describe("validateBatchSlotRanges", () => {
  it("accepts non-overlapping contiguous ranges", () => {
    const r = validateBatchSlotRanges([
      { start: 10, end: 25, markdown: "b" },
      { start: 3, end: 8, markdown: "a" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sorted.map((x) => [x.start, x.end])).toEqual([
      [3, 8],
      [10, 25],
    ]);
  });

  it("rejects overlap", () => {
    const r = validateBatchSlotRanges([
      { start: 3, end: 8, markdown: "a" },
      { start: 8, end: 10, markdown: "b" },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/overlap/);
  });

  it("rejects start > end", () => {
    const r = validateBatchSlotRanges([{ start: 5, end: 2, markdown: "" }]);
    expect(r.ok).toBe(false);
  });

  it("rejects empty ranges", () => {
    expect(validateBatchSlotRanges([]).ok).toBe(false);
  });
});

describe("applyBatchSlotRangesToBlocks", () => {
  const split = (md: string) =>
    md.trim() === "" ? [] : md.split(/\n\n+/).map((s) => s.trim());

  it("replaces spans without 1:1 (shrink + grow) using base door numbers", () => {
    const base = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const r = applyBatchSlotRangesToBlocks(
      base,
      [
        { start: 3, end: 5, markdown: "A\n\nB" }, // 3 blocks → 2
        { start: 8, end: 9, markdown: "X\n\nY\n\nZ" }, // 2 → 3
      ],
      split,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.blocks).toEqual(["1", "2", "A", "B", "6", "7", "X", "Y", "Z", "10"]);
  });

  it("empty markdown deletes the span", () => {
    const r = applyBatchSlotRangesToBlocks(
      ["a", "b", "c", "d"],
      [{ start: 2, end: 3, markdown: "" }],
      split,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.blocks).toEqual(["a", "d"]);
  });

  it("rejects out of range", () => {
    const r = applyBatchSlotRangesToBlocks(
      ["a", "b"],
      [{ start: 1, end: 3, markdown: "x" }],
      split,
    );
    expect(r.ok).toBe(false);
  });
});
