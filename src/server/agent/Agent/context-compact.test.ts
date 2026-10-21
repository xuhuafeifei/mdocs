import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../../config/index.js";
import {
  AgentSessionManager,
  type AgentSessionMessage,
} from "./session-manager.js";
import {
  SessionCompactingError,
  acquireCompactLock,
  assertNotCompacting,
} from "./context-compact-lock.js";
import {
  CONTEXT_COMPACT_KEEP_TURNS,
  partitionForCompact,
  splitTurns,
} from "./context-compact.js";

const cleanupDirs: string[] = [];

afterEach(() => {
  for (const d of cleanupDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

function user(content: string): AgentSessionMessage {
  return { role: "user", content };
}

function assistant(content: string): AgentSessionMessage {
  return { role: "assistant", content };
}

function tool(n: number): AgentSessionMessage {
  return {
    role: "tool",
    toolCallId: `tc-${n}`,
    toolName: "get_document",
    arguments: { documentId: `d-${n}` },
    resultText: `body-${n}`,
  };
}

describe("splitTurns / partitionForCompact", () => {
  it("keeps last K turns and folds earlier ones", () => {
    const messages: AgentSessionMessage[] = [];
    for (let i = 0; i < 10; i++) {
      messages.push(user(`u${i}`), tool(i), assistant(`a${i}`));
    }
    const { toSummarize, toKeep } = partitionForCompact(
      messages,
      CONTEXT_COMPACT_KEEP_TURNS,
    );
    expect(splitTurns(messages)).toHaveLength(10);
    expect(splitTurns(toKeep)).toHaveLength(CONTEXT_COMPACT_KEEP_TURNS);
    expect(splitTurns(toSummarize)).toHaveLength(10 - CONTEXT_COMPACT_KEEP_TURNS);
    expect(toKeep[0]).toEqual(user("u4"));
    expect(toSummarize.at(-1)).toEqual(assistant("a3"));
  });

  it("skips when turns <= K", () => {
    const messages = [user("a"), assistant("b"), user("c"), assistant("d")];
    const { toSummarize, toKeep } = partitionForCompact(messages, 6);
    expect(toSummarize).toEqual([]);
    expect(toKeep).toEqual(messages);
  });
});

describe("compact lock + replaceTranscript", () => {
  it("blocks append while compacting and writes summary + keep", async () => {
    const visitorId = randomUUID();
    cleanupDirs.push(path.join(getConfig().dataDir, "tenant", visitorId));
    const mgr = new AgentSessionManager(visitorId, { kind: "normal" });
    const { sessionId } = await mgr.createSession({});
    for (let i = 0; i < 8; i++) {
      await mgr.appendUser(sessionId, `user-${i}`);
      await mgr.appendAssistant(sessionId, `asst-${i}`);
    }

    const release = await mgr.acquireSessionCompactLock(sessionId);
    expect(mgr.isCompacting(sessionId)).toBe(true);
    await expect(mgr.appendUser(sessionId, "during")).rejects.toBeInstanceOf(
      SessionCompactingError,
    );

    const before = await mgr.loadMessages(sessionId);
    const { toSummarize, toKeep } = partitionForCompact(before);
    expect(toSummarize.length).toBeGreaterThan(0);

    await mgr.replaceTranscript(
      sessionId,
      [
        {
          role: "user",
          content: "【系统·上下文压缩】\n\n摘要内容",
        },
        ...toKeep,
      ],
      { markSummary: true },
    );

    const after = await mgr.loadMessages(sessionId);
    expect(after[0]?.role).toBe("user");
    if (after[0]?.role === "user") {
      expect(after[0].content).toContain("【系统·上下文压缩】");
    }
    expect(after.length).toBe(1 + toKeep.length);

    const jsonl = fs.readFileSync(mgr.jsonlFilePath(sessionId), "utf8");
    expect(jsonl).toContain("context_compact_summary");
    const dir = path.dirname(mgr.jsonlFilePath(sessionId));
    const baks = fs.readdirSync(dir).filter((n) => n.includes(".bak-compact-"));
    expect(baks.length).toBeGreaterThanOrEqual(1);

    await release();
    expect(mgr.isCompacting(sessionId)).toBe(false);
    await mgr.appendUser(sessionId, "after-ok");
  });

  it("acquireCompactLock is exclusive", async () => {
    const dir = path.join(
      getConfig().dataDir,
      "tenant",
      randomUUID(),
      "agent",
      "session",
    );
    cleanupDirs.push(path.dirname(path.dirname(path.dirname(dir))));
    fs.mkdirSync(dir, { recursive: true });
    const jsonl = path.join(dir, `${randomUUID()}.jsonl`);
    const sid = randomUUID();
    const release = await acquireCompactLock(jsonl, sid);
    await expect(acquireCompactLock(jsonl, sid)).rejects.toBeInstanceOf(
      SessionCompactingError,
    );
    expect(() => assertNotCompacting(jsonl, sid)).toThrow(SessionCompactingError);
    await release();
    expect(() => assertNotCompacting(jsonl, sid)).not.toThrow();
  });
});
