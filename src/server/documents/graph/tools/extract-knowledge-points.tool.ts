/**
 * Tool：提交提取到的知识要点。
 *
 * 用在 extractDocNodes 链路：
 * AI 读完文章后调用这个 tool，把提取到的知识要点作为参数提交。
 */
import { Type, type Static } from '@earendil-works/pi-ai';
import { z } from 'zod';
import type { GraphToolDefinition } from '../graph-agent.js';

// TypeBox schema（发给 API 用）
export const extractKnowledgePointsParameters = Type.Object({
  nodes: Type.Array(
    Type.Object({
      label: Type.String({ description: '要点标题，简洁明了' }),
      definition: Type.Optional(Type.String({ description: '如果是概念定义，填写准确定义' })),
      description: Type.String({ description: '要点的完整描述' }),
      confidence: Type.Number({ description: '提取的置信度，0-1' }),
      heading: Type.Optional(Type.String({ description: '对应文章中的小标题，如果有的话' })),
    }),
    { description: '知识要点列表' },
  ),
});

// Zod schema（运行时校验 + 类型推断用）
export const extractKnowledgePointsSchema = z.object({
  nodes: z.array(
    z.object({
      label: z.string().min(1),
      definition: z.string().optional(),
      description: z.string().min(1),
      confidence: z.number().min(0).max(1),
      heading: z.string().optional(),
    }),
  ),
});

export type ExtractKnowledgePointsResult = Static<typeof extractKnowledgePointsParameters>;

export const extractKnowledgePointsTool: GraphToolDefinition<ExtractKnowledgePointsResult> = {
  name: 'submitKnowledgePoints',
  description: '提交从文章中提取的知识要点列表。分析完文章后调用此工具提交结果。',
  parameters: extractKnowledgePointsParameters,
  schema: extractKnowledgePointsSchema,
};

// ========== 降级 tool ==========

export const noKnowledgePointsParameters = Type.Object({
  reason: Type.String({ description: '无法提取知识要点的原因' }),
});

export type NoKnowledgePointsResult = Static<typeof noKnowledgePointsParameters>;

export const noKnowledgePointsTool: GraphToolDefinition<NoKnowledgePointsResult> = {
  name: 'submitNoKnowledgePoints',
  description: '当文章内容太少或无法提取有效知识要点时，调用此工具说明原因。',
  parameters: noKnowledgePointsParameters,
  schema: z.object({ reason: z.string() }),
};
