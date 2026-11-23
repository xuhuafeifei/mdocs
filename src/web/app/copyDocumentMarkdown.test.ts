import { describe, expect, it } from "vitest";
import { stripExcessBlankLinesFromMarkdown } from "./copyDocumentMarkdown";

describe("stripExcessBlankLinesFromMarkdown", () => {
  it("collapses paragraph blank lines to single newlines", () => {
    const md = "第一段\n\n第二段\n\n\n第三段\n";
    expect(stripExcessBlankLinesFromMarkdown(md)).toBe("第一段\n第二段\n第三段\n");
  });

  it("normalizes CRLF", () => {
    expect(stripExcessBlankLinesFromMarkdown("a\r\n\r\nb\r\n")).toBe("a\nb\n");
  });
});
