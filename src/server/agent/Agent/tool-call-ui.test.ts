import { describe, expect, it } from "vitest";
import {
  toolCallDetailFromArgs,
  toolCallDetailFromResult,
  toolCallLabel,
} from "./tool-call-ui.js";

describe("toolCallLabel", () => {
  it("maps known tools and falls back to raw name", () => {
    expect(toolCallLabel("set_markdown_document")).toBe("写入帮写正文");
    expect(toolCallLabel("overwrite_document")).toBe("覆写文档");
    expect(toolCallLabel("unknown_tool_xyz")).toBe("unknown_tool_xyz");
  });
});

describe("toolCallDetailFromArgs", () => {
  it("summarizes markdown write with first line and length", () => {
    const detail = toolCallDetailFromArgs("set_markdown_document", {
      markdown: "# 标题\n\n正文一段",
    });
    expect(detail).toContain("# 标题");
    expect(detail).toMatch(/\d+ 字/);
  });

  it("summarizes overwrite with content preview", () => {
    const detail = toolCallDetailFromArgs("overwrite_document", {
      documentId: "abcdefghijklmnop",
      content: "第一行内容\n第二行",
    });
    expect(detail).toContain("文档 abcdefgh");
    expect(detail).toContain("第一行内容");
  });

  it("returns search query", () => {
    expect(
      toolCallDetailFromArgs("search_documents", { query: "权限模型" }),
    ).toBe("权限模型");
  });
});

describe("toolCallDetailFromResult", () => {
  it("prefers result summary for set_markdown_document", () => {
    expect(
      toolCallDetailFromResult(
        "set_markdown_document",
        { details: { markdown: "## 草稿\nhello" } },
        "fallback",
      ),
    ).toMatch(/^已写入 · ## 草稿/);
  });

  it("uses fallback when result has no useful detail", () => {
    expect(
      toolCallDetailFromResult("list_tree", { details: {} }, "目录预览"),
    ).toBe("目录预览");
  });

  it("formats overwrite success", () => {
    expect(
      toolCallDetailFromResult("overwrite_document", {
        details: { status: "overwritten", displayName: "周报" },
      }),
    ).toBe("已覆写「周报」");
  });
});
