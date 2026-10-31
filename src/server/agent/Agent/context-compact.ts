/**
 * Session 上下文 LLM 压缩：≥85% 自动或主动触发。
 */
import type { Context, TextContent } from "@earendil-works/pi-ai";
import { ATTACHMENT_READ_TOOL } from "../attachments/session-rows.js";
import { getVisitorAgentConfig } from "../Config/config.js";
import {
  AgentSessionManager,
  type AgentSessionKind,
  type AgentSessionMessage,
} from "./session-manager.js";
import { SessionCompactingError } from "./context-compact-lock.js";
import {
  estimateUsageForMessages,
  type AgentContextUsage,
} from "./context-usage.js";
import type { AgentStreamEvent } from "./stream-events.js";

export const CONTEXT_COMPACT_THRESHOLD = 85;
export const CONTEXT_COMPACT_KEEP_TURNS = 6;
const SUMMARY_INPUT_MAX_CHARS = 200_000;
const SUMMARY_OUTPUT_MAX_CHARS = 4_000;

export type CompactResult = {
  compacted: boolean;
  reason?: "below_threshold" | "nothing_to_compact" | "llm_failed" | "missing_api_key";
  usage: AgentContextUsage;
  sessionId: string;
};

const COMPACT_SYSTEM = `你是会话压缩助手。将用户提供的对话历史压缩成简洁中文摘要。
保留：用户目标、已确认结论、重要 documentId/路径/文件名、未完成待办、关键工具结论。
不要复述大段正文；不要编造未出现的信息。只输出纯文本摘要，不要标题装饰。`;

function messageToPlain(m: AgentSessionMessage): string {
  if (m.role === "tool") {
    const args = JSON.stringify(m.arguments ?? {});
    // 附件 tool 行正文往往就是表格 JSON，截断太狠摘要会完全丢掉附件信息
    const cap = m.toolName === ATTACHMENT_READ_TOOL ? 4000 : 2000;
    const body = m.resultText.length > cap
      ? `${m.resultText.slice(0, cap)}…`
      : m.resultText;
    return `[tool ${m.toolName}] args=${args}\n${body}`;
  }
  return `[${m.role}] ${m.content}`;
}

/** 按 user 消息切轮：每轮 = 一条 user + 其后直到下一条 user 之前的内容 */
export function splitTurns(messages: AgentSessionMessage[]): AgentSessionMessage[][] {
  const turns: AgentSessionMessage[][] = [];
  let cur: AgentSessionMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      if (cur.length) turns.push(cur);
      cur = [m];
    } else {
      if (!cur.length) {
        // 开头的 assistant/tool 自成一轮
        turns.push([m]);
      } else {
        cur.push(m);
      }
    }
  }
  if (cur.length) turns.push(cur);
  return turns;
}

export function partitionForCompact(
  messages: AgentSessionMessage[],
  keepTurns = CONTEXT_COMPACT_KEEP_TURNS,
): { toSummarize: AgentSessionMessage[]; toKeep: AgentSessionMessage[] } {
  const turns = splitTurns(messages);
  if (turns.length <= keepTurns) {
    return { toSummarize: [], toKeep: messages };
  }
  const cut = turns.length - keepTurns;
  const toSummarize = turns.slice(0, cut).flat();
  const toKeep = turns.slice(cut).flat();
  return { toSummarize, toKeep };
}

function buildSummaryUserPayload(messages: AgentSessionMessage[]): string {
  let text = messages.map(messageToPlain).join("\n\n");
  if (text.length > SUMMARY_INPUT_MAX_CHARS) {
    text =
      text.slice(0, SUMMARY_INPUT_MAX_CHARS) +
      "\n\n…(历史过长已截断，请基于可见部分摘要)";
  }
  return `请压缩以下对话历史：\n\n${text}`;
}

function extractAssistantText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as TextContent & { type?: string; text?: string };
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  return parts.join("\n").trim();
}

async function summarizeWithLlm(
  visitorId: string,
  toSummarize: AgentSessionMessage[],
): Promise<string> {
  const cfg = getVisitorAgentConfig(visitorId);
  if (!cfg?.apiKey) throw new Error("missing_api_key");
  // 动态 import 避免与 run.ts 的循环依赖
  const { createAgentModel } = await import("./run.js");
  const { models, model } = createAgentModel(cfg);
  const context: Context = {
    systemPrompt: COMPACT_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildSummaryUserPayload(toSummarize),
        timestamp: Date.now(),
      },
    ],
  };
  const result = await models.completeSimple(model, context, {
    maxTokens: 2048,
    temperature: 0.2,
  });
  let text = extractAssistantText(result.content);
  if (!text) throw new Error("empty_summary");
  if (text.length > SUMMARY_OUTPUT_MAX_CHARS) {
    text = `${text.slice(0, SUMMARY_OUTPUT_MAX_CHARS)}…`;
  }
  return text;
}

function summaryMessage(summary: string): AgentSessionMessage {
  return {
    role: "user",
    content:
      "【系统·上下文压缩】以下为更早对话的摘要，详情若需要请重新调用工具读取。\n\n" +
      summary,
  };
}

export async function compactAgentSession(params: {
  visitorId: string;
  kind?: AgentSessionKind;
  documentId?: string | null;
  sessionId?: string;
  /** 主动压缩时忽略 85% 阈值 */
  force?: boolean;
  onEvent?: (event: AgentStreamEvent) => void;
}): Promise<CompactResult> {
  const kind = params.kind ?? "normal";
  const mgr = new AgentSessionManager(params.visitorId, { kind });
  const loaded = params.sessionId
    ? {
        sessionId: params.sessionId,
        messages: await mgr.loadMessages(params.sessionId),
      }
    : await mgr.loadLastOpenedMessages(
        kind === "coding" ? params.documentId : undefined,
      );
  const { sessionId, messages } = loaded;
  const usageBefore = estimateUsageForMessages(params.visitorId, messages);

  if (!params.force && usageBefore.percent < CONTEXT_COMPACT_THRESHOLD) {
    return {
      compacted: false,
      reason: "below_threshold",
      usage: usageBefore,
      sessionId,
    };
  }

  const { toSummarize, toKeep } = partitionForCompact(messages);
  if (toSummarize.length === 0) {
    return {
      compacted: false,
      reason: "nothing_to_compact",
      usage: usageBefore,
      sessionId,
    };
  }

  let release: (() => Promise<void>) | null = null;
  try {
    release = await mgr.acquireSessionCompactLock(sessionId);
    params.onEvent?.({ type: "context_compacting" });
    let summary: string;
    try {
      summary = await summarizeWithLlm(params.visitorId, toSummarize);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 失败不改 jsonl；通知前端结束「压缩中」态
      params.onEvent?.({
        type: "context_compacted",
        percent: usageBefore.percent,
        used: usageBefore.used,
        limit: usageBefore.limit,
      });
      if (msg === "missing_api_key") {
        return {
          compacted: false,
          reason: "missing_api_key",
          usage: usageBefore,
          sessionId,
        };
      }
      return {
        compacted: false,
        reason: "llm_failed",
        usage: usageBefore,
        sessionId,
      };
    }

    const next: AgentSessionMessage[] = [summaryMessage(summary), ...toKeep];
    // 保留 kind 标记：在写盘时由 replaceTranscript 加 kind 字段
    await mgr.replaceTranscript(sessionId, next, { markSummary: true });
    const usageAfter = estimateUsageForMessages(params.visitorId, next);
    params.onEvent?.({
      type: "context_compacted",
      percent: usageAfter.percent,
      used: usageAfter.used,
      limit: usageAfter.limit,
    });
    return {
      compacted: true,
      usage: usageAfter,
      sessionId,
    };
  } finally {
    if (release) await release();
  }
}

/** chat 前：达阈值则压缩；失败按契约仍继续原历史 */
export async function maybeCompactBeforeChat(params: {
  visitorId: string;
  kind?: AgentSessionKind;
  documentId?: string | null;
  onEvent: (event: AgentStreamEvent) => void;
}): Promise<void> {
  try {
    const usage = await estimateUsageQuick(params);
    if (usage.percent < CONTEXT_COMPACT_THRESHOLD) return;
    await compactAgentSession({
      visitorId: params.visitorId,
      kind: params.kind,
      documentId: params.documentId,
      force: false,
      onEvent: params.onEvent,
    });
  } catch (err) {
    if (err instanceof SessionCompactingError) throw err;
    // 其它错误：不挡本轮
  }
}

async function estimateUsageQuick(params: {
  visitorId: string;
  kind?: AgentSessionKind;
  documentId?: string | null;
}): Promise<AgentContextUsage> {
  const kind = params.kind ?? "normal";
  const { messages } = await new AgentSessionManager(params.visitorId, {
    kind,
  }).loadLastOpenedMessages(kind === "coding" ? params.documentId : undefined);
  return estimateUsageForMessages(params.visitorId, messages);
}
