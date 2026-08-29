/**
 * 知识图谱构建主入口（纯逻辑，不依赖 Express / DB 具体实现）。
 *
 * - buildGraph(rootNode, deps, options?)：唯一核心入口
 * - 文档：dirty===false 复用文章缓存；否则 AI 提取并写回
 * - 目录：dirty===false 整包复用；否则后序子树再 aggregateAndInduce
 * - options.force===true：忽略 dirty 强制重算
 * - options.onArticle / onFolderPhase：进度回调（任务队列用来写日志）
 *
 * 对比 graph.service.buildGraphByDocId：那边是「id → 树 + deps」的胶水，最终仍调用本函数。
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
  /**
   * 文章级进度（每处理一篇叶子文档回调一次）。
   * index 为单次 buildGraph 内 0-based；跨多棵树的全局进度由调用方 counter 自己累加。
   */
  onArticle?: (event: {
    phase: "start" | "done" | "cached" | "failed";
    documentId: string;
    docPath: string;
    index: number;
    total: number;
    nodesExtracted?: number;
    durationMs?: number;
    error?: string;
  }) => void | Promise<void>;
  /** 目录归纳阶段（aggregateAndInduce 前后） */
  onFolderPhase?: (event: {
    phase: "induce" | "contains" | "relations" | "write";
    folderId: string;
    folderPath: string;
  }) => void | Promise<void>;
};

/** 统计子树中的文章叶子数（用于进度 total） */
export function countDocumentLeaves(node: TreeNode): number {
  if (node.type === "document") return 1;
  return node.children.reduce((sum, c) => sum + countDocumentLeaves(c), 0);
}

/**
 * 从根节点构建图谱。
 * 内部按类型分发到 buildDocumentGraph / buildFolderGraph；递归子节点时复用同一 ProgressCtx。
 */
export async function buildGraph(
  rootNode: TreeNode,
  deps: GraphDeps,
  options: BuildGraphOptions = {},
): Promise<Graph> {
  // 为本棵树准备进度上下文（子树递归共用 ctx，index 连续递增）
  const total =
    options.onArticle && rootNode.type === "folder"
      ? countDocumentLeaves(rootNode)
      : rootNode.type === "document"
        ? 1
        : countDocumentLeaves(rootNode);
  const ctx: ProgressCtx = {
    total: Math.max(total, 1),
    index: 0,
    onArticle: options.onArticle,
    onFolderPhase: options.onFolderPhase,
  };

  if (rootNode.type === "document") {
    return buildDocumentGraph(rootNode, deps, options, ctx);
  }
  return buildFolderGraph(rootNode, deps, options, ctx);
}

type ProgressCtx = {
  total: number;
  index: number;
  onArticle?: BuildGraphOptions["onArticle"];
  onFolderPhase?: BuildGraphOptions["onFolderPhase"];
};

/** 单篇文章：读缓存或 AI 提取 doc 节点，写文章级 __graph__ 缓存 */
async function buildDocumentGraph(
  docNode: Extract<TreeNode, { type: "document" }>,
  deps: GraphDeps,
  options: BuildGraphOptions,
  ctx: ProgressCtx,
): Promise<Graph> {
  const documentId = docNode.documentId;
  const docPath =
    docNode.displayName || docNode.name || docNode.path || documentId;
  const index = ctx.index;
  ctx.index += 1;

  // 干净缓存且非 force → 直接复用
  const cached = await deps.readArticleCache(documentId);
  if (!options.force && cached && cached.meta.dirty === false) {
    await ctx.onArticle?.({
      phase: "cached",
      documentId,
      docPath,
      index,
      total: ctx.total,
      nodesExtracted: cached.nodes.length,
      durationMs: 0,
    });
    return { nodes: cached.nodes, edges: cached.edges };
  }

  await ctx.onArticle?.({
    phase: "start",
    documentId,
    docPath,
    index,
    total: ctx.total,
  });

  const startedAt = Date.now();
  try {
    const currentCommitId = await deps.getCurrentCommitId(documentId);
    const markdown = await deps.readMarkdown(documentId);
    const stubs = await deps.extractDocNodes(markdown);
    const docTitle = await deps.getDocTitle(documentId);

    const nodes: DocNode[] = stubs.map((stub) => ({
      id: makeNodeId("doc", stub.label),
      type: "doc",
      label: stub.label,
      definition: stub.definition,
      description: stub.description,
      confidence: stub.confidence,
      sources: [
        {
          type: "doc" as const,
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

    await ctx.onArticle?.({
      phase: "done",
      documentId,
      docPath,
      index,
      total: ctx.total,
      nodesExtracted: nodes.length,
      durationMs: Date.now() - startedAt,
    });

    return { nodes, edges: [] };
  } catch (err: any) {
    await ctx.onArticle?.({
      phase: "failed",
      documentId,
      docPath,
      index,
      total: ctx.total,
      durationMs: Date.now() - startedAt,
      error: err?.message ?? String(err),
    });
    throw err;
  }
}

/**
 * 目录：后序处理子节点，再对本层做归纳并写 ___graph___.json。
 * 子节点通过 buildGraphWithCtx 复用同一 ProgressCtx（文章序号不重置）。
 */
async function buildFolderGraph(
  folderNode: Extract<TreeNode, { type: "folder" }>,
  deps: GraphDeps,
  options: BuildGraphOptions,
  ctx: ProgressCtx,
): Promise<Graph> {
  // 目录级干净缓存且非 force → 整包返回（子文章不会再走 onArticle）
  if (!options.force) {
    const cached = await deps.readDirGraph(folderNode.documentId);
    if (cached && cached.meta.dirty === false) {
      return { nodes: cached.nodes, edges: cached.edges };
    }
  }

  const childGraphs: Graph[] = [];
  for (const child of folderNode.children) {
    childGraphs.push(await buildGraphWithCtx(child, deps, options, ctx));
  }

  const folderPath = folderNode.path || folderNode.name;
  await ctx.onFolderPhase?.({
    phase: "induce",
    folderId: folderNode.documentId,
    folderPath,
  });

  const result = await aggregateAndInduce(childGraphs, deps);

  await ctx.onFolderPhase?.({
    phase: "write",
    folderId: folderNode.documentId,
    folderPath,
  });

  await deps.writeDirGraph(folderNode.documentId, {
    version: 1,
    meta: { dirty: false },
    nodes: result.nodes,
    edges: result.edges,
  });

  return result;
}

/** 递归时复用同一 ProgressCtx，避免子树重新从 0 计数 */
async function buildGraphWithCtx(
  rootNode: TreeNode,
  deps: GraphDeps,
  options: BuildGraphOptions,
  ctx: ProgressCtx,
): Promise<Graph> {
  if (rootNode.type === "document") {
    return buildDocumentGraph(rootNode, deps, options, ctx);
  }
  return buildFolderGraph(rootNode, deps, options, ctx);
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
