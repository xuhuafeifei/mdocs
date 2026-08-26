/**
 * 知识图谱构建主入口。
 *
 * 唯一对外接口：buildGraph(rootNode, deps, options?)
 * - 文档：meta.dirty === false 则复用文章缓存；否则重提并写回 dirty:false + 新 commitId
 * - 目录：meta.dirty === false 则整包复用；否则后序子树 + aggregateAndInduce
 * - options.force === true（显式「生成/重新生成」）忽略 dirty，强制重算
 */
import type { TreeNode } from '../../../shared/types/tree.js';
import type {
  ConceptNode,
  DocNode,
  Graph,
  GraphDeps,
  GraphEdge,
  GraphNode,
} from './types.js';
import { makeNodeId, findRootNodes } from './utils.js';

export type BuildGraphOptions = {
  /** 显式重新生成时忽略缓存 dirty */
  force?: boolean;
};

export async function buildGraph(
  rootNode: TreeNode,
  deps: GraphDeps,
  options: BuildGraphOptions = {},
): Promise<Graph> {
  if (rootNode.type === 'document') {
    return buildDocumentGraph(rootNode.documentId, deps, options);
  }
  return buildFolderGraph(rootNode, deps, options);
}

async function buildDocumentGraph(
  documentId: string,
  deps: GraphDeps,
  options: BuildGraphOptions,
): Promise<Graph> {
  const cached = await deps.readArticleCache(documentId);
  if (!options.force && cached && cached.meta.dirty === false) {
    return { nodes: cached.nodes, edges: cached.edges };
  }

  const currentCommitId = await deps.getCurrentCommitId(documentId);
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

  await deps.writeArticleCache(documentId, {
    version: 1,
    meta: { commitId: currentCommitId, dirty: false },
    nodes,
    edges: [],
  });

  return { nodes, edges: [] };
}

async function buildFolderGraph(
  folderNode: Extract<TreeNode, { type: 'folder' }>,
  deps: GraphDeps,
  options: BuildGraphOptions,
): Promise<Graph> {
  if (!options.force) {
    const cached = await deps.readDirGraph(folderNode.documentId);
    if (cached && cached.meta.dirty === false) {
      return { nodes: cached.nodes, edges: cached.edges };
    }
  }

  const childGraphs: Graph[] = [];
  for (const child of folderNode.children) {
    childGraphs.push(await buildGraph(child, deps, options));
  }

  const result = await aggregateAndInduce(childGraphs, deps);

  await deps.writeDirGraph(folderNode.documentId, {
    version: 1,
    meta: { dirty: false },
    nodes: result.nodes,
    edges: result.edges,
  });

  return result;
}

export async function aggregateAndInduce(
  childGraphs: Graph[],
  deps: GraphDeps,
): Promise<Graph> {
  const allNodes = childGraphs.flatMap((g) => g.nodes);
  const allEdges = childGraphs.flatMap((g) => g.edges);

  const topLevelNodes = findRootNodes(allNodes, allEdges);

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

  const nodesForContains: GraphNode[] = [...topLevelNodes, ...newConcepts];
  const containsEdges = await deps.generateContains(nodesForContains);

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

  return {
    nodes: [...allNodes, ...newConcepts],
    edges: [...allEdges, ...containsEdges, ...conceptRelationEdges],
  };
}
