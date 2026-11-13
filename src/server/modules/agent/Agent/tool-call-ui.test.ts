import { describe, expect, it } from "vitest";
import {
  formatWriteToolDetail,
  headBodyPreview,
  isWriteTool,
  streamingBodyPreview,
  toolCallCardFromArgs,
  toolCallCardFromResult,
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
    expect(toolCallLabel("mcp__memorix__memorix_search")).toBe(
      "MCP · memorix/memorix_search",
    );
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

  it("shows streamed input args on the preparing line", () => {
    expect(
      toolCallPreparingDetail("get_document_lexical_lines", {
        documentId: "doc-untitled-3",
      }),
    ).toBe("正在准备参数 · documentId=doc-untitled-3");
    expect(
      toolCallPreparingDetail(
        "get_document_lexical_lines",
        '{"documentId":"abc',
      ),
    ).toContain("documentId");
    const longId = "d".repeat(80);
    const detail = toolCallPreparingDetail("get_document_lexical_lines", {
      documentId: longId,
    })!;
    expect(detail.startsWith("正在准备参数 · documentId=")).toBe(true);
    expect(detail.length).toBeLessThanOrEqual(72);
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

  it("keeps unread tool inputs visible", () => {
    expect(
      toolCallDetailFromArgs("get_document_lexical_lines", {
        documentId: "doc-untitled-3",
      }),
    ).toBe("documentId=doc-untitled-3");
  });

  it("summarizes run_plugin_cli and exec args", () => {
    expect(
      toolCallDetailFromArgs("run_plugin_cli", {
        plugin_name: "cfl-search",
        command: "python3",
        args: ["scripts/ddwiki.py", "--help"],
      }),
    ).toContain("$ python3 scripts/ddwiki.py --help");
    expect(
      toolCallDetailFromArgs("exec", {
        command: "tar",
        args: ["-tzf", "pkg.tgz"],
      }),
    ).toContain("$ tar -tzf pkg.tgz");
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

  it("shows get_document content in the card (≤10k full)", () => {
    const body = "# 标题\n\n一段正文。";
    const detail = toolCallDetailFromResult(
      "get_document",
      {
        details: {
          displayName: "轨迹任务",
          content: body,
          contentTruncated: false,
        },
      },
      undefined,
    );
    expect(detail).toContain('已读「轨迹任务」');
    expect(detail).toContain(`${body.length} 字`);
    expect(detail).toContain("# 标题");
    expect(detail).toContain("一段正文。");
    expect(detail).not.toContain("已截断");
  });

  it("truncates get_document card body over 10k chars", () => {
    const body = "あ".repeat(10_050);
    const detail = toolCallDetailFromResult(
      "get_document",
      {
        details: {
          displayName: "长文",
          content: body,
          contentTruncated: false,
        },
      },
      undefined,
    );
    expect(detail).toContain("已截断");
    expect(detail).toContain("10050 字");
    // meta + newline + first 10000 + \n…
    const output = detail!.slice(detail!.indexOf("\n") + 1);
    expect(output.endsWith("…")).toBe(true);
    expect(output.replace(/\n…$/, "").length).toBe(10_000);
  });

  it("shows get_document_commit content in the card", () => {
    const detail = toolCallDetailFromResult(
      "get_document_commit",
      {
        details: {
          commitId: "abc12345-xxxx",
          message: "修复文案",
          content: "## 旧版\nhello",
        },
      },
      undefined,
    );
    expect(detail).toContain("已读历史「修复文案」");
    expect(detail).toContain("## 旧版");
    expect(detail).toContain("hello");
  });

  it("shows get_document_lexical_lines blocks in the card", () => {
    const detail = toolCallDetailFromResult(
      "get_document_lexical_lines",
      {
        details: {
          displayName: "笔记",
          lineCount: 2,
          truncated: false,
          lines: {
            "1": "# 标题",
            "2": "第一段正文",
          },
        },
      },
      "documentId=abc",
    );
    expect(detail).toContain('已读「笔记」');
    expect(detail).toContain("2 块");
    expect(detail).toContain("1: # 标题");
    expect(detail).toContain("2: 第一段正文");
    expect(detail).not.toBe("documentId=abc");
  });

  it("shows run_plugin_cli stdout/stderr", () => {
    const detail = toolCallDetailFromResult(
      "run_plugin_cli",
      {
        details: {
          ok: true,
          exitCode: 0,
          command: "python3",
          args: ["x.py"],
          cwd: "/tmp/home",
          stdout: "hello\nworld",
          stderr: "",
        },
      },
      "fallback",
    );
    expect(detail).toContain("exit 0");
    expect(detail).toContain("hello");
    expect(detail).toContain("── stdout ──");
  });

  it("lists plugin home entries", () => {
    const detail = toolCallDetailFromResult(
      "list_plugin_home",
      {
        details: {
          ok: true,
          plugin_name: "cfl",
          entries: ["scripts/", "scripts/run.py"],
          tree: "scripts/\n  run.py",
        },
      },
      undefined,
    );
    expect(detail).toContain("cfl");
    expect(detail).toContain("scripts/");
    expect(detail).toContain("run.py");
  });

  it("shows read_plugin_content content", () => {
    const detail = toolCallDetailFromResult(
      "read_plugin_content",
      {
        details: {
          ok: true,
          path: "scripts/a.py",
          bytes: 10,
          truncated: false,
          content: "print(1)\n",
        },
      },
      undefined,
    );
    expect(detail).toContain("scripts/a.py");
    expect(detail).toContain("print(1)");
  });
});

describe("toolCallCardFromArgs / toolCallCardFromResult", () => {
  it("splits get_document into input + output + document link fields", () => {
    const prior = toolCallCardFromArgs("get_document", {
      documentId: "doc-1",
    });
    expect(prior.input).toContain("documentId=doc-1");
    expect(prior.documentId).toBe("doc-1");

    const card = toolCallCardFromResult(
      "get_document",
      {
        details: {
          documentId: "doc-1",
          displayName: "无人车",
          content: "# 标题\n\n正文",
        },
      },
      prior,
    );
    expect(card.documentId).toBe("doc-1");
    expect(card.documentTitle).toBe("无人车");
    expect(card.summary).toBe("无人车");
    expect(card.input).toContain("documentId=doc-1");
    expect(card.output).toContain("# 标题");
  });

  it("keeps exec command as input and stdout as output", () => {
    const prior = toolCallCardFromArgs("exec", {
      command: "grep",
      args: ["-n", "foo"],
    });
    expect(prior.input).toBe("$ grep -n foo");
    const card = toolCallCardFromResult(
      "exec",
      {
        details: {
          command: "grep",
          args: ["-n", "foo"],
          exitCode: 0,
          stdout: "1:foo",
          stderr: "",
        },
      },
      prior,
    );
    expect(card.input).toBe("$ grep -n foo");
    expect(card.output).toContain("1:foo");
    expect(card.summary).toBe("exit 0");
  });
});
