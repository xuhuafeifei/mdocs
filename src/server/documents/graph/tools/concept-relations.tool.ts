/**
 * Tool：提交 concept 节点之间的关系。
 *
 * 用在 induceConceptRelations 链路：
 * AI 分析完所有 concept 节点后调用这个 tool，提交概念之间的关系。
 */
import { Type, type Static } from '@earendil-works/pi-ai';
import { z } from 'zod';
import type { GraphToolDefinition } from '../graph-agent.js';

// TypeBox schema（发给 API 用）
export const conceptRelationsParameters = Type.Object({
  relations: Type.Array(
    Type.Object({
      fromId: Type.String({ description: '起点概念的 id（必须与输入中的 id 完全一致）' }),
      toId: Type.String({ description: '终点概念的 id（必须与输入中的 id 完全一致）' }),
      type: Type.Union(
        [
          Type.Literal('related_to'),
          Type.Literal('part_of'),
          Type.Literal('depends_on'),
        ],
        { description: '关系类型：related_to（相关）、part_of（属于）、depends_on（依赖）' },
      ),
      description: Type.Optional(Type.String({ description: '关系的简要说明' })),
      confidence: Type.Number({ description: '关系的置信度，0-1' }),
    }),
    { description: '概念之间的关系列表' },
  ),
});

// Zod schema（运行时校验 + 类型推断用）
export const conceptRelationsSchema = z.object({
  relations: z.array(
    z.object({
      fromId: z.string().min(1),
      toId: z.string().min(1),
      type: z.enum(['related_to', 'part_of', 'depends_on']),
      description: z.string().optional(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export type ConceptRelationsResult = Static<typeof conceptRelationsParameters>;

export const conceptRelationsTool: GraphToolDefinition<ConceptRelationsResult> = {
  name: 'submitConceptRelations',
  description:
    '提交概念节点之间的关系列表。分析完所有概念后调用此工具提交结果。',
  parameters: conceptRelationsParameters,
  schema: conceptRelationsSchema,
};

// ========== 降级 tool ==========

export const noConceptRelationsParameters = Type.Object({
  reason: Type.String({ description: '无法生成概念关系的原因' }),
});

export type NoConceptRelationsResult = Static<typeof noConceptRelationsParameters>;

export const noConceptRelationsTool: GraphToolDefinition<NoConceptRelationsResult> = {
  name: 'submitNoConceptRelations',
  description: '当概念太少或无法判断有效关系时，调用此工具说明原因。',
  parameters: noConceptRelationsParameters,
  schema: z.object({ reason: z.string() }),
};
