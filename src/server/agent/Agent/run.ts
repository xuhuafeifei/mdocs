import { Agent } from "@earendil-works/pi-agent-core";
import {
  createModels,
  createProvider,
  type Model,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import {
  getVisitorAgentConfig,
  type VisitorAgentConfig,
} from "../Config/config.js";
import { getSkillLoader } from "../Skill/skill-loader.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { createSkillTools, type ManualSourceRef } from "./tools.js";

/** 推给路由 / 前端的流式片段（路由只负责写出 SSE） */
export type AgentStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "sources"; items: ManualSourceRef[] }
  | { type: "done" }
  | { type: "error"; message: string };

export function getAgentStatus(visitorId: string) {
  const cfg = getVisitorAgentConfig(visitorId);
  const skills = getSkillLoader();
  const hasKey = Boolean(cfg?.apiKey);
  return {
    enabled: hasKey && skills.isReady(),
    skillsReady: skills.isReady(),
    model: hasKey ? cfg!.modelId : null,
    configId: hasKey ? cfg!.id : null,
    reason: !hasKey
      ? "missing_api_key"
      : !skills.isReady()
        ? "skills_missing"
        : undefined,
  };
}

/**
 * 上手 Agent 主流程：model → create agent → load skill → 组装 prompt → prompt。
 * 流式进度经 onEvent 上抛，路由不感知 Pi / skill 细节。
 */
export async function runOnboardingChat(params: {
  visitorId: string;
  message: string;
  onEvent: (event: AgentStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { visitorId, message, onEvent, signal } = params;
  const cfg = getVisitorAgentConfig(visitorId);
  if (!cfg?.apiKey) throw new Error("missing_api_key");

  const skills = getSkillLoader();
  if (!skills.isReady()) throw new Error("skills_missing");

  const { models, model } = createDeepSeekModel(cfg);
  const tools = createSkillTools(skills);
  const systemPrompt = buildSystemPrompt();
  const sourcesById = new Map<string, ManualSourceRef>();

  const agent = new Agent({
    initialState: { systemPrompt, model, tools },
    streamFn: models.streamSimple.bind(models),
  });

  const unsub = agent.subscribe((event) => {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      onEvent({ type: "text_delta", text: event.assistantMessageEvent.delta });
      return;
    }
    if (
      event.type === "tool_execution_end" &&
      event.toolName === "mdocs_manual_content" &&
      !event.isError
    ) {
      const source = (event.result as { details?: { source?: ManualSourceRef | null } } | null)
        ?.details?.source;
      if (source?.url && !sourcesById.has(source.id)) {
        sourcesById.set(source.id, source);
        onEvent({ type: "sources", items: [...sourcesById.values()] });
      }
    }
  });

  const onAbort = () => agent.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    await agent.prompt(message);
    onEvent({ type: "done" });
  } catch (err) {
    if (signal?.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    onEvent({ type: "error", message: msg });
    throw err;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    unsub();
  }
}

function createDeepSeekModel(cfg: VisitorAgentConfig) {
  const model: Model<"openai-completions"> = {
    id: cfg.modelId,
    name: cfg.modelId,
    api: "openai-completions",
    provider: "deepseek",
    baseUrl: cfg.endpoint,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  };

  const apiKey = cfg.apiKey;
  const models = createModels();
  models.setProvider(
    createProvider({
      id: "deepseek",
      name: "DeepSeek",
      baseUrl: cfg.endpoint,
      auth: {
        apiKey: {
          name: "DeepSeek API key",
          async resolve() {
            return { auth: { apiKey }, source: "visitor_config" };
          },
        },
      },
      models: [model],
      api: openAICompletionsApi(),
    }),
  );

  const resolved = models.getModel("deepseek", cfg.modelId);
  if (!resolved) throw new Error("model_not_found");
  return { models, model: resolved };
}
