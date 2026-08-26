import { describe, it, expect } from "vitest";
import { changeRatio, lineEditCounts } from "./change-ratio.js";

describe("lineEditCounts", () => {
  it("identical → 0", () => {
    expect(lineEditCounts(["a", "b"], ["a", "b"])).toEqual({
      added: 0,
      removed: 0,
    });
  });

  it("one line replaced", () => {
    expect(lineEditCounts(["a", "b"], ["a", "c"])).toEqual({
      added: 1,
      removed: 1,
    });
  });

  it("append lines", () => {
    expect(lineEditCounts(["a"], ["a", "b", "c"])).toEqual({
      added: 2,
      removed: 0,
    });
  });
});

describe("changeRatio", () => {
  it("empty old uses denominator 1", () => {
    expect(changeRatio("", "hello")).toBe(1);
  });

  it("small edit has low ratio", () => {
    const oldT = Array.from({ length: 20 }, (_, i) => `line-${i}`).join("\n");
    const newT = oldT.replace("line-0", "line-0-edited");
    expect(changeRatio(oldT, newT)).toBeLessThan(0.15);
  });

  it("large rewrite has high ratio", () => {
    const oldT = "a\nb\nc\nd";
    const newT = "w\nx\ny\nz";
    expect(changeRatio(oldT, newT)).toBeGreaterThan(0.5);
  });
});
