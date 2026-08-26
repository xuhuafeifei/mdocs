import type {
  ArticleGraphFile,
  DirGraphFile,
  Graph,
  GraphEdge,
  GraphNode,
} from "./types.js";

/** 旧文章缓存 `{ commitId, nodes }` 或新 GraphFile → ArticleGraphFile */
export function parseArticleGraphFile(raw: unknown): ArticleGraphFile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (o.meta && typeof o.meta === "object") {
    const meta = o.meta as Record<string, unknown>;
    if (typeof meta.commitId !== "string") return null;
    return {
      version: 1,
      meta: {
        commitId: meta.commitId,
        dirty: meta.dirty === true,
      },
      nodes: Array.isArray(o.nodes) ? (o.nodes as GraphNode[]) : [],
      edges: Array.isArray(o.edges) ? (o.edges as GraphEdge[]) : [],
    };
  }

  // 旧格式
  if (typeof o.commitId === "string" && Array.isArray(o.nodes)) {
    return {
      version: 1,
      meta: { commitId: o.commitId, dirty: false },
      nodes: o.nodes as GraphNode[],
      edges: [],
    };
  }
  return null;
}

/** 旧目录图 `{ nodes, edges }` 或新 GraphFile → DirGraphFile */
export function parseDirGraphFile(raw: unknown): DirGraphFile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.nodes)) return null;

  const edges = Array.isArray(o.edges) ? (o.edges as GraphEdge[]) : [];
  if (o.meta && typeof o.meta === "object") {
    const meta = o.meta as Record<string, unknown>;
    return {
      version: 1,
      meta: { dirty: meta.dirty === true },
      nodes: o.nodes as GraphNode[],
      edges,
    };
  }
  return {
    version: 1,
    meta: { dirty: false },
    nodes: o.nodes as GraphNode[],
    edges,
  };
}

export function graphFileToGraph(file: { nodes: GraphNode[]; edges: GraphEdge[] }): Graph {
  return { nodes: file.nodes, edges: file.edges };
}
