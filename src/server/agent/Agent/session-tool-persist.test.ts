import { describe, expect, it } from "vitest";

import {
  extractToolResultText,
  normalizeToolArguments,
  shouldPersistToolResult,
} from "./session-tool-persist.js";

describe("session-tool-persist", () => {
  it("白名单工具才落盘", () => {
    expect(shouldPersistToolResult("get_document")).toBe(true);
    expect(shouldPersistToolResult("web_search")).toBe(true);
    expect(shouldPersistToolResult("web_fetch")).toBe(true);
    expect(shouldPersistToolResult("overwrite_document")).toBe(false);
    expect(shouldPersistToolResult("ask_user_choice")).toBe(false);
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
