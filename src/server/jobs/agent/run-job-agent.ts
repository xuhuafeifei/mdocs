/**
 * Job 专用 Agent：无 session、不复用聊天助手工具全集。
 * 位置刻意简单（jobs/agent/），工具经 createJobAgentTools 扩展。
 */
import { Agent } from "@earendil-works/pi-agent-core";
import { getVisitorAgentConfig } from "../../agent/Config/config.js";
import { createAgentModel } from "../../agent/Agent/run.js";
import type { AgentStreamEvent } from "../../agent/Agent/stream-events.js";
import { buildJobAgentSystemPrompt } from "./system-prompt.js";
import { createJobAgentTools } from "./tools.js";
import type { JobAgentRunParams, JobAgentRunResult } from "./types.js";
import { useLogger } from "../../logger/logger.js";

const log = useLogger("jobs.agent");

export async function runJobAgent(
  params: JobAgentRunParams,
): Promise<JobAgentRunResult> {
  const { ctx, prompt, signal } = params;
  const userPrompt = prompt?.trim();
  if (!userPrompt) {
    return { ok: false, errorMessage: "job prompt is empty" };
  }

  const cfg = getVisitorAgentConfig(ctx.visitorId);
  if (!cfg?.apiKey) {
    return { ok: false, errorMessage: "owner missing agent api key" };
  }

  const onEvent = (event: AgentStreamEvent): void => {
    if (event.type === "error") {
      log.warn(
        "job agent error jobId=%s runId=%s: %s",
        ctx.jobId,
        ctx.jobRunningId,
        event.message,
      );
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
  const unsub = agent.subscribe((event) => {
    if (event.type === "agent_end" && event.messages) {
      /* no-op: 无 session 落盘 */
    }
  });

  const onAbort = () => {
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
      return { ok: false, errorMessage: errorMessage ?? "aborted" };
    }
    return errorMessage
      ? { ok: false, errorMessage }
      : { ok: true };
  } catch (err) {
    if (signal?.aborted) {
      return { ok: false, errorMessage: "aborted" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    onEvent({ type: "error", message: msg });
    return { ok: false, errorMessage: msg };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    unsub();
  }
}
