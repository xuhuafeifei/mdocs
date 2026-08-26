/**
 * 知识图谱构建主入口。
 *
 * 唯一对外接口：buildGraph(rootNode, deps)
 * - 输入一棵 TreeNode（可以是整棵树，也可以是某个子树的根）
 * - 后序遍历（自底向上）：先处理子节点，再处理当前目录
 * - 文档节点 → 提取 doc 节点 + 写缓存
 * - 目录节点 → 汇总子节点完整图谱 + 归纳顶层节点 concept + 生成 contains + 写目录级图谱
 *
 * 关键设计：
 * - 每层存完整子树图谱（所有节点 + 所有边），渲染时读一个文件即可
 * - 但喂给 AI 时只拿「入度为 0」的顶层节点，避免下层已归类节点被重复处理
 *
 * 所有 IO / AI 能力通过 GraphDeps 注入，核心模块纯逻辑可单测。
 */
import type { TreeNode } from '../../../shared/types/tree.js';
import type {
  ConceptNode,
  DocNode,
  Graph,
  GraphDeps,
  GraphNode,
} from './types.js';
import { makeNodeId, needRebuild, findRootNodes } from './utils.js';

/**
 * 构建知识图谱 —— 唯一入口。
 *
 * @param rootNode 根节点（folder 或 document 都可以）
 * @param deps 外部依赖（IO + AI 能力）
 */
export async function buildGraph(rootNode: TreeNode, deps: GraphDeps): Promise<Graph> {
  if (rootNode.type === 'document') {
    return buildDocumentGraph(rootNode.documentId, deps);
  }
  return buildFolderGraph(rootNode, deps);
}

// ========== 文档节点 ==========

async function buildDocumentGraph(
  documentId: string,
  deps: GraphDeps,
): Promise<Graph> {
  const currentCommitId = await deps.getCurrentCommitId(documentId);
  const cached = await deps.readArticleCache(documentId);

  // 有缓存且 commit 未变化 → 复用
  if (cached && !needRebuild(currentCommitId, cached.commitId)) {
    return { nodes: cached.nodes, edges: [] };
  }

  // 重新提取
  const markdown = await deps.readMarkdown(documentId);
  const stubs = await deps.extractDocNodes(markdown);

  const docTitle = await deps.getDocTitle(documentId);

  const nodes: DocNode[] = stubs.map((stub) => ({
    id: makeNodeId('doc', stub.label),
    type: 'doc',
    label: stub.label,
    definition: stub.definition,
    description: stub.description,
    confidence: stub.confidence,
    sources: [
      {
        type: 'doc' as const,
        documentId,
        title: docTitle,
        heading: stub.heading,
      },
    ],
  }));

  await deps.writeArticleCache(documentId, nodes, currentCommitId);

  return { nodes, edges: [] };
}

// ========== 目录节点 ==========

async function buildFolderGraph(
  folderNode: Extract<TreeNode, { type: 'folder' }>,
  deps: GraphDeps,
): Promise<Graph> {
  // 1. 后序遍历所有子节点
  const childGraphs: Graph[] = [];
  for (const child of folderNode.children) {
    const childGraph = await buildGraph(child, deps);
    childGraphs.push(childGraph);
  }

  // 2. 汇总 + 归纳 + 生成（公共逻辑）
  const result = await aggregateAndInduce(childGraphs, deps);

  // 3. 写目录级图谱缓存
  await deps.writeDirGraph(folderNode.documentId, result);

  return result;
}

// ========== 公共逻辑：汇总子图谱 + 顶层归纳 + 生成 contains ==========

/**
 * 把多个子图谱汇总，然后在顶层进行概念归纳和关系生成。
 *
 * 流程（每层都一样）：
 * 1. 汇总所有子节点的完整图谱（节点 + 边全量透传）
 * 2. 找出入度为 0 的顶层节点
 * 3. 基于顶层节点，归纳出更上层的 concept 节点
 * 4. 生成「顶层节点 ↔ 本层 concept」之间的 contains 关系（上下层）
 * 5. 生成「本层 concept」之间的横向关系（related_to / part_of / depends_on）
 * 6. 组装最终图谱（所有子节点数据 + 本层新增）
 *
 * 目录级和域级构建都复用这个逻辑。
 */
export async function aggregateAndInduce(
  childGraphs: Graph[],
  deps: GraphDeps,
): Promise<Graph> {
  // === 1. 汇总所有子图谱（全量透传）===
  const allNodes = childGraphs.flatMap((g) => g.nodes);
  const allEdges = childGraphs.flatMap((g) => g.edges);

  // === 2. 找出顶层节点（入度为 0）===
  const topLevelNodes = findRootNodes(allNodes, allEdges);

  // === 3. 归纳本层 concept 节点 ===
  const conceptStubs = await deps.induceConceptNodes(
    topLevelNodes.map((n) => ({ label: n.label, description: n.description })),
  );
  const newConcepts: ConceptNode[] = conceptStubs.map((stub) => ({
    id: makeNodeId('concept', stub.label),
    type: 'concept',
    label: stub.label,
    definition: stub.definition,
    description: stub.description,
    confidence: stub.confidence,
  }));

  // === 4. 上下层关系：顶层节点 ↔ 本层 concept 的 contains ===
  const nodesForContains: GraphNode[] = [...topLevelNodes, ...newConcepts];
  const containsEdges = await deps.generateContains(nodesForContains);

  // === 5. 横向关系：本层新生成的 concept 之间的关系 ===
  let conceptRelationEdges: GraphEdge[] = [];
  if (newConcepts.length >= 2) {
    const stubs = await deps.induceConceptRelations(newConcepts);
    conceptRelationEdges = stubs.map((r) => ({
      from: r.fromId,
      to: r.toId,
      type: r.type,
      confidence: r.confidence,
      description: r.description,
    }));
  }

  // === 6. 组装最终图谱 ===
  return {
    nodes: [...allNodes, ...newConcepts],
    edges: [...allEdges, ...containsEdges, ...conceptRelationEdges],
  };
}
