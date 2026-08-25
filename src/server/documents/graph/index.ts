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

  // 2. 汇总所有子节点的完整图谱（节点 + 边全量透传）
  const allNodes = childGraphs.flatMap((g) => g.nodes);
  const allEdges = childGraphs.flatMap((g) => g.edges);

  // 3. 找出「入度为 0」的顶层节点
  // 只有顶层节点才参与本层的 concept 归纳和 contains 生成，
  // 避免下层已经被归类的节点被重复处理
  const rootNodes = findRootNodes(allNodes, allEdges);

  // 4. 基于顶层节点中的 doc 节点，归纳 concept 节点
  const rootDocNodes = rootNodes.filter((n): n is DocNode => n.type === 'doc');
  const conceptStubs = await deps.induceConceptNodes(
    rootDocNodes.map((n) => ({ label: n.label, description: n.description })),
  );

  const conceptNodes: ConceptNode[] = conceptStubs.map((stub) => ({
    id: makeNodeId('concept', stub.label),
    type: 'concept',
    label: stub.label,
    definition: stub.definition,
    description: stub.description,
    confidence: stub.confidence,
  }));

  // 5. 生成 contains 关系
  // 输入：顶层节点 + 本层新生成的 concept（都属于本层的"顶层"）
  const nodesForContains: GraphNode[] = [...rootNodes, ...conceptNodes];
  const newEdges = await deps.generateContains(nodesForContains);

  // 6. 组装最终图谱（所有下层数据 + 本层新增）
  const result: Graph = {
    nodes: [...allNodes, ...conceptNodes],
    edges: [...allEdges, ...newEdges],
  };

  // 7. 写目录级图谱缓存
  await deps.writeDirGraph(folderNode.documentId, result);

  return result;
}
