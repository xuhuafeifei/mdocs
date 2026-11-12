import { describe, expect, it } from "vitest";
import { markdownToLexicalJson } from "./markdown-to-lexical.js";
import { lexicalJsonToLexicalLines } from "./lexical-to-markdown.js";
import {
  applyPatchLineDecisions,
  buildProposedLexicalJson,
} from "./lexical-lines.js";

describe("lexical lines", () => {
  it("numbers outer blocks 1-based", () => {
    const lex = markdownToLexicalJson("# A\n\npara\n\n- x\n");
    const lines = lexicalJsonToLexicalLines(lex);
    expect(lines).not.toBeNull();
    expect(Object.keys(lines!).sort()).toEqual(["1", "2", "3"]);
    expect(lines!["1"]).toMatch(/^# A/);
  });

  it("patch replaces only accepted doors", () => {
    const base = markdownToLexicalJson("one\n\ntwo\n\nthree\n");
    const next = applyPatchLineDecisions(
      base,
      { "2": "TWO\n" },
      { "2": "accepted" },
    );
    const lines = lexicalJsonToLexicalLines(next)!;
    expect(lines["1"]).toMatch(/one/);
    expect(lines["2"]).toMatch(/TWO/);
    expect(lines["3"]).toMatch(/three/);
  });

  it("replace_all from markdown", () => {
    const base = markdownToLexicalJson("old\n");
    const next = buildProposedLexicalJson(base, "replace_all", {}, "# New\n");
    const lines = lexicalJsonToLexicalLines(next)!;
    expect(lines["1"]).toMatch(/^# New/);
  });
});
