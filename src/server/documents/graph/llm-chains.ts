/**
 * 三条 AI 链路 —— 基于 Tool 方式输出结构化结果。
 *
 * 每条链路都有「正常 tool + 降级 tool」，AI 二选一调用。
 * 外部接口统一返回正常数据（降级时返回空数组，外部不感知降级）。
 *
 * 1. extractDocNodes    — 文章 → doc 节点
 * 2. induceConceptNodes — doc 节点 → concept 节点
 * 3. generateContains   — 顶层节点 → contains 关系
 */
import { runToolExtractionWithFallback, type GraphAgentConfig } from './graph-agent.js';
import {
  extractKnowledgePointsTool,
  noKnowledgePointsTool,
} from './tools/extract-knowledge-points.tool.js';
import {
  induceConceptsTool,
  noConceptsTool,
} from './tools/induce-concepts.tool.js';
import {
  generateContainsTool,
  noContainsRelationsTool,
} from './tools/generate-contains.tool.js';
import {
  conceptRelationsTool,
  noConceptRelationsTool,
} from './tools/concept-relations.tool.js';
import type {
  ConceptNodeStub,
  ConceptRelationStub,
  DocNodeStub,
  GraphEdge,
  GraphNode,
} from './types.js';

// ========== 链路 1：从文章提取 doc 节点 ==========

const EXTRACT_DOC_NODES_SYSTEM = `你是一个知识提取专家。你的任务是从给定的 Markdown 文章中提取若干个独立的知识要点。

要求：
1. 每个知识要点是一个独立的知识点（概念、规则、方法等）
2. 提取 3-10 个要点，粒度适中，不要太细也不要太粗
3. 每个要点必须包含 label、description、confidence
4. 如果是概念定义，可以填写 definition 字段
5. 如果要点对应文章中的某个小标题，填写 heading 字段
6. 分析完成后，调用 submitKnowledgePoints 或 submitNoKnowledgePoints 之一提交结果`;

/**
 * 从文章 Markdown 中提取 doc 节点。
 * 内容太少或无法提取时返回空数组。
 */
export async function extractDocNodes(
  markdown: string,
  agentConfig: GraphAgentConfig,
): Promise<DocNodeStub[]> {
  const result = await runToolExtractionWithFallback(
    agentConfig,
    extractKnowledgePointsTool,
    noKnowledgePointsTool,
    EXTRACT_DOC_NODES_SYSTEM,
    `请从以下文章中提取知识要点：

${markdown}`,
  );

  if (result.ok) return result.data.nodes;
  return [];
}

// ========== 链路 2：从 doc 节点归纳 concept 节点 ==========

const INDUCE_CONCEPT_SYSTEM = `你是一个知识归纳专家。你的任务是从一组知识节点中归纳出若干上层概念。

要求：
1. 每个上层概念是对多个相关知识节点的抽象概括
2. 概念数量约为输入节点数的 1/3 ~ 1/5，宁缺毋滥
3. 允许多父（一个知识节点可属于多个上层概念）
4. 合并不了的节点可以不归，不强求全覆盖
5. 每个概念至少能覆盖 2 个输入节点
6. 分析完成后，调用 submitInducedConcepts 或 submitNoConcepts 之一提交结果`;

/**
 * 从 doc 节点中归纳出 concept 节点。
 * 节点太少或无法归纳时返回空数组。
 */
export async function induceConceptNodes(
  docNodes: { label: string; description: string }[],
  agentConfig: GraphAgentConfig,
): Promise<ConceptNodeStub[]> {
  if (docNodes.length < 2) return [];

  const nodesList = docNodes
    .map((n, i) => `${i + 1}. ${n.label}：${n.description}`)
    .join('\n');

  const result = await runToolExtractionWithFallback(
    agentConfig,
    induceConceptsTool,
    noConceptsTool,
    INDUCE_CONCEPT_SYSTEM,
    `请从以下知识节点中归纳上层概念：

${nodesList}`,
  );

  if (result.ok) return result.data.concepts;
  return [];
}

// ========== 链路 3：生成 contains 关系 ==========

const GENERATE_CONTAINS_SYSTEM = `你是一个知识图谱关系专家。你的任务是判断知识节点之间的包含关系。

包含关系定义：
- A contains B 表示 A 更抽象、更宽泛，B 更具体、是 A 的一部分或子概念
- concept 类型的节点可以包含 doc 节点，也可以包含更具体的 concept 节点
- 方向一定是：上层（抽象） → 下层（具体）

要求：
1. 只输出高置信度的包含关系，宁缺毋滥
2. fromId 是更抽象节点的 id，toId 是更具体节点的 id
3. **严格使用输入中给出的 id，不要自己编造**
4. 分析完成后，调用 submitContainsRelations 或 submitNoContainsRelations 之一提交结果`;

/**
 * 为节点生成 contains 关系。
 * 无法判断时返回空数组。
 */
export async function generateContains(
  nodes: GraphNode[],
  agentConfig: GraphAgentConfig,
): Promise<GraphEdge[]> {
  if (nodes.length < 2) return [];

  const nodesList = nodes
    .map(
      (n) =>
        `- id: ${n.id}\n  type: ${n.type}\n  label: ${n.label}\n  description: ${n.description}`,
    )
    .join('\n\n');

  const result = await runToolExtractionWithFallback(
    agentConfig,
    generateContainsTool,
    noContainsRelationsTool,
    GENERATE_CONTAINS_SYSTEM,
    `请判断以下节点之间的包含关系：

${nodesList}`,
  );

  if (result.ok) {
    return result.data.relations.map((r) => ({
      from: r.fromId,
      to: r.toId,
      type: 'contains' as const,
      confidence: r.confidence,
    }));
  }
  return [];
}

// ========== 链路 4：生成 concept 之间的关系 ==========

const CONCEPT_RELATIONS_SYSTEM = `你是一个知识图谱关系专家。你的任务是分析一组概念，找出它们之间的关系。

关系类型定义：
- related_to：两个概念相关，但没有明确的包含/依赖关系
- part_of：A part_of B 表示 A 是 B 的一部分 / 子领域
- depends_on：A depends_on B 表示 A 依赖于 B（B 是 A 的前提或基础）

要求：
1. 只输出高置信度的关系，宁缺毋滥
2. fromId 和 toId 必须是输入中给出的概念 id，不要编造
3. 关系方向要准确：
   - part_of：部分 → 整体（小的 → 大的）
   - depends_on：依赖方 → 被依赖方
   - related_to：方向不敏感，但也要有意义
4. 避免重复的关系（互为 related_to 算重复）
5. 分析完成后，调用 submitConceptRelations 或 submitNoConceptRelations 之一提交结果`;

/**
 * 归纳 concept 节点之间的关系。
 * 节点太少或无法判断时返回空数组。
 */
export async function induceConceptRelations(
  concepts: { id: string; label: string; description: string }[],
  agentConfig: GraphAgentConfig,
): Promise<ConceptRelationStub[]> {
  if (concepts.length < 2) return [];

  const conceptsList = concepts
    .map(
      (n, i) => `${i + 1}. id: ${n.id}\n   label: ${n.label}\n   description: ${n.description}`,
    )
    .join('\n\n');

  const result = await runToolExtractionWithFallback(
    agentConfig,
    conceptRelationsTool,
    noConceptRelationsTool,
    CONCEPT_RELATIONS_SYSTEM,
    `请分析以下概念之间的关系：

${conceptsList}`,
  );

  if (result.ok) return result.data.relations;
  return [];
}
