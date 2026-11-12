import { describe, expect, it } from "vitest";

import {
  documentChangedNotice,
  extractToolResultText,
  normalizeToolArguments,
  shouldPersistToolResult,
  slimPersistArguments,
  slimPersistResultText,
} from "./session-tool-persist.js";

describe("session-tool-persist", () => {
  it("白名单含读工具与写工具", () => {
    expect(shouldPersistToolResult("get_document")).toBe(true);
    expect(shouldPersistToolResult("web_search")).toBe(true);
    expect(shouldPersistToolResult("web_fetch")).toBe(true);
    expect(shouldPersistToolResult("overwrite_document")).toBe(true);
    expect(shouldPersistToolResult("append_document")).toBe(true);
    expect(shouldPersistToolResult("replace_document_markdown")).toBe(true);
    expect(shouldPersistToolResult("ask_user_choice")).toBe(false);
  });

  it("写工具落盘参数不含全文", () => {
    expect(
      slimPersistArguments("overwrite_document", {
        documentId: "d1",
        content: "很长很长的正文".repeat(20),
      }),
    ).toEqual({ documentId: "d1" });
    expect(
      slimPersistArguments("replace_document_markdown", {
        documentId: "d1",
        find: "x".repeat(100),
        replace: "y",
      }),
    ).toEqual({
      documentId: "d1",
      findPreview: `${"x".repeat(80)}…`,
    });
  });

  it("写工具落盘结果用短 notice", () => {
    const notice = documentChangedNotice({
      documentId: "d1",
      headCommitId: "h1",
      displayName: "a.md",
    });
    const text = slimPersistResultText("append_document", {
      details: {
        status: "appended",
        documentId: "d1",
        headCommitId: "h1",
        displayName: "a.md",
        notice,
        content: "should-not-appear-in-persist",
      },
    });
    expect(text).toBe(notice);
    expect(text).not.toContain("should-not-appear");
    expect(text.length).toBeLessThan(400);
  });

  it("从 asToolResult 抽文本", () => {
    const text = extractToolResultText({
      content: [{ type: "text", text: '{"ok":true}' }],
      details: { ok: true },
    });
    expect(text).toBe('{"ok":true}');
  });

  it("无 content 时回退 details", () => {
    expect(extractToolResultText({ details: { a: 1 } })).toContain('"a": 1');
  });

  it("normalizeToolArguments", () => {
    expect(normalizeToolArguments({ q: "x" })).toEqual({ q: "x" });
    expect(normalizeToolArguments(null)).toEqual({});
  });
});
