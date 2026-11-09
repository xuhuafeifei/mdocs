/**
 * Job 专用 Agent：无 session、不复用聊天助手工具全集。
 * 位置刻意简单（jobs/agent/），工具经 createJobAgentTools 扩展。
 */
import { Agent, type AgentEvent } from "@earendil-works/pi-agent-core";
import { getVisitorAgentConfig } from "../../agent/Config/config.js";
import { createAgentModel } from "../../agent/Agent/run.js";
import type { AgentStreamEvent } from "../../agent/Agent/stream-events.js";
import { buildJobAgentSystemPrompt } from "./system-prompt.js";
import { createJobAgentTools } from "./tools.js";
import type { JobAgentRunParams, JobAgentRunResult } from "./types.js";
import { useLogger } from "../../logger/logger.js";

const log = useLogger("jobs.agent");

function clip(text: string, max = 240): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function summarizeArgs(args: unknown): string {
  try {
    return clip(JSON.stringify(args ?? {}));
  } catch {
    return "[unserializable args]";
  }
}

function summarizeResult(result: unknown, isError?: boolean): string {
  if (isError) {
    if (typeof result === "string") return clip(result);
    try {
      return clip(JSON.stringify(result));
    } catch {
      return "[error]";
    }
  }
  try {
    const s = JSON.stringify(result);
    return clip(s, 320);
  } catch {
    return "[ok]";
  }
}

export async function runJobAgent(
  params: JobAgentRunParams,
): Promise<JobAgentRunResult> {
  const { ctx, prompt, signal } = params;
  const tag = `jobId=${ctx.jobId} runId=${ctx.jobRunningId}`;
  const userPrompt = prompt?.trim();
  if (!userPrompt) {
    log.warn("%s abort: empty prompt", tag);
    return { ok: false, errorMessage: "job prompt is empty" };
  }

  const cfg = getVisitorAgentConfig(ctx.visitorId);
  if (!cfg?.apiKey) {
    log.warn("%s abort: owner=%s missing api key", tag, ctx.visitorId);
    return { ok: false, errorMessage: "owner missing agent api key" };
  }

  const onEvent = (event: AgentStreamEvent): void => {
    if (event.type === "error") {
      log.warn("%s agent error: %s", tag, event.message);
    }
  };

  const toolDeps = {
    visitorId: ctx.visitorId,
    onEvent,
    signal,
    ...(cfg.kind === "deepseek" && cfg.apiKey
      ? {
          deepseekWeb: {
            apiKey: cfg.apiKey,
            baseUrl: cfg.baseUrl || undefined,
          },
        }
      : {}),
  };

  const { models, model } = createAgentModel(cfg);
  const tools = createJobAgentTools(ctx, toolDeps);
  const systemPrompt = buildJobAgentSystemPrompt(ctx);

  log.info(
    "%s start model=%s kind=%s tools=%s prompt=%s",
    tag,
    cfg.modelId,
    cfg.kind,
    tools.map((t) => t.name).join(","),
    clip(userPrompt, 160),
  );

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      tools,
      messages: [],
      thinkingLevel: cfg.thinkingLevel,
    },
    streamFn: models.streamSimple.bind(models),
  });

  let errorMessage: string | undefined;
  let textBuf = "";
  const unsub = agent.subscribe((event: AgentEvent) => {
    if (event.type === "tool_execution_start") {
      log.info(
        "%s tool start name=%s args=%s",
        tag,
        event.toolName,
        summarizeArgs(event.args),
      );
      return;
    }
    if (event.type === "tool_execution_end") {
      log.info(
        "%s tool end name=%s error=%s result=%s",
        tag,
        event.toolName,
        event.isError ? "yes" : "no",
        summarizeResult(event.result, event.isError),
      );
      return;
    }
    if (event.type === "message_update") {
      const ame = event.assistantMessageEvent;
      if (ame?.type === "text_delta" && typeof ame.delta === "string") {
        textBuf += ame.delta;
      }
      return;
    }
    if (event.type === "message_end" && event.message?.role === "assistant") {
      const msg = event.message as {
        stopReason?: string;
        errorMessage?: string;
      };
      if (textBuf.trim()) {
        log.info("%s assistant text=%s", tag, clip(textBuf, 400));
        textBuf = "";
      }
      if (msg.stopReason) {
        log.info("%s assistant stopReason=%s", tag, msg.stopReason);
      }
      if (
        (msg.stopReason === "error" || msg.stopReason === "aborted") &&
        msg.errorMessage
      ) {
        errorMessage = msg.errorMessage;
        log.warn("%s assistant errorMessage=%s", tag, clip(msg.errorMessage, 400));
      }
      return;
    }
    if (event.type === "agent_end") {
      log.info("%s agent_end", tag);
    }
  });

  const onAbort = () => {
    log.warn("%s abort signal → agent.abort()", tag);
    agent.abort();
  };
  signal?.addEventListener("abort", onAbort);

  try {
    await agent.prompt(userPrompt);
    const leftover = agent.state.errorMessage;
    if (leftover) {
      errorMessage = leftover;
    }
    if (signal?.aborted) {
      log.warn("%s finished aborted err=%s", tag, errorMessage ?? "aborted");
      return { ok: false, errorMessage: errorMessage ?? "aborted" };
    }
    if (errorMessage) {
      log.warn("%s finished failed err=%s", tag, clip(errorMessage, 400));
      return { ok: false, errorMessage };
    }
    log.info("%s finished ok", tag);
    return { ok: true };
  } catch (err) {
    if (signal?.aborted) {
      log.warn("%s finished aborted (catch)", tag);
      return { ok: false, errorMessage: "aborted" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    onEvent({ type: "error", message: msg });
    log.error("%s finished exception: %s", tag, msg);
    return { ok: false, errorMessage: msg };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    unsub();
  }
}
