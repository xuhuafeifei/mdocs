import { describe, expect, it } from "vitest";
import { rebuildProposedFromEdits } from "./AiWriteMarkdownPane";
import { computeLineHunks, type MdHunk } from "./markdown-hunks";

type Seg =
  | { kind: "same"; lines: string[]; key: string }
  | { kind: "hunk"; hunk: MdHunk; hunkIndex: number; key: string };

function segmentsFrom(current: string, proposed: string): Seg[] {
  const hunks = computeLineHunks(current, proposed);
  const cur = current === "" ? [] : current.split("\n");
  const segs: Seg[] = [];
  let oi = 0;
  hunks.forEach((h, idx) => {
    if (h.oldStart > oi) {
      segs.push({ kind: "same", lines: cur.slice(oi, h.oldStart), key: `s-${oi}` });
    }
    segs.push({ kind: "hunk", hunk: h, hunkIndex: idx, key: `h-${idx}` });
    oi = h.oldEnd;
  });
  if (oi < cur.length) segs.push({ kind: "same", lines: cur.slice(oi), key: "s-end" });
  return segs;
}

describe("rebuildProposedFromEdits", () => {
  it("拼回相同行与绿增，忽略红删", () => {
    const current = "a\nb\nc";
    const proposed = "a\nB\nc";
    const segments = segmentsFrom(current, proposed);
    const sameTexts = segments.filter((s) => s.kind === "same").map((s) => s.lines.join("\n"));
    const newTexts = segments
      .filter((s): s is Extract<Seg, { kind: "hunk" }> => s.kind === "hunk")
      .map((s) => s.hunk.newLines.join("\n"));
    expect(rebuildProposedFromEdits(segments, { sameTexts, newTexts })).toBe(proposed);
  });

  it("手改绿行写入提案", () => {
    const current = "a\nb\nc";
    const proposed = "a\nB\nc";
    const segments = segmentsFrom(current, proposed);
    const sameTexts = segments.filter((s) => s.kind === "same").map((s) => s.lines.join("\n"));
    const rebuilt = rebuildProposedFromEdits(segments, {
      sameTexts,
      newTexts: ["BB"],
    });
    expect(rebuilt).toBe("a\nBB\nc");
  });
});
