import { describe, expect, it } from "vitest";
import { canAiMerge } from "../../shared/file-type-policy.js";
import { __test } from "./suggest-merge-resolutions.js";

const { parseConflictMarkdown, tryAutoResolve, parseJsonStringArray } = __test;

describe("canAiMerge", () => {
  it("allows md/html, rejects sheet", () => {
    expect(canAiMerge("md")).toBe(true);
    expect(canAiMerge("html")).toBe(true);
    expect(canAiMerge("sheet")).toBe(false);
  });
});

describe("parseConflictMarkdown", () => {
  it("parses git conflicts and text", () => {
    const md = [
      "head",
      "<<<<<<< local",
      "L",
      "=======",
      "R",
      ">>>>>>> remote",
      "tail",
    ].join("\n");
    const parts = parseConflictMarkdown(md);
    expect(parts).toEqual([
      { kind: "text", text: "head" },
      { kind: "conflict", local: "L", remote: "R", base: "" },
      { kind: "text", text: "tail" },
    ]);
  });

  it("parses diff3 base", () => {
    const md = [
      "<<<<<<< local",
      "L",
      "||||||| base",
      "B",
      "=======",
      "R",
      ">>>>>>> remote",
    ].join("\n");
    const parts = parseConflictMarkdown(md);
    expect(parts[0]).toEqual({ kind: "conflict", local: "L", remote: "R", base: "B" });
  });
});

describe("tryAutoResolve", () => {
  it("takes remote when local blank", () => {
    expect(tryAutoResolve({ kind: "conflict", local: "\n", remote: "story", base: "" })).toBe(
      "story",
    );
  });

  it("returns null when both sides have content", () => {
    expect(tryAutoResolve({ kind: "conflict", local: "a", remote: "b", base: "" })).toBeNull();
  });
});

describe("parseJsonStringArray", () => {
  it("parses fenced json", () => {
    expect(parseJsonStringArray('```json\n["a","b"]\n```', 2)).toEqual(["a", "b"]);
  });
});
