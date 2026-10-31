import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_READ_TOOL,
  attachmentToolCallId,
  attachmentToolHint,
  buildAttachmentToolRow,
} from "./session-rows.js";
import {
  PERSIST_PREVIEW_MIN_CHARS,
  PERSIST_TEXT_MAX_CHARS,
  assetParseTypeOf,
  shouldPersistAssetBody,
} from "./types.js";

const asset = (name: string, bytes = 1024, id = "a1") => ({
  id,
  name,
  mime: "application/octet-stream",
  bytes,
});

describe("assetParseTypeOf", () => {
  it("classifies images / pdf / text", () => {
    expect(assetParseTypeOf("x.png")).toBe("image");
    expect(assetParseTypeOf("x.JPEG")).toBe("image");
    expect(assetParseTypeOf("x.webp")).toBe("image");
    expect(assetParseTypeOf("x.pdf")).toBe("pdf");
    expect(assetParseTypeOf("x.xlsx")).toBe("text");
    expect(assetParseTypeOf("x.csv")).toBe("text");
  });
});

describe("shouldPersistAssetBody", () => {
  it("never persists image bytes", () => {
    expect(shouldPersistAssetBody("image", 10)).toBe(false);
  });
  it("persists text up to the char cap and refuses above", () => {
    expect(shouldPersistAssetBody("text", PERSIST_TEXT_MAX_CHARS)).toBe(true);
    expect(shouldPersistAssetBody("text", PERSIST_TEXT_MAX_CHARS + 1)).toBe(false);
  });
  it("judges by parsed chars, not by file bytes", () => {
    // 67KB 的表展开成 32 万字符：字节很小但解析结果巨大
    expect(shouldPersistAssetBody("text", 324_141)).toBe(false);
  });
});

describe("buildAttachmentToolRow", () => {
  it("stores parsed text for small spreadsheets", () => {
    const row = buildAttachmentToolRow({
      asset: asset("report.xlsx"),
      parsedText: '{"sheets":[{"name":"S","rows":[{"a":1}]}]}',
    });
    expect(row.toolName).toBe(ATTACHMENT_READ_TOOL);
    expect(row.toolCallId).toBe(attachmentToolCallId("a1"));
    expect(row.arguments).toEqual({ assetId: "a1" });
    expect(row.resultText).toContain('"rows"');
    expect(row.isError).toBeUndefined();
  });

  it("falls back to the preview when parsed text exceeds the cap", () => {
    // 小文件、长解析结果：必须落预览而不是整段正文
    const longText = Array.from({ length: 5000 }, (_, i) => `{"row":${i}}`).join("\n");
    const row = buildAttachmentToolRow({
      asset: asset("big-sheet.xlsx", 67 * 1024),
      parsedText: longText,
    });
    expect(row.resultText).toContain("仅落预览");
    expect(row.resultText).toContain(ATTACHMENT_READ_TOOL);
    expect(row.resultText).toContain('"assetId": "a1"');
    // 预览控制在 cap 附近，不能把全文塞进去
    expect(row.resultText.length).toBeLessThan(PERSIST_TEXT_MAX_CHARS * 2);
    expect(row.resultText).toContain('{"row":0}');
  });

  it("keeps at least a few lines of preview so the header is visible", () => {
    const lines = ["header-a,header-b", ...Array.from({ length: 4000 }, (_, i) => `${i},v${i}`)];
    const row = buildAttachmentToolRow({
      asset: asset("wide.csv", 80 * 1024),
      parsedText: lines.join("\n"),
    });
    expect(row.resultText).toContain("header-a,header-b");
    expect(row.resultText.length).toBeGreaterThanOrEqual(PERSIST_PREVIEW_MIN_CHARS);
  });

  it("never stores image bytes, only a read-it-yourself notice", () => {
    const row = buildAttachmentToolRow({
      asset: asset("shot.png", 628_617),
      parsedText: "IGNORED",
    });
    expect(row.toolName).toBe(ATTACHMENT_READ_TOOL);
    expect(row.resultText).toContain("图片附件未内嵌");
    expect(row.resultText).toContain(ATTACHMENT_READ_TOOL);
    expect(row.resultText).toContain('"assetId": "a1"');
    expect(row.resultText).not.toContain("IGNORED");
    expect(row.resultText).toContain("shot.png");
  });

  it("pdf is deferred to the tool as well", () => {
    const row = buildAttachmentToolRow({ asset: asset("doc.pdf") });
    expect(row.resultText).toContain("PDF");
    expect(row.resultText).toContain(ATTACHMENT_READ_TOOL);
  });

  it("records parse errors as isError with recovery hint", () => {
    const row = buildAttachmentToolRow({
      asset: asset("broken.xlsx"),
      parseError: "无法解析 Excel",
    });
    expect(row.isError).toBe(true);
    expect(row.resultText).toContain("无法解析 Excel");
    expect(row.resultText).toContain(ATTACHMENT_READ_TOOL);
  });

  it("falls back to the hint when no parsed text is available", () => {
    const row = buildAttachmentToolRow({ asset: asset("plain.txt") });
    expect(row.resultText).toBe(attachmentToolHint(asset("plain.txt")));
  });

  it("tool call id is stable for the same asset", () => {
    expect(attachmentToolCallId("x")).toBe(attachmentToolCallId("x"));
  });
});
