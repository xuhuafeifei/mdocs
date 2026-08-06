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
import { buildSystemPrompt, type AgentMode } from "./system-prompt.js";
import { createToolsForMode } from "./tools-registry.js";
import {
  AgentSessionManager,
} from "./session-manager.js";
import {
  getAgentContextUsageForApi,
  mergeContextUsage,
  type AgentContextUsage,
} from "./context-usage.js";
import {
  type AgentDocumentTableRow,
  type AgentStreamEvent,
} from "./stream-events.js";
import { runPiAgent } from "./run-pi-agent.js";
import {
  expandCurrentTurnSkillPairs,
  hydrateSessionMessagesToPi,
  markSkillExpandPoints,
} from "./hydrate-messages.js";
import { normalizeSkillRefs } from "./user-skills.js";

export type { AgentContextUsage, AgentMode };
export type { AgentDocumentTableRow, AgentStreamEvent };
export { getAgentContextUsageForApi } from "./context-usage.js";

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
 * 上手 Agent 主流程：config → tools → session → Agent → pi-run。
 * 流式进度经 onEvent 上抛；context_usage / done 在跑完后由本函数发出。
 */
export async function runOnboardingChat(params: {
  visitorId: string;
  message: string;
  mode?: AgentMode;
  /** 本轮引用的私人 skill 名称（对本访客唯一） */
  skillNames?: string[];
  /** @deprecated 兼容旧客户端 skillIds */
  skillIds?: string[];
  /** coding：本轮前端工作稿（请求体携带） */
  documentId?: string | null;
  workingMarkdown?: string;
  baseMarkdown?: string;
  onEvent: (event: AgentStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { visitorId, message, onEvent, signal } = params;
  const mode: AgentMode = params.mode === "coding" ? "coding" : "normal";
  const skillNames = normalizeSkillRefs(
    params.skillNames?.length ? params.skillNames : params.skillIds,
  );

  const cfg = getVisitorAgentConfig(visitorId);
  if (!cfg?.apiKey) throw new Error("missing_api_key");

  const skills = getSkillLoader();
  if (!skills.isReady()) throw new Error("skills_missing");

  const { models, model } = createDeepSeekModel(cfg);
  const tools = createToolsForMode(mode, {
    visitorId,
    onEvent,
    signal,
    skills,
    ...(mode === "coding"
      ? {
          coding: {
            documentId: params.documentId ?? null,
            workingMarkdown: params.workingMarkdown ?? "",
            baseMarkdown: params.baseMarkdown ?? "",
          },
        }
      : {}),
  });
  const systemPrompt = buildSystemPrompt(mode);

  const sessionManager = new AgentSessionManager(visitorId, {
    kind: mode === "coding" ? "coding" : "normal",
  });
  const { sessionId, messages: history } =
    await sessionManager.loadLastOpenedMessages(
      mode === "coding" ? params.documentId ?? null : undefined,
    );

  // 含本轮标定展开点（越新越先 → 本轮优先）；历史 hydrate；本轮假 tool；原文 prompt
  const expandAt = markSkillExpandPoints([
    ...history,
    { role: "user", content: message, skillNames },
  ]);
  const { messages: historyPi } = hydrateSessionMessagesToPi(
    visitorId,
    history,
    model,
    expandAt,
  );
  const currentIndex = history.length;
  const currentRefs = skillNames.filter((ref) => expandAt.get(ref) === currentIndex);
  const currentSkillPairs = expandCurrentTurnSkillPairs(
    visitorId,
    currentRefs,
    model,
    new Set(),
  );

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      tools,
      messages: [...historyPi, ...currentSkillPairs],
      /** Ask / 帮写均开思考流，避免长时间无输出像掉线 */
      thinkingLevel: "medium",
    },
    streamFn: models.streamSimple.bind(models),
  });

  const track = await runPiAgent({
    agent,
    message,
    skillNames,
    visitorId,
    sessionId,
    sessionManager,
    onEvent,
    signal,
  });

  if (signal?.aborted) return;

  const estimated = await getAgentContextUsageForApi(visitorId);
  const usage = mergeContextUsage(estimated, track.lastUsageInput);
  onEvent({
    type: "context_usage",
    percent: usage.percent,
    used: usage.used,
    limit: usage.limit,
  });
  onEvent({ type: "done" });
}

// —— 装配 helpers ——

function createDeepSeekModel(cfg: VisitorAgentConfig) {
  const model: Model<"openai-completions"> = {
    id: cfg.modelId,
    name: cfg.modelId,
    api: "openai-completions",
    provider: "deepseek",
    baseUrl: cfg.endpoint,
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: cfg.contextWindow,
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
