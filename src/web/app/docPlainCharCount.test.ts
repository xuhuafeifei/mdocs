import { describe, expect, it } from "vitest";
import {
  countDocumentPlainChars,
  plainTextFromMarkdown,
} from "./docPlainCharCount.js";

describe("docPlainCharCount", () => {
  it("empty → 0", () => {
    expect(countDocumentPlainChars("md", "")).toBe(0);
    expect(countDocumentPlainChars("html", "")).toBe(0);
  });

  it("strips heading markers but keeps title text", () => {
    const plain = plainTextFromMarkdown("# 标题\n\n正文一二三");
    expect(plain).toContain("标题");
    expect(plain).toContain("正文一二三");
    expect(plain).not.toContain("#");
    expect(countDocumentPlainChars("md", "# 标题\n\n正文一二三")).toBe(plain.length);
  });

  it("link counts label only, not URL", () => {
    const plain = plainTextFromMarkdown("看[文档](https://example.com/path)吧");
    expect(plain).toContain("文档");
    expect(plain).not.toContain("https://");
    expect(plain).not.toContain("example.com");
  });

  it("inline code content counts; emphasis markers do not", () => {
    const plain = plainTextFromMarkdown("用 `foo` 和 **粗体**");
    expect(plain).toContain("foo");
    expect(plain).toContain("粗体");
    expect(plain).not.toContain("*");
    expect(plain).not.toContain("`");
  });

  it("skips meta2 fence body", () => {
    const md = "前文\n\n```meta2\n{\"pens\":[]}\n```\n\n后文";
    const plain = plainTextFromMarkdown(md);
    expect(plain).toContain("前文");
    expect(plain).toContain("后文");
    expect(plain).not.toContain("pens");
  });

  it("lexical json uses text nodes only", () => {
    const json = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "你好世界" }],
          },
        ],
      },
    });
    expect(countDocumentPlainChars("md", json)).toBe("你好世界".length);
  });

  it("html strips tags", () => {
    expect(countDocumentPlainChars("html", "<p>你好<strong>世界</strong></p>")).toBe(
      "你好世界".length,
    );
  });
});
