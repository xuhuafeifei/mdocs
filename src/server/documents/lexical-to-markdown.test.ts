import { describe, it, expect } from "vitest";
import { markdownToLexicalJson } from "./markdown-to-lexical.js";
import { lexicalJsonToMarkdown } from "./lexical-to-markdown.js";

describe("lexicalJsonToMarkdown", () => {
  it("round-trips basic markdown structure", () => {
    const src = [
      "# Title",
      "",
      "Hello **bold** and *italic*.",
      "",
      "- a",
      "- b",
      "",
      "```js",
      "const x = 1;",
      "```",
      "",
    ].join("\n");
    const lexical = markdownToLexicalJson(src);
    const back = lexicalJsonToMarkdown(lexical);
    expect(back).toContain("# Title");
    expect(back).toContain("**bold**");
    expect(back).toMatch(/\*italic\*/);
    expect(back).toContain("- a");
    expect(back).toContain("```js");
    expect(back).toContain("const x = 1;");
  });

  it("returns non-json as-is", () => {
    expect(lexicalJsonToMarkdown("plain")).toBe("plain");
  });

  it("preserves link", () => {
    const lexical = markdownToLexicalJson("[mdocs](https://example.com)");
    const back = lexicalJsonToMarkdown(lexical);
    expect(back).toContain("[mdocs](https://example.com)");
  });
});
