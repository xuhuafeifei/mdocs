import { describe, expect, it } from "vitest";
import { stripDiffHunksFromLexicalJson } from "./stripDiffHunksFromLexicalJson";

function para(text: string) {
  return {
    type: "paragraph",
    children: [{ type: "text", text, version: 1 }],
    version: 1,
    direction: null,
    format: "",
    indent: 0,
  };
}

describe("stripDiffHunksFromLexicalJson", () => {
  it("passes through JSON without diff-hunk", () => {
    const raw = JSON.stringify({
      root: { type: "root", children: [para("hi")], version: 1 },
    });
    expect(stripDiffHunksFromLexicalJson(raw)).toBe(raw);
  });

  it("keeps insert/update hunk children (Keep All semantics)", () => {
    const kept = para("new");
    const raw = JSON.stringify({
      root: {
        type: "root",
        version: 1,
        children: [
          para("before"),
          {
            type: "diff-hunk",
            kind: "insert",
            opId: "1",
            version: 1,
            children: [kept, { type: "diff-chrome", opId: "1", kind: "insert" }],
          },
          para("after"),
        ],
      },
    });
    const out = JSON.parse(stripDiffHunksFromLexicalJson(raw, "keep")) as {
      root: { children: Array<{ type: string; children?: Array<{ text?: string }> }> };
    };
    expect(out.root.children.map((c) => c.type)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    expect(out.root.children[1]?.children?.[0]?.text).toBe("new");
    expect(out.root.children.some((c) => c.type === "diff-hunk")).toBe(false);
  });

  it("reject mode drops inserts", () => {
    const raw = JSON.stringify({
      root: {
        type: "root",
        version: 1,
        children: [
          {
            type: "diff-hunk",
            kind: "insert",
            opId: "1",
            version: 1,
            children: [para("new")],
          },
          para("keep-me"),
        ],
      },
    });
    const out = JSON.parse(stripDiffHunksFromLexicalJson(raw, "reject")) as {
      root: { children: Array<{ type: string }> };
    };
    expect(out.root.children).toHaveLength(1);
    expect(out.root.children[0]?.type).toBe("paragraph");
  });

  it("returns non-JSON unchanged", () => {
    expect(stripDiffHunksFromLexicalJson("# md")).toBe("# md");
  });
});
