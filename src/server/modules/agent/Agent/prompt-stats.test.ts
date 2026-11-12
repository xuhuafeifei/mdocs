import { describe, expect, it } from "vitest";

import { estimateTokens, summarizePrompt } from "./prompt-stats.js";

describe("estimateTokens", () => {
  it("空文本为 0", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("中文按字、英文按 4 字符", () => {
    expect(estimateTokens("你好")).toBe(2);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });
});

describe("summarizePrompt", () => {
  const assembled = {
    sections: [
      { id: "base" as const, label: "规则", text: "12345678" },
      { id: "soul" as const, label: "灵魂", text: "中文中文" },
    ],
    prompt: "12345678\n\n中文中文",
  };

  it("sharePercent 是段间构成，总和为 100%", () => {
    const stats = summarizePrompt(assembled);
    expect(stats.sections).toHaveLength(2);
    expect(stats.sections[0]?.chars).toBe(8);
    expect(stats.sections[1]?.chars).toBe(4);
    expect(stats.sections[0]?.sharePercent).toBeCloseTo(66.7, 1);
    expect(stats.sections.reduce((sum, s) => sum + s.sharePercent, 0)).toBeCloseTo(100, 0);
  });

  it("windowPercent 以模型上下文窗口为基数", () => {
    // 8 位数字 ≈ 2 tokens；中文 4 字 = 4 tokens；含两个换行拼成 7 tokens
    const stats = summarizePrompt(assembled, 1000);
    expect(stats.window).toBe(1000);
    expect(stats.sections[0]?.windowPercent).toBeCloseTo(0.2, 2);
    expect(stats.sections[1]?.windowPercent).toBeCloseTo(0.4, 2);
    expect(stats.total.windowPercent).toBeCloseTo(0.7, 2);
  });

  it("窗口未知时 windowPercent 为 0，不抛错", () => {
    const stats = summarizePrompt(assembled);
    expect(stats.window).toBe(0);
    expect(stats.total.windowPercent).toBe(0);
    expect(stats.sections.every((s) => s.windowPercent === 0)).toBe(true);
  });

  it("total 用拼好的完整 prompt 计长（含段间空行）", () => {
    const stats = summarizePrompt(assembled, 128000);
    expect(stats.total.chars).toBe(assembled.prompt.length);
    expect(stats.total.sections).toBe(2);
  });
});
