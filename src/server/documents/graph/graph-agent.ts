/**
 * 图谱专用的 Agent 工具。
 *
 * 基于 @earendil-works/pi-agent-core + @earendil-works/pi-ai 构建。
 * 提供两种用法：
 * 1. runComplete — 纯文本单轮问答（简单场景）
 * 2. runToolExtractionWithFallback — 通过「主 tool + 降级 tool」提取结构化数据
 *
 * 每次调用创建一个新的 Agent 实例，没有状态残留。
 */
import { Agent, type AgentTool } from '@earendil-works/pi-agent-core';
import { createModels, createProvider } from '@earendil-works/pi-ai';
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import type { Model, TSchema } from '@earendil-works/pi-ai';
import { z } from 'zod';

export type GraphAgentApiType = 'openai-completions' | 'anthropic-messages';

export interface GraphAgentConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  apiType?: GraphAgentApiType;
  compat?: {
    supportsDeveloperRole?: boolean;
    supportsReasoningEffort?: boolean;
  };
  /** 模型上下文窗口大小，默认 200k */
  contextWindow?: number;
  /** 最大输出 token，默认 4096 */
  maxTokens?: number;
}

/**
 * Tool 定义 —— 由业务模块提供，注入给 runToolExtraction 使用。
 *
 * 业务侧只需要关心：tool 叫什么、干什么、参数 schema 是什么。
 * 不用关心 Agent 内部怎么注册、怎么监听事件。
 *
 * parameters 使用 TypeBox (Type.Object) 定义，与 pi-ai 生态一致。
 */
export interface GraphToolDefinition<TParams = any> {
  /** tool 名称 */
  name: string;
  /** tool 描述（告诉 AI 什么时候用、干什么） */
  description: string;
  /** 参数的 TypeBox schema */
  parameters: TSchema;
  /** Zod schema，用于运行时校验和类型推断 */
  schema: z.ZodSchema<TParams>;
}

// ========== 纯文本问答 ==========

/**
 * 单轮纯文本问答。
 * 每次调用创建一个新的 Agent，没有状态残留。
 */
export async function runComplete(
  config: GraphAgentConfig,
  system: string,
  user: string,
): Promise<string> {
  const agent = createAgent(config);

  return new Promise((resolve, reject) => {
    let fullText = '';

    const unsubscribe = agent.subscribe((event: any) => {
      if (
        event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta'
      ) {
        fullText += event.assistantMessageEvent.delta;
      }
      if (event.type === 'agent_end') {
        unsubscribe();
        resolve(fullText.trim());
      }
    });

    agent.state.systemPrompt = system;
    agent.prompt(user).catch((err: unknown) => {
      unsubscribe();
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

// ========== Tool 结构化输出（主 + 降级） ==========

/**
 * 通过「主 tool + 降级 tool」提取结构化数据。
 *
 * 当 AI 认为无法产出有效结果时，可以调用降级 tool 说明原因。
 * 两个 tool 二选一，AI 必须调用其中一个。
 *
 * 外部调用方不需要感知降级逻辑 —— 如果降级了，各链路自己处理成空数组等默认值。
 *
 * @param config Agent 配置
 * @param primaryTool 正常结果 tool
 * @param fallbackTool 降级结果 tool（参数通常带 reason 字段）
 * @param systemPrompt 系统提示词
 * @param userPrompt 用户提示词
 * @returns 成功返回 { ok: true; data: TPrimary }，降级返回 { ok: false; reason: string }
 */
export async function runToolExtractionWithFallback<TPrimary, TFallback extends { reason?: string }>(
  config: GraphAgentConfig,
  primaryTool: GraphToolDefinition<TPrimary>,
  fallbackTool: GraphToolDefinition<TFallback>,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ ok: true; data: TPrimary } | { ok: false; reason: string }> {
  const primarySpec = buildAgentTool(primaryTool, (params) => ({
    result: { ok: true, data: params as TPrimary },
  }));
  const fallbackSpec = buildAgentTool(fallbackTool, (params) => {
    const fallback = params as TFallback;
    return {
      result: { ok: false, reason: fallback.reason ?? '无法生成结果' },
    };
  });

  const agent = createAgent(config, [primarySpec, fallbackSpec]);

  return new Promise((resolve, reject) => {
    let result: { ok: true; data: TPrimary } | { ok: false; reason: string } | null = null;

    const unsubscribe = agent.subscribe((event: any) => {
      // 任一 tool 执行完成都存结果（tool 返回 terminate: true，agent 随后会结束）
      if (event.type === 'tool_execution_end') {
        result = event.result?.details;
      }

      if (event.type === 'agent_end') {
        unsubscribe();
        if (result !== null) {
          resolve(result);
        } else {
          reject(new Error('Agent 结束但未调用任何结果 tool'));
        }
      }
    });

    const fullSystemPrompt = `${systemPrompt}

重要：你必须调用 ${primaryTool.name} 或 ${fallbackTool.name} 其中一个工具来提交结果，不能直接用文本回答。
- 如果能正常提取/归纳/生成结果 → 调用 ${primaryTool.name}
- 如果内容太少或无法生成有效结果 → 调用 ${fallbackTool.name} 并说明原因`;

    agent.state.systemPrompt = fullSystemPrompt;

    agent.prompt(userPrompt).catch((err: unknown) => {
      unsubscribe();
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/** 把 GraphToolDefinition 转成 AgentTool（共享构造逻辑） */
function buildAgentTool<T>(
  tool: GraphToolDefinition<T>,
  onExecute: (params: T) => { result: any },
): AgentTool {
  return {
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    async execute(_toolCallId: string, params: unknown) {
      const { result } = onExecute(params as T);
      return {
        content: [{ type: 'text', text: '结果已收到。' }],
        details: result,
        terminate: true,
      };
    },
  } as unknown as AgentTool;
}

// ========== 内部：创建 Agent ==========

function createAgent(config: GraphAgentConfig, tools: AgentTool[] = []): Agent {
  const providerId = 'graph-llm';
  const apiType = config.apiType ?? 'anthropic-messages';
  const auth = {
    apiKey: {
      name: 'Graph LLM API key',
      async resolve() {
        return { auth: { apiKey: config.apiKey }, source: 'graph_config' as const };
      },
    },
  };

  const models = createModels();
  if (apiType === 'anthropic-messages') {
    const model: Model<'anthropic-messages'> = {
      id: config.modelId,
      name: config.modelId,
      api: 'anthropic-messages',
      provider: providerId,
      baseUrl: config.baseUrl,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: config.contextWindow ?? 200000,
      maxTokens: config.maxTokens ?? 4096,
      reasoning: false,
    };
    models.setProvider(
      createProvider({
        id: providerId,
        name: 'Graph LLM',
        baseUrl: config.baseUrl,
        auth,
        models: [model],
        api: anthropicMessagesApi(),
      }),
    );
  } else {
    const model: Model<'openai-completions'> = {
      id: config.modelId,
      name: config.modelId,
      api: 'openai-completions',
      provider: providerId,
      baseUrl: config.baseUrl,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: config.contextWindow ?? 200000,
      maxTokens: config.maxTokens ?? 4096,
      reasoning: true,
      compat: config.compat,
    };
    models.setProvider(
      createProvider({
        id: providerId,
        name: 'Graph LLM',
        baseUrl: config.baseUrl,
        auth,
        models: [model],
        api: openAICompletionsApi(),
      }),
    );
  }

  const resolved = models.getModel(providerId, config.modelId);
  if (!resolved) {
    throw new Error(`模型 ${config.modelId} 未找到`);
  }

  return new Agent({
    initialState: {
      systemPrompt: '',
      model: resolved,
      tools,
    },
    streamFn: models.streamSimple.bind(models),
  });
}
