import { Agent, type AgentEvent } from "@earendil-works/pi-agent-core";
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
import { createSkillTools, type ManualSourceRef } from "./tools.js";
import { createAccountTools } from "./tools-account.js";
import { createCodingTools } from "./tools-coding.js";
import {
  AgentSessionManager,
  type AgentSessionMessage,
} from "./session-manager.js";
import {
  getAgentContextUsageForApi,
  mergeContextUsage,
  type AgentContextUsage,
} from "./context-usage.js";
import { cancelVisitorChoices } from "./choice-pending.js";

export type { AgentContextUsage, AgentMode };
export { getAgentContextUsageForApi } from "./context-usage.js";

/** 推给路由 / 前端的流式片段（路由只负责写出 SSE） */
export type AgentStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "sources"; items: ManualSourceRef[] }
  | { type: "document_table"; title: string; rows: AgentDocumentTableRow[] }
  | {
      type: "document_card";
      documentId: string;
      title: string;
      path: string;
      preview: string;
    }
  | { type: "tool_notice"; toolName: string; text: string }
  | { type: "markdown_set"; markdown: string }
  | {
      type: "choice_card";
      requestId: string;
      title: string;
      options: string[];
      expiresAt: string;
    }
  | { type: "choice_expired"; requestId: string }
  | { type: "context_usage"; percent: number; used: number; limit: number }
  /** 账号工具改了文档树结构，前端应 re-fetch tree */
  | { type: "tree_changed"; reason: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface AgentDocumentTableRow {
  documentId: string;
  title: string;
  summary: string;
}

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
 * 上手 Agent 主流程：config → session hydrate → agent → subscribe → prompt。
 * 流式进度经 onEvent 上抛，路由不感知 Pi / skill 细节。
 */
export async function runOnboardingChat(params: {
  visitorId: string;
  message: string;
  mode?: AgentMode;
  /** coding：本轮前端工作稿（请求体携带） */
  documentId?: string | null;
  workingMarkdown?: string;
  baseMarkdown?: string;
  onEvent: (event: AgentStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { visitorId, message, onEvent, signal } = params;
  const mode: AgentMode = params.mode === "coding" ? "coding" : "normal";

  const cfg = getVisitorAgentConfig(visitorId);
  if (!cfg?.apiKey) throw new Error("missing_api_key");

  const skills = getSkillLoader();
  if (!skills.isReady()) throw new Error("skills_missing");

  const { models, model } = createDeepSeekModel(cfg);
  const choiceHooks = {
    onChoiceCard: (card: {
      requestId: string;
      title: string;
      options: string[];
      expiresAt: string;
    }) => {
      onEvent({ type: "choice_card", ...card });
    },
    onChoiceExpired: (requestId: string) => {
      onEvent({ type: "choice_expired", requestId });
    },
    signal,
  };
  const accountOrCoding =
    mode === "coding"
      ? createCodingTools(
          visitorId,
          {
            documentId: params.documentId ?? null,
            workingMarkdown: params.workingMarkdown ?? "",
            baseMarkdown: params.baseMarkdown ?? "",
          },
          choiceHooks,
        )
      : createAccountTools(visitorId, choiceHooks);
  const tools = [...createSkillTools(skills), ...accountOrCoding];
  const systemPrompt = buildSystemPrompt(mode);

  const sessionManager = new AgentSessionManager(visitorId, {
    kind: mode === "coding" ? "coding" : "normal",
  });
  const { sessionId, messages: history } =
    await sessionManager.loadLastOpenedMessages(
      mode === "coding" ? params.documentId ?? null : undefined,
    );

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      tools,
      messages: toPiMessages(history, model),
    },
    streamFn: models.streamSimple.bind(models),
  });

  const track = { emittedError: false, lastUsageInput: 0 };
  const unsub = agent.subscribe(
    bindAgentEvents({
      sessionId,
      sessionManager,
      onEvent,
      track,
    }),
  );

  const onAbort = () => {
    cancelVisitorChoices(visitorId);
    agent.abort();
  };
  signal?.addEventListener("abort", onAbort);

  try {
    await agent.prompt(message);
    const leftover = agent.state.errorMessage;
    // prompt 在模型鉴权失败时仍可能 resolve，再兜底一次
    if (leftover && !track.emittedError) {
      onEvent({ type: "error", message: leftover });
    }
    const estimated = await getAgentContextUsageForApi(visitorId);
    const usage = mergeContextUsage(estimated, track.lastUsageInput);
    onEvent({
      type: "context_usage",
      percent: usage.percent,
      used: usage.used,
      limit: usage.limit,
    });
    onEvent({ type: "done" });
  } catch (err) {
    if (signal?.aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    onEvent({ type: "error", message: msg });
    throw err;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    cancelVisitorChoices(visitorId);
    unsub();
  }
}

// —— helpers（主流程外）——

const EMPTY_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

/** jsonl 历史 → Pi Agent.messages（请求内内存副本） */
function toPiMessages(history: AgentSessionMessage[], model: Model<any>) {
  const ts = Date.now();
  return history.map((m) => {
    if (m.role === "user") {
      return { role: "user" as const, content: m.content, timestamp: ts };
    }
    return {
      role: "assistant" as const,
      content: [{ type: "text" as const, text: m.content }],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: EMPTY_USAGE,
      stopReason: "stop" as const,
      timestamp: ts,
    };
  });
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

/** SSE + session 落盘：只写 user / 最终 assistant 文本，忽略 thinking / tool */
function bindAgentEvents(opts: {
  sessionId: string;
  sessionManager: AgentSessionManager;
  onEvent: (event: AgentStreamEvent) => void;
  track: { emittedError: boolean; lastUsageInput: number };
}): (event: AgentEvent) => Promise<void> {
  const { sessionId, sessionManager, onEvent, track } = opts;
  const sourcesById = new Map<string, ManualSourceRef>();
  let appendedUser = false;
  let appendedAssistant = false;

  return async (event) => {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      onEvent({ type: "text_delta", text: event.assistantMessageEvent.delta });
      return;
    }

    if (event.type === "message_end") {
      if (event.message.role === "user") {
        if (!appendedUser) {
          appendedUser = true;
          const content = extractUserContent(event.message);
          if (content) await sessionManager.appendUser(sessionId, content);
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

    if (
      event.type === "tool_execution_end" &&
      event.toolName === "mdocs_manual_content" &&
      !event.isError
    ) {
      const source = (
        event.result as { details?: { source?: ManualSourceRef | null } } | null
      )?.details?.source;
      if (source?.url && !sourcesById.has(source.id)) {
        sourcesById.set(source.id, source);
        onEvent({ type: "sources", items: [...sourcesById.values()] });
      }
      return;
    }

    if (event.type === "tool_execution_end" && !event.isError) {
      const TREE_MUTATING_TOOLS = new Set([
        "create_document",
        "create_folder",
        "move_document",
      ]);
      if (TREE_MUTATING_TOOLS.has(event.toolName)) {
        onEvent({ type: "tree_changed", reason: event.toolName });
      }

      const details = (event.result as { details?: Record<string, unknown> } | null)?.details;

      if (event.toolName === "search_documents") {
        const results = (details?.results as Array<{
          documentId?: string;
          displayName?: string;
          snippet?: string;
        }> | undefined) ?? [];
        const rows = results
          .map((r) => ({
            documentId: String(r.documentId ?? "").trim(),
            title: String(r.displayName ?? "").trim() || "未命名文档",
            summary: String(r.snippet ?? "").trim(),
          }))
          .filter((r) => r.documentId);
        onEvent({
          type: "document_table",
          title: `搜索结果（${rows.length}）`,
          rows,
        });
        return;
      }

      if (event.toolName === "list_my_documents") {
        const documents = (details?.documents as Array<{
          documentId?: string;
          displayName?: string;
          relativePath?: string;
        }> | undefined) ?? [];
        const rows = documents
          .map((d) => ({
            documentId: String(d.documentId ?? "").trim(),
            title: String(d.displayName ?? "").trim() || "未命名文档",
            summary: String(d.relativePath ?? "").trim(),
          }))
          .filter((r) => r.documentId);
        onEvent({
          type: "document_table",
          title: `我的文档（${rows.length}）`,
          rows,
        });
        return;
      }

      if (event.toolName === "list_tree") {
        const items = (details?.items as Array<{
          type?: string;
          documentId?: string;
          displayName?: string;
          name?: string;
          path?: string;
        }> | undefined) ?? [];
        const rows = items
          .map((it) => {
            const documentId = String(it.documentId ?? "").trim();
            const title =
              String(it.displayName ?? "").trim() ||
              String(it.name ?? "").trim() ||
              "未命名";
            const kind = it.type === "folder" ? "文件夹" : "文档";
            const path = String(it.path ?? "").trim();
            return {
              documentId,
              title: it.type === "folder" ? `[目录] ${title}` : title,
              summary: path ? `${kind} · ${path}` : kind,
            };
          })
          .filter((r) => r.documentId);
        onEvent({
          type: "document_table",
          title: `域树（${rows.length}${details?.truncated ? "+" : ""}）`,
          rows,
        });
        return;
      }

      if (event.toolName === "get_document") {
        const documentId = String(details?.documentId ?? "").trim();
        if (!documentId) return;
        const content = String(details?.content ?? "");
        const preview =
          content.length > 280 ? `${content.slice(0, 280)}…` : content;
        onEvent({
          type: "document_card",
          documentId,
          title: String(details?.displayName ?? "").trim() || "未命名文档",
          path: String(details?.relativePath ?? "").trim(),
          preview,
        });
        return;
      }

      if (event.toolName === "create_document") {
        const name = String(details?.displayName ?? "").trim() || "未命名文档";
        onEvent({
          type: "tool_notice",
          toolName: event.toolName,
          text: `已创建空文档「${name}」`,
        });
        return;
      }

      if (event.toolName === "create_folder") {
        const path = String(details?.path ?? "").trim();
        onEvent({
          type: "tool_notice",
          toolName: event.toolName,
          text: path ? `已创建文件夹「${path}」` : "已创建文件夹",
        });
        return;
      }

      if (event.toolName === "move_document") {
        const name = String(details?.displayName ?? "").trim() || "文档";
        const path = String(details?.relativePath ?? "").trim();
        onEvent({
          type: "tool_notice",
          toolName: event.toolName,
          text: path ? `已移动「${name}」→ ${path}` : `已移动「${name}」`,
        });
        return;
      }

      if (event.toolName === "get_working_document") {
        onEvent({
          type: "tool_notice",
          toolName: event.toolName,
          text: "读取帮写工作稿",
        });
        return;
      }

      if (event.toolName === "set_markdown_document") {
        const markdown = String(details?.markdown ?? "");
        onEvent({ type: "markdown_set", markdown });
        onEvent({
          type: "tool_notice",
          toolName: event.toolName,
          text: "设置帮写正文",
        });
      }
    }
  };
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
