import { describe, expect, it } from "vitest";
import { acceptHunk, computeLineHunks, rejectHunkFromProposed } from "./markdown-hunks";

describe("markdown-hunks", () => {
  it("detects replace hunk", () => {
    const hunks = computeLineHunks("a\nb\nc", "a\nB\nc");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.oldLines).toEqual(["b"]);
    expect(hunks[0]!.newLines).toEqual(["B"]);
  });

  it("acceptHunk applies change", () => {
    const hunks = computeLineHunks("a\nb\nc", "a\nB\nc");
    expect(acceptHunk("a\nb\nc", hunks[0]!)).toBe("a\nB\nc");
  });

  it("rejectHunkFromProposed reverts proposal slice", () => {
    const current = "a\nb\nc";
    const proposed = "a\nB\nc";
    const hunks = computeLineHunks(current, proposed);
    expect(rejectHunkFromProposed(proposed, hunks[0]!)).toBe(current);
  });
});
