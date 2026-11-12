import { describe, expect, it } from "vitest";
import type { Model } from "@earendil-works/pi-ai";

import { hydrateSessionMessagesToPi } from "./hydrate-messages.js";
import { ATTACHMENT_READ_TOOL } from "../attachments/session-rows.js";

const fakeModel = {
  id: "test-model",
  api: "openai-completions",
  provider: "test",
} as Model<any>;

const userRow = {
  role: "user" as const,
  content: "这份表帮我看下差异",
  assets: [{ id: "a1", name: "report.xlsx", mime: "text/xlsx", bytes: 68_296 }],
};

const sheetRow = {
  role: "tool" as const,
  toolCallId: "uattach-a1",
  toolName: ATTACHMENT_READ_TOOL,
  arguments: { assetId: "a1" },
  resultText: '{"sheets":[{"name":"S","rows":[{"a":1}]}]}',
};

describe("hydrateSessionMessagesToPi 附件重放", () => {
  it("小表格的 tool 行在下一轮仍能还原成可读正文", () => {
    const { messages } = hydrateSessionMessagesToPi(
      "v1",
      [userRow, sheetRow, { role: "assistant", content: "差异在第三行" }],
      fakeModel,
    );

    expect(messages).toHaveLength(4);
    expect(messages[0]).toMatchObject({ role: "user", content: "这份表帮我看下差异" });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      stopReason: "toolUse",
      content: [
        { type: "toolCall", id: "uattach-a1", name: ATTACHMENT_READ_TOOL, arguments: { assetId: "a1" } },
      ],
    });
    expect(messages[2]).toMatchObject({
      role: "toolResult",
      toolCallId: "uattach-a1",
      toolName: ATTACHMENT_READ_TOOL,
      isError: false,
      content: [{ type: "text", text: sheetRow.resultText }],
    });
  });

  it("图片只留下带 assetId 的调用提示，不落字节", () => {
    const { messages } = hydrateSessionMessagesToPi(
      "v1",
      [
        { role: "user" as const, content: "这张图说了什么", assets: [] },
        {
          role: "tool" as const,
          toolCallId: "uattach-img1",
          toolName: ATTACHMENT_READ_TOOL,
          arguments: { assetId: "img1" },
          resultText: '[图片附件未内嵌] assetId=img1（shot.png，image/png，614KB）。需要看图时调用工具 read_attachment，参数 { "assetId": "img1" }，会直接返回图像。',
        },
      ],
      fakeModel,
    );

    const result = messages.find((m) => m.role === "toolResult");
    expect(result).toBeDefined();
    const text = (result as { content: Array<{ type: string; text?: string }> }).content[0];
    expect(text?.text).toContain(ATTACHMENT_READ_TOOL);
    expect(text?.text).toContain('"assetId": "img1"');
  });

  it("pipeline 模式没有 read_attachment：跳过附件 tool 行，并在 user 行补一句引用", () => {
    const { messages } = hydrateSessionMessagesToPi(
      "v1",
      [userRow, sheetRow],
      fakeModel,
      undefined,
      "plugin-pipeline",
    );

    expect(messages.some((m) => m.role === "toolResult")).toBe(false);
    expect(messages.some((m) => m.role === "assistant")).toBe(false);
    expect(messages).toHaveLength(1);
    const only = messages[0] as { role: string; content: string };
    expect(only.role).toBe("user");
    expect(only.content).toContain("这份表帮我看下差异");
    expect(only.content).toContain("report.xlsx");
    expect(only.content).toContain("不支持");
  });

  it("normal 模式没有附件历史时不加多余提示", () => {
    const { messages } = hydrateSessionMessagesToPi(
      "v1",
      [{ role: "user", content: "普通问题" }],
      fakeModel,
    );
    expect(messages).toHaveLength(1);
    expect((messages[0] as { content: string }).content).toBe("普通问题");
  });
});
