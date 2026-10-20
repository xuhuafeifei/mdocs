/**
 * 已装配好的 Pi Agent：subscribe → prompt → abort 收尾。
 * session 落盘 + text_delta/error + tool→SSE 在此；context_usage/done 由调用方发。
 */
import type { Agent, AgentEvent } from "@earendil-works/pi-agent-core";
import type { AgentSessionManager } from "./session-manager.js";
import type {
  AgentStreamEvent,
  AgentWebSearchResults,
} from "./stream-events.js";
import { createToolUiEffectsHandler } from "./tool-ui-effects.js";
import {
  isWriteTool,
  toolCallDetailFromArgs,
  toolCallDetailFromResult,
  toolCallLabel,
  toolCallPreparingDetail,
  writeToolBodyText,
} from "./tool-call-ui.js";

function webResultsFromToolResult(result: unknown): AgentWebSearchResults | undefined {
  const details = (
    result && typeof result === "object"
      ? (result as { details?: Record<string, unknown> }).details
      : null
  ) as Record<string, unknown> | null | undefined;
  if (!details) return undefined;
  const query = String(details.query ?? "").trim();
  const raw = details.results;
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((row) => {
      const r = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
      if (!r) return null;
      const title = String(r.title ?? "").trim();
      const url = String(r.url ?? "").trim();
      if (!title || !url) return null;
      return {
        title,
        url,
        snippet: String(r.snippet ?? r.summary ?? "").trim(),
        siteName: (r.siteName as string | null | undefined) ?? null,
        siteIcon: (r.siteIcon as string | null | undefined) ?? null,
        date: (r.date as string | null | undefined) ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  return { query, items };
}
import { cancelVisitorChoices } from "./choice-pending.js";
import { cancelVisitorSkillForms } from "./skill-form-pending.js";

export type PiRunTrack = {
  emittedError: boolean;
  lastUsageInput: number;
};

export type RunPiAgentParams = {
  agent: Agent;
  message: string;
  /** 本轮多模态图片（pi ImageContent）；不落盘 */
  images?: Array<{ type: "image"; data: string; mimeType: string }>;
  /** 本轮引用；落盘到 user 行，不写入展开正文 */
  skillNames?: string[];
  /** 本轮附件 Ref；落盘到 user 行 */
  assets?: Array<{ id: string; name: string; mime: string; bytes: number }>;
  /** 落盘用的 user 可见文本（可与 prompt 文本不同） */
  persistContent?: string;
  visitorId: string;
  sessionId: string;
  sessionManager: AgentSessionManager;
  onEvent: (event: AgentStreamEvent) => void;
  signal?: AbortSignal;
};

export async function runPiAgent(params: RunPiAgentParams): Promise<PiRunTrack> {
  const {
    agent,
    message,
    images,
    skillNames,
    assets,
    persistContent,
    visitorId,
    sessionId,
    sessionManager,
    onEvent,
    signal,
  } = params;

  const track: PiRunTrack = { emittedError: false, lastUsageInput: 0 };
  const unsub = agent.subscribe(
    bindAgentEvents({
      sessionId,
      sessionManager,
      skillNames,
      assets,
      persistContent: persistContent ?? message,
      onEvent,
      track,
    }),
  );

  const onAbort = () => {
    cancelVisitorChoices(visitorId);
    cancelVisitorSkillForms(visitorId);
    agent.abort();
  };
  signal?.addEventListener("abort", onAbort);

  try {
    if (images && images.length > 0) {
      await agent.prompt(message, images);
    } else {
      await agent.prompt(message);
    }
    const leftover = agent.state.errorMessage;
    // prompt 在模型鉴权失败时仍可能 resolve，再兜底一次
    if (leftover && !track.emittedError) {
      onEvent({ type: "error", message: leftover });
      track.emittedError = true;
    }
    return track;
  } catch (err) {
    if (signal?.aborted) return track;
    const msg = err instanceof Error ? err.message : String(err);
    onEvent({ type: "error", message: msg });
    throw err;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    cancelVisitorChoices(visitorId);
    cancelVisitorSkillForms(visitorId);
    unsub();
  }
}

function extractUserContent(userMsg: { content?: unknown }): string {
  const c = userMsg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .filter((x): x is { type: string; text: string } => x?.type === "text")
      .map((x) => x.text)
      .join("");
  }
  return "";
}

function extractAssistantVisibleText(assistantMsg: {
  content?: unknown;
}): string {
  const content = assistantMsg.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((x): x is { type: string; text: string } => x?.type === "text")
    .map((x) => x.text)
    .join("");
}

/** SSE + session 落盘；tool→SSE 见 tool-ui-effects */
function bindAgentEvents(opts: {
  sessionId: string;
  sessionManager: AgentSessionManager;
  skillNames?: string[];
  assets?: Array<{ id: string; name: string; mime: string; bytes: number }>;
  persistContent: string;
  onEvent: (event: AgentStreamEvent) => void;
  track: PiRunTrack;
}): (event: AgentEvent) => Promise<void> {
  const {
    sessionId,
    sessionManager,
    skillNames,
    assets,
    persistContent,
    onEvent,
    track,
  } = opts;
  const onToolUi = createToolUiEffectsHandler(onEvent);
  const toolStartDetail = new Map<string, string>();
  /** contentIndex → 已推过的 preparing 卡片，避免 toolcall_delta 刷屏 */
  const preparingByIndex = new Map<number, PreparingTrack>();
  let appendedUser = false;
  let appendedAssistant = false;

  return async (event) => {
    if (event.type === "message_update") {
      const ame = event.assistantMessageEvent;
      if (ame.type === "text_delta") {
        onEvent({ type: "text_delta", text: ame.delta });
        return;
      }
      if (ame.type === "thinking_delta") {
        onEvent({ type: "thinking_delta", text: ame.delta });
        return;
      }
      if (ame.type === "toolcall_start" || ame.type === "toolcall_delta") {
        emitToolCallPreparing(ame, preparingByIndex, onEvent);
        return;
      }
    }

    if (event.type === "message_end") {
      if (event.message.role === "user") {
        if (!appendedUser) {
          appendedUser = true;
          const fromEvent = extractUserContent(event.message);
          const content = persistContent || fromEvent;
          if (content || (assets && assets.length > 0)) {
            await sessionManager.appendUser(
              sessionId,
              content || "(见附件)",
              skillNames,
              assets,
            );
          }
        }
        return;
      }

      if (event.message.role === "assistant") {
        const msg = event.message as {
          stopReason?: string;
          errorMessage?: string;
          usage?: { input?: number };
        };

        if (typeof msg.usage?.input === "number" && msg.usage.input > 0) {
          track.lastUsageInput = Math.max(track.lastUsageInput, msg.usage.input);
        }

        if (
          (msg.stopReason === "error" || msg.stopReason === "aborted") &&
          msg.errorMessage
        ) {
          track.emittedError = true;
          onEvent({ type: "error", message: msg.errorMessage });
          return;
        }

        // toolUse = 准备调工具，不是最终可见回答
        if (
          !appendedAssistant &&
          (msg.stopReason === "stop" || msg.stopReason === "length")
        ) {
          appendedAssistant = true;
          const visibleText = extractAssistantVisibleText(event.message);
          if (visibleText) {
            await sessionManager.appendAssistant(sessionId, visibleText);
          } else if (msg.stopReason === "length") {
            onEvent({
              type: "tool_notice",
              toolName: "agent",
              text: "⚠️ 模型的思考过程达到了单次输出 Token 上限（8192）已被截断，未生成正文回复。建议在提示词中加上“直接输出结果/直接调用工具，无需长篇思考”。",
            });
          }
        }
        return;
      }
    }

    if (event.type === "tool_execution_start") {
      const detail = toolCallDetailFromArgs(event.toolName, event.args);
      if (detail) toolStartDetail.set(event.toolCallId, detail);
      onEvent({
        type: "tool_call",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        label: toolCallLabel(event.toolName),
        status: "running",
        ...(detail ? { detail } : {}),
      });
      return;
    }

    if (event.type === "tool_execution_end") {
      const startDetail = toolStartDetail.get(event.toolCallId);
      toolStartDetail.delete(event.toolCallId);
      const detail = toolCallDetailFromResult(
        event.toolName,
        event.result,
        startDetail,
      );
      const webResults =
        !event.isError && event.toolName === "web_search"
          ? webResultsFromToolResult(event.result)
          : undefined;
      onEvent({
        type: "tool_call",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        label: toolCallLabel(event.toolName),
        status: event.isError ? "error" : "done",
        ...(detail ? { detail } : {}),
        ...(webResults ? { webResults } : {}),
      });
      onToolUi(event);
    }
  };
}

type PreparingTrack = {
  toolCallId: string;
  toolName: string;
  /** 正文长度桶，控制推送频率 */
  detailBucket: number;
  /** 可见尾巴指纹，尾巴一变就推，方便卡片「闪过」 */
  previewTail: string;
};

/** 模型还在流式拼装工具参数时，提前推 preparing 卡片（写工具带可滚动预览） */
function emitToolCallPreparing(
  ame: {
    type: string;
    contentIndex: number;
    partial?: { content?: unknown };
  },
  preparingByIndex: Map<number, PreparingTrack>,
  onEvent: (event: AgentStreamEvent) => void,
): void {
  const content = ame.partial?.content;
  if (!Array.isArray(content)) return;
  const block = content[ame.contentIndex] as
    | { type?: string; id?: string; name?: string; arguments?: unknown }
    | undefined;
  if (!block || block.type !== "toolCall") return;

  const toolName = String(block.name ?? "").trim() || "tool";
  const prev = preparingByIndex.get(ame.contentIndex);
  const rawId = String(block.id ?? "").trim();
  // 准备阶段固定用首次 id，避免 id 从空→真实时前端出现两张卡
  const toolCallId =
    prev?.toolCallId ?? (rawId || `pending:${ame.contentIndex}`);

  const args = block.arguments;
  const detail = toolCallPreparingDetail(toolName, args);
  const body = isWriteTool(toolName) ? writeToolBodyText(toolName, args) : "";
  // 帮写/覆写更密推送，卡片增量滚动更跟手
  const bucketSize =
    toolName === "set_markdown_document" || toolName === "overwrite_document"
      ? 48
      : isWriteTool(toolName)
        ? 100
        : 800;
  const detailBucket = Math.floor(body.length / bucketSize);
  const previewTail = body.slice(-64);

  if (
    ame.type === "toolcall_delta" &&
    prev &&
    prev.toolName === toolName &&
    prev.detailBucket === detailBucket &&
    prev.previewTail === previewTail
  ) {
    return;
  }

  preparingByIndex.set(ame.contentIndex, {
    toolCallId,
    toolName,
    detailBucket,
    previewTail,
  });

  onEvent({
    type: "tool_call",
    toolCallId,
    toolName,
    label: toolName === "tool" ? "调用工具" : toolCallLabel(toolName),
    status: "preparing",
    ...(detail ? { detail } : {}),
  });
}
