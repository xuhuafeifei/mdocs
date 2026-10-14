import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../../config/index.js";
import {
  appendRunEvent,
  getActiveRunId,
  markStaleRunsInterrupted,
  readRunEventsAfter,
  readRunMeta,
  setActiveRun,
  writeRunMeta,
  type AgentRunMeta,
} from "./run-store.js";

const cleanupDirs: string[] = [];

afterEach(() => {
  for (const d of cleanupDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function baseMeta(visitorId: string, overrides: Partial<AgentRunMeta> = {}): AgentRunMeta {
  const runId = overrides.runId ?? randomUUID();
  const sessionId = overrides.sessionId ?? randomUUID();
  return {
    runId,
    sessionId,
    visitorId,
    mode: "normal",
    status: "running",
    startedAt: new Date().toISOString(),
    deadlineAt: new Date(Date.now() + 300_000).toISOString(),
    lastSeq: 0,
    message: "hi",
    ...overrides,
  };
}

describe("run-store", () => {
  it("persists meta and appends sequenced events", () => {
    const visitorId = randomUUID();
    cleanupDirs.push(path.join(getConfig().dataDir, "tenant", visitorId));
    const meta = baseMeta(visitorId);
    writeRunMeta(meta);
    setActiveRun(visitorId, meta.sessionId, meta.runId);

    const e1 = appendRunEvent(visitorId, meta.runId, {
      type: "text_delta",
      text: "a",
    });
    const e2 = appendRunEvent(visitorId, meta.runId, { type: "done" });
    expect(e1.seq).toBe(1);
    expect(e2.seq).toBe(2);
    expect(readRunMeta(visitorId, meta.runId)?.lastSeq).toBe(2);
    expect(getActiveRunId(visitorId, meta.sessionId)).toBe(meta.runId);

    const after = readRunEventsAfter(visitorId, meta.runId, 1);
    expect(after).toHaveLength(1);
    expect(after[0]?.event).toEqual({ type: "done" });
  });

  it("marks stale active runs interrupted on restart", () => {
    const visitorId = randomUUID();
    cleanupDirs.push(path.join(getConfig().dataDir, "tenant", visitorId));
    const meta = baseMeta(visitorId, { status: "waiting_user" });
    writeRunMeta(meta);
    setActiveRun(visitorId, meta.sessionId, meta.runId);

    markStaleRunsInterrupted(visitorId);

    const after = readRunMeta(visitorId, meta.runId);
    expect(after?.status).toBe("interrupted");
    expect(after?.abortReason).toBe("process_restart");
    expect(getActiveRunId(visitorId, meta.sessionId)).toBeNull();
    const events = readRunEventsAfter(visitorId, meta.runId, 0);
    expect(events.some((e) => (e.event as { type: string }).type === "run_status")).toBe(true);
  });
});
