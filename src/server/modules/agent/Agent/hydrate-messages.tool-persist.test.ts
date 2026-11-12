import { describe, expect, it } from "vitest";
import type { Model } from "@earendil-works/pi-ai";

import { hydrateSessionMessagesToPi } from "./hydrate-messages.js";

const fakeModel = {
  id: "test-model",
  api: "openai-completions",
  provider: "test",
} as Model<any>;

describe("hydrateSessionMessagesToPi tool persist", () => {
  it("把 role=tool 还原成 toolCall + toolResult", () => {
    const { messages } = hydrateSessionMessagesToPi(
      "visitor-1",
      [
        { role: "user", content: "读一下这篇" },
        {
          role: "tool",
          toolCallId: "call-1",
          toolName: "get_document",
          arguments: { documentId: "doc-1", format: "text" },
          resultText: '{"documentId":"doc-1","content":"hello"}',
        },
        { role: "assistant", content: "正文是 hello" },
      ],
      fakeModel,
    );

    expect(messages).toHaveLength(4);
    expect(messages[0]).toMatchObject({ role: "user", content: "读一下这篇" });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      stopReason: "toolUse",
      content: [
        {
          type: "toolCall",
          id: "call-1",
          name: "get_document",
          arguments: { documentId: "doc-1", format: "text" },
        },
      ],
    });
    expect(messages[2]).toMatchObject({
      role: "toolResult",
      toolCallId: "call-1",
      toolName: "get_document",
      isError: false,
      content: [{ type: "text", text: '{"documentId":"doc-1","content":"hello"}' }],
    });
    expect(messages[3]).toMatchObject({
      role: "assistant",
      stopReason: "stop",
      content: [{ type: "text", text: "正文是 hello" }],
    });
  });
});
