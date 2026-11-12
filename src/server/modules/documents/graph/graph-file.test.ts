import { describe, it, expect } from "vitest";
import { parseArticleGraphFile, parseDirGraphFile } from "./graph-file.js";

describe("parseArticleGraphFile", () => {
  it("升格旧格式", () => {
    const f = parseArticleGraphFile({
      commitId: "c1",
      nodes: [{ id: "doc:a", type: "doc", label: "a", description: "d", confidence: 1, sources: [] }],
    });
    expect(f?.meta).toEqual({ commitId: "c1", dirty: false });
    expect(f?.edges).toEqual([]);
  });

  it("读新格式 dirty", () => {
    const f = parseArticleGraphFile({
      version: 1,
      meta: { commitId: "c2", dirty: true },
      nodes: [],
      edges: [],
    });
    expect(f?.meta.dirty).toBe(true);
  });
});

describe("parseDirGraphFile", () => {
  it("旧格式默认 dirty false", () => {
    const f = parseDirGraphFile({ nodes: [], edges: [] });
    expect(f?.meta.dirty).toBe(false);
  });
});
