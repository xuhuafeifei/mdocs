/**
 * Tool：提交生成的 contains 关系。
 *
 * 用在 generateContains 链路：
 * AI 分析完所有节点后调用这个 tool，把判断出的 contains 关系作为参数提交。
 */
import { Type, type Static } from '@earendil-works/pi-ai';
import { z } from 'zod';
import type { GraphToolDefinition } from '../graph-agent.js';

// TypeBox schema（发给 API 用）
export const generateContainsParameters = Type.Object({
  relations: Type.Array(
    Type.Object({
      fromId: Type.String({ description: '上层（更抽象）节点的 id' }),
      toId: Type.String({ description: '下层（更具体）节点的 id' }),
      confidence: Type.Number({ description: '关系的置信度，0-1' }),
    }),
    { description: '包含关系列表' },
  ),
});

// Zod schema（运行时校验 + 类型推断用）
export const generateContainsSchema = z.object({
  relations: z.array(
    z.object({
      fromId: z.string().min(1),
      toId: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export type GenerateContainsResult = Static<typeof generateContainsParameters>;

export const generateContainsTool: GraphToolDefinition<GenerateContainsResult> = {
  name: 'submitContainsRelations',
  description: '提交节点之间的 contains 包含关系列表。分析完成后调用此工具提交结果。',
  parameters: generateContainsParameters,
  schema: generateContainsSchema,
};

// ========== 降级 tool ==========

export const noContainsRelationsParameters = Type.Object({
  reason: Type.String({ description: '无法生成包含关系的原因' }),
});

export type NoContainsRelationsResult = Static<typeof noContainsRelationsParameters>;

export const noContainsRelationsTool: GraphToolDefinition<NoContainsRelationsResult> = {
  name: 'submitNoContainsRelations',
  description: '当节点太少或无法判断有效包含关系时，调用此工具说明原因。',
  parameters: noContainsRelationsParameters,
  schema: z.object({ reason: z.string() }),
};
