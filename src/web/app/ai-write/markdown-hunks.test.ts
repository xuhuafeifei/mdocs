import { describe, expect, it } from "vitest";
import { acceptHunk, computeLineHunks, rejectHunkFromProposed, rejectHunkInSegments, acceptHunkInSegments, type MdInlineSeg } from "./markdown-hunks";

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

  it("rejectHunkInSegments keeps other hunks without LCS reshuffle", () => {
    const current = "a\nb\nc\nd\ne";
    const proposed = "a\nB\nc\nD\ne";
    const hunks = computeLineHunks(current, proposed);
    expect(hunks).toHaveLength(2);
    const segs: MdInlineSeg[] = [
      { kind: "same", lines: ["a"], key: "s0" },
      { kind: "hunk", hunk: hunks[0]!, hunkIndex: 0, key: "h0" },
      { kind: "same", lines: ["c"], key: "s1" },
      { kind: "hunk", hunk: hunks[1]!, hunkIndex: 1, key: "h1" },
      { kind: "same", lines: ["e"], key: "s2" },
    ];
    const next = rejectHunkInSegments(segs, hunks[0]!.id);
    const remaining = next.filter((s) => s.kind === "hunk");
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.hunk.id).toBe(hunks[1]!.id);
    expect(remaining[0]!.hunkIndex).toBe(0);
    // 拒绝第一处后，前段应变为 same，不应整篇塌成单 hunk
    expect(next[0]!.kind).toBe("same");
  });

  it("acceptHunkInSegments shifts later hunk old ranges", () => {
    const current = "a\nb\nc\nd";
    const proposed = "a\nB1\nB2\nc\nD";
    const hunks = computeLineHunks(current, proposed);
    expect(hunks.length).toBeGreaterThanOrEqual(2);
    const segs: MdInlineSeg[] = [];
    let oi = 0;
    const cur = current.split("\n");
    hunks.forEach((h, idx) => {
      if (h.oldStart > oi) {
        segs.push({ kind: "same", lines: cur.slice(oi, h.oldStart), key: `s${oi}` });
      }
      segs.push({ kind: "hunk", hunk: h, hunkIndex: idx, key: `h${idx}` });
      oi = h.oldEnd;
    });
    if (oi < cur.length) segs.push({ kind: "same", lines: cur.slice(oi), key: "send" });

    const first = hunks[0]!;
    const next = acceptHunkInSegments(segs, first.id, first.newLines);
    const remaining = next.filter((s) => s.kind === "hunk");
    expect(remaining.length).toBe(hunks.length - 1);
    const delta = first.newLines.length - first.oldLines.length;
    if (remaining[0] && hunks[1]) {
      expect(remaining[0].hunk.oldStart).toBe(hunks[1].oldStart + delta);
    }
  });
});
