/**
 * 服务端持有的 Agent run：与 SSE 连接解耦。
 * 关闭面板只取消订阅；显式 cancel / 超时才 abort。
 */
import { randomUUID } from "node:crypto";
import { useLogger } from "../../logger/logger.js";
import { getVisitorAgentConfig } from "../Config/config.js";
import { cancelVisitorChoices } from "./choice-pending.js";
import { cancelVisitorSkillForms } from "./skill-form-pending.js";
import { runOnboardingChat } from "./run.js";
import { AgentSessionManager } from "./session-manager.js";
import type { AgentStreamEvent } from "./stream-events.js";
import type { AgentMode, AgentUiReferences } from "./system-prompt.js";
import {
  appendRunEvent,
  getActiveRunId,
  listVisitorIdsWithRuns,
  markStaleRunsInterrupted,
  readRunEventsAfter,
  readRunMeta,
  setActiveRun,
  writeRunMeta,
  type AgentRunMeta,
  type AgentRunStatus,
} from "./run-store.js";

const log = useLogger("agent-run-manager");

export type AgentRunPublic = {
  runId: string;
  sessionId: string;
  status: AgentRunStatus;
  startedAt: string;
  deadlineAt: string;
  finishedAt?: string;
  lastSeq: number;
  abortReason?: string;
};

type Subscriber = {
  id: string;
  afterSeq: number;
  onEvent: (event: AgentStreamEvent, seq: number) => void;
  onClose?: () => void;
};

type LiveRun = {
  meta: AgentRunMeta;
  ac: AbortController;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  subscribers: Map<string, Subscriber>;
  executing: Promise<void>;
};

const live = new Map<string, LiveRun>(); // runId → LiveRun
let bootstrapped = false;

export function bootstrapAgentRuns(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  for (const visitorId of listVisitorIdsWithRuns()) {
    try {
      markStaleRunsInterrupted(visitorId);
    } catch (err) {
      log.warn(
        "mark stale runs failed for %s: %s",
        visitorId,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  log.info("agent runs bootstrapped");
}

function toPublic(meta: AgentRunMeta): AgentRunPublic {
  return {
    runId: meta.runId,
    sessionId: meta.sessionId,
    status: meta.status,
    startedAt: meta.startedAt,
    deadlineAt: meta.deadlineAt,
    finishedAt: meta.finishedAt,
    lastSeq: meta.lastSeq,
    abortReason: meta.abortReason,
  };
}

function isActiveStatus(status: AgentRunStatus): boolean {
  return status === "running" || status === "waiting_user";
}

function emitToSubscribers(run: LiveRun, streamEvent: AgentStreamEvent, seq: number): void {
  for (const sub of run.subscribers.values()) {
    if (seq <= sub.afterSeq) continue;
    try {
      sub.onEvent(streamEvent, seq);
      sub.afterSeq = seq;
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function persistAndBroadcast(run: LiveRun, event: AgentStreamEvent): void {
  const record = appendRunEvent(run.meta.visitorId, run.meta.runId, event);
  run.meta.lastSeq = record.seq;
  emitToSubscribers(run, event, record.seq);

  if (event.type === "choice_card" || event.type === "skill_form_card") {
    updateStatus(run, "waiting_user");
  } else if (
    run.meta.status === "waiting_user" &&
    (event.type === "text_delta" ||
      event.type === "thinking_delta" ||
      event.type === "tool_call" ||
      event.type === "choice_expired" ||
      event.type === "skill_form_expired")
  ) {
    updateStatus(run, "running");
  }
}

function updateStatus(run: LiveRun, status: AgentRunStatus, reason?: string): void {
  if (run.meta.status === status) return;
  run.meta.status = status;
  if (!isActiveStatus(status)) {
    run.meta.finishedAt = new Date().toISOString();
    if (reason) run.meta.abortReason = reason;
    setActiveRun(run.meta.visitorId, run.meta.sessionId, null);
    if (run.timeoutTimer) {
      clearTimeout(run.timeoutTimer);
      run.timeoutTimer = null;
    }
  } else if (status === "running" || status === "waiting_user") {
    setActiveRun(run.meta.visitorId, run.meta.sessionId, run.meta.runId);
  }
  writeRunMeta(run.meta);
  const record = appendRunEvent(run.meta.visitorId, run.meta.runId, {
    type: "run_status",
    status,
    reason,
  });
  run.meta.lastSeq = record.seq;
  // run_status 不是前端 AgentStreamEvent；仅用于落盘。终态额外发 done/error。
}

export async function resolveSessionForChat(params: {
  visitorId: string;
  mode: AgentMode;
  documentId?: string | null;
}): Promise<{ sessionId: string }> {
  const mgr = new AgentSessionManager(params.visitorId, {
    kind: params.mode === "coding" ? "coding" : "normal",
  });
  const { sessionId } = await mgr.loadLastOpenedMessages(
    params.mode === "coding" ? params.documentId ?? null : undefined,
  );
  return { sessionId };
}

export function getActiveRunForSession(
  visitorId: string,
  sessionId: string,
): AgentRunPublic | null {
  const runId = getActiveRunId(visitorId, sessionId);
  if (!runId) return null;
  const liveRun = live.get(runId);
  if (liveRun) return toPublic(liveRun.meta);
  const meta = readRunMeta(visitorId, runId);
  if (!meta || !isActiveStatus(meta.status)) {
    setActiveRun(visitorId, sessionId, null);
    return null;
  }
  // 磁盘说 active 但内存没有 → 进程重启后应已被标 interrupted；兜底清理
  setActiveRun(visitorId, sessionId, null);
  return null;
}

export function getRunPublic(visitorId: string, runId: string): AgentRunPublic | null {
  const liveRun = live.get(runId);
  if (liveRun && liveRun.meta.visitorId === visitorId) return toPublic(liveRun.meta);
  const meta = readRunMeta(visitorId, runId);
  if (!meta || meta.visitorId !== visitorId) return null;
  return toPublic(meta);
}

export class AgentRunActiveError extends Error {
  readonly code = "RUN_ACTIVE";
  constructor(public readonly activeRun: AgentRunPublic) {
    super("RUN_ACTIVE");
    this.name = "AgentRunActiveError";
  }
}

export async function startAgentRun(params: {
  visitorId: string;
  message: string;
  mode?: AgentMode;
  skillNames?: string[];
  assetIds?: string[];
  documentId?: string | null;
  workingMarkdown?: string;
  baseMarkdown?: string;
  references?: AgentUiReferences | null;
}): Promise<{ run: AgentRunPublic }> {
  bootstrapAgentRuns();
  const mode: AgentMode = params.mode === "coding" ? "coding" : "normal";
  const { sessionId } = await resolveSessionForChat({
    visitorId: params.visitorId,
    mode,
    documentId: params.documentId,
  });

  const existing = getActiveRunForSession(params.visitorId, sessionId);
  if (existing) throw new AgentRunActiveError(existing);

  const cfg = getVisitorAgentConfig(params.visitorId);
  const timeoutSec = cfg?.runTimeoutSeconds ?? 300;
  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + timeoutSec * 1000);
  const runId = randomUUID();
  const meta: AgentRunMeta = {
    runId,
    sessionId,
    visitorId: params.visitorId,
    mode,
    documentId: mode === "coding" ? params.documentId ?? null : undefined,
    status: "running",
    startedAt: startedAt.toISOString(),
    deadlineAt: deadlineAt.toISOString(),
    lastSeq: 0,
    message: params.message,
  };
  writeRunMeta(meta);
  setActiveRun(params.visitorId, sessionId, runId);

  const ac = new AbortController();
  const run: LiveRun = {
    meta,
    ac,
    timeoutTimer: null,
    subscribers: new Map(),
    executing: Promise.resolve(),
  };
  live.set(runId, run);

  run.timeoutTimer = setTimeout(() => {
    void finishRun(runId, "timed_out", "run_timeout");
  }, timeoutSec * 1000);

  const startedEvt: AgentStreamEvent = {
    type: "run_started",
    runId,
    sessionId,
    deadlineAt: meta.deadlineAt,
  };
  persistAndBroadcast(run, startedEvt);

  run.executing = (async () => {
    try {
      await runOnboardingChat({
        visitorId: params.visitorId,
        message: params.message,
        mode,
        skillNames: params.skillNames,
        assetIds: params.assetIds,
        documentId: params.documentId,
        workingMarkdown: params.workingMarkdown,
        baseMarkdown: params.baseMarkdown,
        references: params.references,
        signal: ac.signal,
        onEvent: (event) => {
          if (ac.signal.aborted && event.type !== "error") return;
          persistAndBroadcast(run, event);
        },
      });
      if (!ac.signal.aborted && isActiveStatus(run.meta.status)) {
        updateStatus(run, "completed");
      }
    } catch (err) {
      if (ac.signal.aborted) {
        // timed_out / cancelled 已由 finishRun 设置
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      persistAndBroadcast(run, { type: "error", message });
      updateStatus(run, "failed", message);
      persistAndBroadcast(run, { type: "done" });
    } finally {
      for (const sub of run.subscribers.values()) {
        try {
          sub.onClose?.();
        } catch {
          /* ignore */
        }
      }
      run.subscribers.clear();
      live.delete(runId);
    }
  })();

  return { run: toPublic(meta) };
}

async function finishRun(
  runId: string,
  status: "timed_out" | "cancelled",
  reason: string,
): Promise<void> {
  const run = live.get(runId);
  if (!run || !isActiveStatus(run.meta.status)) return;
  updateStatus(run, status, reason);
  cancelVisitorChoices(run.meta.visitorId);
  cancelVisitorSkillForms(run.meta.visitorId);
  if (!run.ac.signal.aborted) {
    run.ac.abort();
  }
  if (status === "timed_out") {
    persistAndBroadcast(run, {
      type: "error",
      message: `单轮运行已超时（${reason}）`,
    });
    persistAndBroadcast(run, { type: "done" });
  } else {
    persistAndBroadcast(run, { type: "done" });
  }
  await run.executing.catch(() => undefined);
}

export async function cancelAgentRun(
  visitorId: string,
  runId: string,
): Promise<AgentRunPublic | null> {
  const run = live.get(runId);
  if (!run || run.meta.visitorId !== visitorId) {
    const meta = readRunMeta(visitorId, runId);
    return meta && meta.visitorId === visitorId ? toPublic(meta) : null;
  }
  await finishRun(runId, "cancelled", "user_cancel");
  const meta = readRunMeta(visitorId, runId);
  return meta ? toPublic(meta) : null;
}

/**
 * 订阅 run 事件：先回放 afterSeq 之后的流式事件，再接实时。
 * 返回 unsubscribe。
 */
export function subscribeAgentRun(params: {
  visitorId: string;
  runId: string;
  afterSeq?: number;
  onEvent: (event: AgentStreamEvent, seq: number) => void;
  onClose?: () => void;
}): { unsubscribe: () => void; run: AgentRunPublic } | null {
  const afterSeq = Math.max(0, params.afterSeq ?? 0);
  const liveRun = live.get(params.runId);
  const meta =
    liveRun && liveRun.meta.visitorId === params.visitorId
      ? liveRun.meta
      : readRunMeta(params.visitorId, params.runId);
  if (!meta || meta.visitorId !== params.visitorId) return null;

  // 回放（跳过 run_status）
  const history = readRunEventsAfter(params.visitorId, params.runId, afterSeq);
  let cursor = afterSeq;
  for (const rec of history) {
    if (rec.event && typeof rec.event === "object" && "type" in rec.event) {
      if ((rec.event as { type: string }).type === "run_status") {
        cursor = rec.seq;
        continue;
      }
      params.onEvent(rec.event as AgentStreamEvent, rec.seq);
      cursor = rec.seq;
    }
  }

  if (!liveRun || !isActiveStatus(liveRun.meta.status)) {
    params.onClose?.();
    return {
      unsubscribe: () => undefined,
      run: toPublic(meta),
    };
  }

  const subId = randomUUID();
  const sub: Subscriber = {
    id: subId,
    afterSeq: cursor,
    onEvent: params.onEvent,
    onClose: params.onClose,
  };
  liveRun.subscribers.set(subId, sub);

  return {
    run: toPublic(liveRun.meta),
    unsubscribe: () => {
      liveRun.subscribers.delete(subId);
    },
  };
}
