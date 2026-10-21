import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../../config/index.js";
import { AgentSessionManager } from "./session-manager.js";

vi.mock("../Config/config.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../Config/config.js")>();
  return {
    ...mod,
    getVisitorAgentConfig: () => ({
      id: "cfg",
      kind: "openai",
      apiKey: "sk-test",
      modelId: "mock",
      baseUrl: "",
      contextWindow: 128_000,
      providerId: "openai",
    }),
  };
});

vi.mock("./run.js", () => ({
  createAgentModel: () => ({
    models: {
      completeSimple: async () => ({
        content: [{ type: "text", text: "这是压缩摘要：目标是写文档。" }],
      }),
    },
    model: {},
  }),
}));

vi.mock("./context-usage.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./context-usage.js")>();
  return {
    ...mod,
    estimateUsageForMessages: (
      _visitorId: string,
      messages: unknown[],
    ): { percent: number; used: number; limit: number } => {
      // 消息多 → 假装超阈值；压缩后变少 → 降下去
      const n = Array.isArray(messages) ? messages.length : 0;
      const percent = n >= 10 ? 90 : 40;
      return { percent, used: percent * 100, limit: 10_000 };
    },
  };
});

const cleanupDirs: string[] = [];

afterEach(() => {
  for (const d of cleanupDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("compactAgentSession (mocked LLM)", () => {
  it("auto skips below threshold; force/auto at high usage rewrites jsonl", async () => {
    const { compactAgentSession } = await import("./context-compact.js");
    const visitorId = randomUUID();
    cleanupDirs.push(path.join(getConfig().dataDir, "tenant", visitorId));
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });
    const { sessionId } = await mgr.createSession({});

    // 少量消息：mock 估算 < 85
    await mgr.appendUser(sessionId, "hi");
    await mgr.appendAssistant(sessionId, "hello");
    const skip = await compactAgentSession({
      visitorId,
      sessionId,
      force: false,
    });
    expect(skip.compacted).toBe(false);
    expect(skip.reason).toBe("below_threshold");

    for (let i = 0; i < 8; i++) {
      await mgr.appendUser(sessionId, `user-${i} 目标是写文档`);
      await mgr.appendAssistant(sessionId, `asst-${i}`);
    }

    const events: string[] = [];
    const result = await compactAgentSession({
      visitorId,
      sessionId,
      force: false,
      onEvent: (e) => events.push(e.type),
    });
    expect(result.compacted).toBe(true);
    expect(events).toEqual(["context_compacting", "context_compacted"]);

    const msgs = await mgr.loadMessages(sessionId);
    expect(msgs[0]?.role).toBe("user");
    if (msgs[0]?.role === "user") {
      expect(msgs[0].content).toContain("【系统·上下文压缩】");
      expect(msgs[0].content).toContain("压缩摘要");
    }
    // 保留最近 6 轮（user+assistant）= 12 + 1 summary
    expect(msgs.length).toBe(13);
  });
});
