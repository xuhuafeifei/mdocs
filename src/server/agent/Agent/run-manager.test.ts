import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../../config/index.js";

vi.mock("../Config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../Config/config.js")>();
  return {
    ...actual,
    getVisitorAgentConfig: vi.fn(() => ({
      runTimeoutSeconds: 300,
    })),
  };
});

vi.mock("./run.js", () => ({
  runOnboardingChat: vi.fn(),
}));

vi.mock("./session-manager.js", () => ({
  AgentSessionManager: class {
    async loadLastOpenedMessages() {
      return { sessionId: "sess-fixed", messages: [] };
    }
    isCompacting() {
      return false;
    }
  },
}));

import { getVisitorAgentConfig } from "../Config/config.js";
import { runOnboardingChat } from "./run.js";
import {
  AgentRunActiveError,
  cancelAgentRun,
  getActiveRunForSession,
  startAgentRun,
  subscribeAgentRun,
} from "./run-manager.js";

const cleanupDirs: string[] = [];
const mockedRun = vi.mocked(runOnboardingChat);

beforeEach(() => {
  mockedRun.mockReset();
  vi.mocked(getVisitorAgentConfig).mockReturnValue({
    runTimeoutSeconds: 300,
  } as ReturnType<typeof getVisitorAgentConfig>);
});

afterEach(() => {
  for (const d of cleanupDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("AgentRunManager", () => {
  it("keeps run alive after unsubscribe and allows replay", async () => {
    const visitorId = randomUUID();
    cleanupDirs.push(path.join(getConfig().dataDir, "tenant", visitorId));

    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    mockedRun.mockImplementation(async (opts) => {
      opts.onEvent({ type: "text_delta", text: "hello" });
      await gate;
      opts.onEvent({ type: "done" });
    });

    const { run } = await startAgentRun({
      visitorId,
      message: "hi",
    });
    expect(run.status).toBe("running");
    expect(getActiveRunForSession(visitorId, "sess-fixed")?.runId).toBe(run.runId);

    const seen: string[] = [];
    const sub1 = subscribeAgentRun({
      visitorId,
      runId: run.runId,
      afterSeq: 0,
      onEvent: (e) => {
        if (e.type === "text_delta") seen.push(e.text);
      },
    });
    expect(sub1).not.toBeNull();
    expect(seen).toContain("hello");
    sub1!.unsubscribe();

    // 仍活动：第二订阅者可回放
    const seen2: string[] = [];
    const sub2 = subscribeAgentRun({
      visitorId,
      runId: run.runId,
      afterSeq: 0,
      onEvent: (e) => {
        if (e.type === "text_delta") seen2.push(e.text);
        if (e.type === "run_started") seen2.push("started");
      },
    });
    expect(seen2).toEqual(expect.arrayContaining(["started", "hello"]));
    sub2!.unsubscribe();

    release();
    await mockedRun.mock.results[0]?.value;
    expect(getActiveRunForSession(visitorId, "sess-fixed")).toBeNull();
  });

  it("rejects a second run on the same session", async () => {
    const visitorId = randomUUID();
    cleanupDirs.push(path.join(getConfig().dataDir, "tenant", visitorId));

    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    mockedRun.mockImplementation(async () => {
      await gate;
    });

    await startAgentRun({ visitorId, message: "one" });
    await expect(startAgentRun({ visitorId, message: "two" })).rejects.toBeInstanceOf(
      AgentRunActiveError,
    );
    release();
    await mockedRun.mock.results[0]?.value;
  });

  it("cancel stops the run", async () => {
    const visitorId = randomUUID();
    cleanupDirs.push(path.join(getConfig().dataDir, "tenant", visitorId));

    mockedRun.mockImplementation(async (opts) => {
      await new Promise<void>((resolve) => {
        opts.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    });

    const { run } = await startAgentRun({ visitorId, message: "x" });
    const cancelled = await cancelAgentRun(visitorId, run.runId);
    expect(cancelled?.status).toBe("cancelled");
    expect(getActiveRunForSession(visitorId, "sess-fixed")).toBeNull();
    await mockedRun.mock.results[0]?.value;
  });
});
