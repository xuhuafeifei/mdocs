/**
 * Agent run 落盘：metadata JSON + 序号事件 JSONL。
 * 不污染 session transcript（模型历史仍只在 *.jsonl user/assistant）。
 */
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../../config/index.js";
import type { AgentStreamEvent } from "./stream-events.js";
import type { AgentMode } from "./system-prompt.js";

export type AgentRunStatus =
  | "running"
  | "waiting_user"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "interrupted";

export type AgentRunMeta = {
  runId: string;
  sessionId: string;
  visitorId: string;
  mode: AgentMode;
  documentId?: string | null;
  status: AgentRunStatus;
  startedAt: string;
  deadlineAt: string;
  finishedAt?: string;
  abortReason?: string;
  lastSeq: number;
  message: string;
};

export type AgentRunEventRecord = {
  seq: number;
  ts: string;
  event: AgentStreamEvent | { type: "run_status"; status: AgentRunStatus; reason?: string };
};

function runsDir(visitorId: string): string {
  const { dataDir } = getConfig();
  return path.join(dataDir, "tenant", visitorId, "agent", "runs");
}

function metaPath(visitorId: string, runId: string): string {
  return path.join(runsDir(visitorId), `${runId}.json`);
}

function eventsPath(visitorId: string, runId: string): string {
  return path.join(runsDir(visitorId), `${runId}.events.jsonl`);
}

function activeIndexPath(visitorId: string): string {
  return path.join(runsDir(visitorId), "active.json");
}

function ensureDir(visitorId: string): void {
  fs.mkdirSync(runsDir(visitorId), { recursive: true });
}

function safeReadJson<T>(file: string): T | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeRunMeta(meta: AgentRunMeta): void {
  ensureDir(meta.visitorId);
  const tmp = `${metaPath(meta.visitorId, meta.runId)}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(meta, null, 2)}\n`);
  fs.renameSync(tmp, metaPath(meta.visitorId, meta.runId));
}

export function readRunMeta(visitorId: string, runId: string): AgentRunMeta | null {
  return safeReadJson<AgentRunMeta>(metaPath(visitorId, runId));
}

export function appendRunEvent(
  visitorId: string,
  runId: string,
  event: AgentRunEventRecord["event"],
): AgentRunEventRecord {
  ensureDir(visitorId);
  const meta = readRunMeta(visitorId, runId);
  const seq = (meta?.lastSeq ?? 0) + 1;
  const record: AgentRunEventRecord = {
    seq,
    ts: new Date().toISOString(),
    event,
  };
  fs.appendFileSync(eventsPath(visitorId, runId), `${JSON.stringify(record)}\n`);
  if (meta) {
    meta.lastSeq = seq;
    writeRunMeta(meta);
  }
  return record;
}

export function readRunEventsAfter(
  visitorId: string,
  runId: string,
  afterSeq: number,
): AgentRunEventRecord[] {
  const file = eventsPath(visitorId, runId);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  const out: AgentRunEventRecord[] = [];
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as AgentRunEventRecord;
      if (typeof rec.seq === "number" && rec.seq > afterSeq) out.push(rec);
    } catch {
      /* skip */
    }
  }
  return out;
}

/** sessionId → runId 的活动索引 */
export type ActiveRunIndex = Record<string, string>;

export function readActiveRunIndex(visitorId: string): ActiveRunIndex {
  return safeReadJson<ActiveRunIndex>(activeIndexPath(visitorId)) ?? {};
}

export function setActiveRun(visitorId: string, sessionId: string, runId: string | null): void {
  ensureDir(visitorId);
  const idx = readActiveRunIndex(visitorId);
  if (runId) idx[sessionId] = runId;
  else delete idx[sessionId];
  const tmp = `${activeIndexPath(visitorId)}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(idx, null, 2)}\n`);
  fs.renameSync(tmp, activeIndexPath(visitorId));
}

export function getActiveRunId(visitorId: string, sessionId: string): string | null {
  return readActiveRunIndex(visitorId)[sessionId] ?? null;
}

/** 启动时：把磁盘上仍标 running/waiting_user 的 run 标为 interrupted */
export function markStaleRunsInterrupted(visitorId: string): void {
  const dir = runsDir(visitorId);
  if (!fs.existsSync(dir)) return;
  const idx = readActiveRunIndex(visitorId);
  let idxChanged = false;
  for (const [sessionId, runId] of Object.entries(idx)) {
    const meta = readRunMeta(visitorId, runId);
    if (!meta) {
      delete idx[sessionId];
      idxChanged = true;
      continue;
    }
    if (meta.status === "running" || meta.status === "waiting_user") {
      meta.status = "interrupted";
      meta.finishedAt = new Date().toISOString();
      meta.abortReason = "process_restart";
      writeRunMeta(meta);
      appendRunEvent(visitorId, runId, {
        type: "run_status",
        status: "interrupted",
        reason: "process_restart",
      });
      delete idx[sessionId];
      idxChanged = true;
    }
  }
  if (idxChanged) {
    const tmp = `${activeIndexPath(visitorId)}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(idx, null, 2)}\n`);
    fs.renameSync(tmp, activeIndexPath(visitorId));
  }
}

export function listVisitorIdsWithRuns(): string[] {
  const { dataDir } = getConfig();
  const tenantRoot = path.join(dataDir, "tenant");
  if (!fs.existsSync(tenantRoot)) return [];
  const out: string[] = [];
  for (const name of fs.readdirSync(tenantRoot)) {
    const runs = path.join(tenantRoot, name, "agent", "runs");
    if (fs.existsSync(runs)) out.push(name);
  }
  return out;
}
