/**
 * 已装配好的 Pi Agent：subscribe → prompt → abort 收尾。
 * session 落盘 + text_delta/error + tool→SSE 在此；context_usage/done 由调用方发。
 */
import type { Agent, AgentEvent } from "@earendil-works/pi-agent-core";
import type { AgentSessionManager } from "./session-manager.js";
import type { AgentStreamEvent } from "./stream-events.js";
import { createToolUiEffectsHandler } from "./tool-ui-effects.js";
import { cancelVisitorChoices } from "./choice-pending.js";
import { cancelVisitorSkillForms } from "./skill-form-pending.js";

export type PiRunTrack = {
  emittedError: boolean;
  lastUsageInput: number;
};

export type RunPiAgentParams = {
  agent: Agent;
  message: string;
  /** 本轮引用；落盘到 user 行，不写入展开正文 */
  skillNames?: string[];
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
    skillNames,
    visitorId,
    sessionId,
    sessionManager,
    onEvent,
    signal,
  } = params;

  const track: PiRunTrack = { emittedError: false, lastUsageInput: 0 };
  const unsub = agent.subscribe(
    bindAgentEvents({ sessionId, sessionManager, skillNames, onEvent, track }),
  );

  const onAbort = () => {
    cancelVisitorChoices(visitorId);
    cancelVisitorSkillForms(visitorId);
    agent.abort();
  };
  signal?.addEventListener("abort", onAbort);

  try {
    await agent.prompt(message);
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
  onEvent: (event: AgentStreamEvent) => void;
  track: PiRunTrack;
}): (event: AgentEvent) => Promise<void> {
  const { sessionId, sessionManager, skillNames, onEvent, track } = opts;
  const onToolUi = createToolUiEffectsHandler(onEvent);
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
    }

    if (event.type === "message_end") {
      if (event.message.role === "user") {
        if (!appendedUser) {
          appendedUser = true;
          const content = extractUserContent(event.message);
          if (content) await sessionManager.appendUser(sessionId, content, skillNames);
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
          }
        }
        return;
      }
    }

    if (event.type === "tool_execution_end") {
      onToolUi(event);
    }
  };
}
