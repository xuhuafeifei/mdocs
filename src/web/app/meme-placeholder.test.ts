import { describe, expect, it } from "vitest";

import { memeIdFromSrc, renderMemePlaceholders } from "./meme-placeholder.js";

describe("renderMemePlaceholders", () => {
  it("把占位符换成站内图片地址", () => {
    expect(renderMemePlaceholders("明天见 [meme:s001]")).toBe(
      "明天见 ![表情](/api/memes/image/s001)",
    );
  });

  it("全角括号与全角冒号也认", () => {
    expect(renderMemePlaceholders("［meme：s001］")).toBe("![表情](/api/memes/image/s001)");
  });

  it("一条消息里多个占位符按顺序替换", () => {
    expect(renderMemePlaceholders("[meme:a1] 和 [meme:b2]")).toBe(
      "![表情](/api/memes/image/a1) 和 ![表情](/api/memes/image/b2)",
    );
  });

  it("代码块与行内代码里不替换", () => {
    const text = [
      "协议是 `[meme:s001]`",
      "",
      "```",
      "[meme:s002]",
      "```",
      "",
      "正文 [meme:s003]",
    ].join("\n");
    const out = renderMemePlaceholders(text);
    expect(out).toContain("`[meme:s001]`");
    expect(out).toContain("[meme:s002]");
    expect(out).not.toContain("/api/memes/image/s001");
    expect(out).not.toContain("/api/memes/image/s002");
    // 代码块外面的照常替换
    expect(out).toContain("/api/memes/image/s003");
  });

  it("非法 id 原样保留（不制造破图）", () => {
    for (const raw of ["[meme:]", "[meme:带中文]", "[meme:a b]", "[meme:../etc/passwd]"]) {
      expect(renderMemePlaceholders(raw)).toBe(raw);
    }
  });

  it("没有占位符的正文原样返回", () => {
    const text = "普通回复，没有表情包。";
    expect(renderMemePlaceholders(text)).toBe(text);
  });
});

describe("memeIdFromSrc", () => {
  it("从图片地址里取回 id", () => {
    expect(memeIdFromSrc("/api/memes/image/s001")).toBe("s001");
  });

  it("别的地址不算表情包", () => {
    expect(memeIdFromSrc("/api/agent/attachments/x1")).toBeNull();
    expect(memeIdFromSrc(undefined)).toBeNull();
  });
});
