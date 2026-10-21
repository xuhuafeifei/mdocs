import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../../config/index.js";
import {
  AgentSessionManager,
  chatVisibleMessages,
  getAgentSessionForApi,
} from "./session-manager.js";

const cleanupDirs: string[] = [];

afterEach(() => {
  for (const d of cleanupDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tenantDir(visitorId: string): string {
  const root = path.join(getConfig().dataDir, "tenant", visitorId);
  cleanupDirs.push(root);
  return root;
}

describe("AgentSessionManager method-level queue", () => {
  it("concurrent createSession keeps all sessions in meta (no lost update)", async () => {
    const visitorId = randomUUID();
    tenantDir(visitorId);
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });

    const n = 12;
    const created = await Promise.all(
      Array.from({ length: n }, () => mgr.createSession()),
    );
    const ids = new Set(created.map((c) => c.sessionId));
    expect(ids.size).toBe(n);

    const listed = await mgr.listSessions();
    expect(listed.sessions).toHaveLength(n);
    expect(new Set(listed.sessions.map((s) => s.id))).toEqual(ids);
  });

  it("concurrent appendUser serializes jsonl lines and preserves session entry", async () => {
    const visitorId = randomUUID();
    tenantDir(visitorId);
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });
    const { sessionId } = await mgr.createSession();

    const n = 15;
    await Promise.all(
      Array.from({ length: n }, (_, i) => mgr.appendUser(sessionId, `msg-${i}`)),
    );

    const { messages } = await mgr.loadLastOpenedMessages();
    expect(messages.filter((m) => m.role === "user")).toHaveLength(n);

    const listed = await mgr.listSessions();
    expect(listed.sessions.some((s) => s.id === sessionId)).toBe(true);
    expect(listed.sessions.length).toBeGreaterThanOrEqual(1);
  });

  it("createSession interleaved with appendUser does not wipe meta to one foreign session", async () => {
    const visitorId = randomUUID();
    tenantDir(visitorId);
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });
    const first = await mgr.createSession();
    await mgr.appendUser(first.sessionId, "anchor");

    await Promise.all([
      mgr.createSession(),
      mgr.createSession(),
      mgr.appendUser(first.sessionId, "more"),
      mgr.createSession(),
      mgr.appendAssistant(first.sessionId, "reply"),
    ]);

    const listed = await mgr.listSessions();
    expect(listed.sessions.length).toBeGreaterThanOrEqual(4);
    expect(listed.sessions.some((s) => s.id === first.sessionId)).toBe(true);

    await mgr.openSession(first.sessionId);
    const { messages } = await mgr.loadLastOpenedMessages();
    expect(
      chatVisibleMessages(messages).map((m) => m.content),
    ).toEqual(expect.arrayContaining(["anchor", "more", "reply"]));
  });

  it("appendToolExchange 落盘且 API 过滤 tool 行", async () => {
    const visitorId = randomUUID();
    tenantDir(visitorId);
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });
    const { sessionId } = await mgr.createSession();
    await mgr.appendUser(sessionId, "搜一下");
    await mgr.appendToolExchange(sessionId, {
      toolCallId: "tc-1",
      toolName: "web_search",
      arguments: { query: "mdocs" },
      resultText: '{"results":[]}',
    });
    await mgr.appendAssistant(sessionId, "没搜到");

    const full = await mgr.loadLastOpenedMessages();
    expect(full.messages.map((m) => m.role)).toEqual([
      "user",
      "tool",
      "assistant",
    ]);

    const api = await getAgentSessionForApi(visitorId, "normal");
    expect(api.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(api.messages.every((m) => "content" in m)).toBe(true);
  });
});
