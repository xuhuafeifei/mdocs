/**
 * Tool：提交归纳出的上层概念。
 *
 * 用在 induceConceptNodes 链路：
 * AI 读完所有 doc 节点后调用这个 tool，把归纳出的上层概念作为参数提交。
 */
import { Type, type Static } from '@earendil-works/pi-ai';
import { z } from 'zod';
import type { GraphToolDefinition } from '../graph-agent.js';

// TypeBox schema（发给 API 用）
export const induceConceptsParameters = Type.Object({
  concepts: Type.Array(
    Type.Object({
      label: Type.String({ description: '概念名称' }),
      definition: Type.Optional(Type.String({ description: '如果有准确定义，填写此字段' })),
      description: Type.String({ description: '概念的完整描述' }),
      confidence: Type.Number({ description: '归纳的置信度，0-1' }),
    }),
    { description: '上层概念列表' },
  ),
});

// Zod schema（运行时校验 + 类型推断用）
export const induceConceptsSchema = z.object({
  concepts: z.array(
    z.object({
      label: z.string().min(1),
      definition: z.string().optional(),
      description: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export type InduceConceptsResult = Static<typeof induceConceptsParameters>;

export const induceConceptsTool: GraphToolDefinition<InduceConceptsResult> = {
  name: 'submitInducedConcepts',
  description: '提交从知识节点中归纳出的上层概念列表。分析完成后调用此工具提交结果。',
  parameters: induceConceptsParameters,
  schema: induceConceptsSchema,
};

// ========== 降级 tool ==========

export const noConceptsParameters = Type.Object({
  reason: Type.String({ description: '无法归纳上层概念的原因' }),
});

export type NoConceptsResult = Static<typeof noConceptsParameters>;

export const noConceptsTool: GraphToolDefinition<NoConceptsResult> = {
  name: 'submitNoConcepts',
  description: '当节点太少或无法归纳出有效上层概念时，调用此工具说明原因。',
  parameters: noConceptsParameters,
  schema: z.object({ reason: z.string() }),
};
