import { describe, expect, it } from "vitest";
import {
  formatWriteToolDetail,
  headBodyPreview,
  isWriteTool,
  streamingBodyPreview,
  toolCallDetailFromArgs,
  toolCallDetailFromResult,
  toolCallErrorDetail,
  toolCallLabel,
  toolCallPreparingDetail,
  writeToolBodyText,
} from "./tool-call-ui.js";

describe("toolCallLabel", () => {
  it("maps known tools and falls back to raw name", () => {
    expect(toolCallLabel("set_markdown_document")).toBe("写入帮写正文");
    expect(toolCallLabel("overwrite_document")).toBe("覆写文档");
    expect(toolCallLabel("get_editor_draft")).toBe("读取本地草稿");
    expect(toolCallLabel("suggest_document_merge")).toBe("AI 合并文档冲突");
    expect(toolCallLabel("suggest_document_merge_message")).toBe("生成合并说明");
    expect(toolCallLabel("unknown_tool_xyz")).toBe("unknown_tool_xyz");
  });
});

describe("isWriteTool", () => {
  it("marks content-writing tools", () => {
    expect(isWriteTool("set_markdown_document")).toBe(true);
    expect(isWriteTool("overwrite_document")).toBe(true);
    expect(isWriteTool("sheet_overwrite")).toBe(true);
    expect(isWriteTool("search_documents")).toBe(false);
  });
});

describe("streamingBodyPreview / headBodyPreview", () => {
  it("returns short text as-is and prefixes long tail", () => {
    expect(streamingBodyPreview("短文")).toBe("短文");
    const long = "x".repeat(300);
    const preview = streamingBodyPreview(long, 220);
    expect(preview.startsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(221);
  });

  it("truncates head with ellipsis", () => {
    const long = "a".repeat(100) + "\n" + "b".repeat(500);
    const preview = headBodyPreview(long, 120);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThan(long.length);
  });
});

describe("formatWriteToolDetail", () => {
  it("joins meta and body on separate lines", () => {
    expect(formatWriteToolDetail("已写入 · 3 字", "abc", "head")).toBe(
      "已写入 · 3 字\nabc",
    );
    expect(formatWriteToolDetail("正在写入…", "", "tail")).toBe("正在写入…");
  });
});

describe("writeToolBodyText", () => {
  it("reads markdown / content / sheet rows", () => {
    expect(
      writeToolBodyText("set_markdown_document", { markdown: "# hi" }),
    ).toBe("# hi");
    expect(
      writeToolBodyText("overwrite_document", { content: "正文" }),
    ).toBe("正文");
    expect(
      writeToolBodyText("sheet_set_cells", {
        cells: [{ column: "名称", value: "A" }],
      }),
    ).toContain("名称: A");
  });
});

describe("toolCallPreparingDetail", () => {
  it("grows overwrite/coding body incrementally instead of tail-only", () => {
    expect(toolCallPreparingDetail("overwrite_document", {})).toBe(
      "正在写入…",
    );
    const detail = toolCallPreparingDetail("set_markdown_document", {
      markdown: "第一段引言。\n第二段正在往下写。",
    });
    expect(detail).toBeDefined();
    expect(detail!).toContain("约 16 字");
    expect(detail!).toContain("第一段引言");
    expect(detail!).toContain("第二段正在往下写");
    expect(detail!.startsWith("…")).toBe(false);
  });

  it("falls back for unknown tool name", () => {
    expect(toolCallPreparingDetail("tool", null)).toBe("正在准备调用…");
    expect(toolCallPreparingDetail("search_documents", {})).toBe(
      "正在准备参数…",
    );
  });
});

describe("toolCallDetailFromArgs", () => {
  it("summarizes markdown write with scrollable body", () => {
    const detail = toolCallDetailFromArgs("set_markdown_document", {
      markdown: "# 标题\n\n正文一段",
    });
    expect(detail).toContain("写入中");
    expect(detail).toContain("# 标题");
    expect(detail).toContain("正文一段");
    expect(detail).toMatch(/\d+ 字/);
  });

  it("summarizes overwrite with content preview", () => {
    const detail = toolCallDetailFromArgs("overwrite_document", {
      documentId: "abcdefghijklmnop",
      content: "第一行内容\n第二行",
    });
    expect(detail).toContain("文档 abcdefgh");
    expect(detail).toContain("第一行内容");
    expect(detail).toContain("第二行");
  });

  it("returns search query", () => {
    expect(
      toolCallDetailFromArgs("search_documents", { query: "权限模型" }),
    ).toBe("权限模型");
  });
});

describe("toolCallErrorDetail", () => {
  it("prefers content text / message from tool error result", () => {
    expect(
      toolCallErrorDetail({
        content: [{ type: "text", text: "requireDocumentId is not defined" }],
      }),
    ).toBe("requireDocumentId is not defined");
    expect(toolCallErrorDetail({ message: "boom" })).toBe("boom");
    expect(toolCallErrorDetail(null, "写入中")).toBe("写入中");
    expect(toolCallErrorDetail(null)).toBe("工具执行失败");
  });
});

describe("toolCallDetailFromResult", () => {
  it("keeps scrollable body for set_markdown_document", () => {
    const detail = toolCallDetailFromResult(
      "set_markdown_document",
      { details: { markdown: "## 草稿\nhello\nworld" } },
      "fallback",
    );
    expect(detail).toMatch(/^已写入 · \d+ 字/);
    expect(detail).toContain("## 草稿");
    expect(detail).toContain("hello");
  });

  it("reuses args preview when overwrite result has no body", () => {
    const detail = toolCallDetailFromResult(
      "overwrite_document",
      { details: { status: "overwritten", displayName: "周报" } },
      "覆写中 · 12 字\n周一完成三项",
    );
    expect(detail).toContain("已覆写「周报」");
    expect(detail).toContain("周一完成三项");
  });

  it("uses fallback when result has no useful detail", () => {
    expect(
      toolCallDetailFromResult("list_tree", { details: {} }, "目录预览"),
    ).toBe("目录预览");
  });
});
