/**
 * 知识图谱核心类型定义。
 *
 * 节点分两类（都是知识节点，只是来源不同）：
 * - doc: 从单篇文章直接提取的知识块，带 sources（记录来源文章）
 * - concept: 从已有节点中归纳抽象出的概念，不带 sources
 *
 * 边：
 * - contains：上层包含下层（抽象 → 具体），concept 可以包含 doc 或更具体的 concept
 */

/** 知识来源 —— 来自某篇文章（可选具体标题锚点） */
export interface DocSource {
  /** 来源类型，目前只有 doc */
  type: 'doc';
  /** 来源文档 ID */
  documentId: string;
  /** 来源文章标题（冗余，便于展示） */
  title: string;
  /** 可选，来源文章内的小标题锚点 */
  heading?: string;
}

/**
 * doc 节点 —— 从单篇文章中直接提取的知识块。
 * 带 sources 数组，记录这个知识块来自哪篇文章。
 */
export interface DocNode {
  /** 节点 id，格式 doc:{slug}-{4位随机数} */
  id: string;
  /** 节点类型，固定 'doc' */
  type: 'doc';
  /** 节点标题/名称（显示用） */
  label: string;
  /** 准确定义（如果这个知识块是某个概念的定义） */
  definition?: string;
  /** 一段完整的描述（必填，至少有这个） */
  description: string;
  /** AI 置信度，0-1 */
  confidence: number;
  /** 来源文章列表 */
  sources: DocSource[];
}

/**
 * concept 节点 —— 从已有 doc/concept 节点中归纳抽象出的上层概念。
 * 不带 sources，因为它是归纳出来的，不直接来自某篇文章。
 */
export interface ConceptNode {
  /** 节点 id，格式 concept:{slug}-{4位随机数} */
  id: string;
  /** 节点类型，固定 'concept' */
  type: 'concept';
  /** 概念名称（显示用） */
  label: string;
  /** 准确定义（如果有） */
  definition?: string;
  /** 一段完整的描述（必填） */
  description: string;
  /** AI 置信度，0-1 */
  confidence: number;
}

/** 图谱节点 = doc 节点 + concept 节点 */
export type GraphNode = DocNode | ConceptNode;

/**
 * 图谱边 —— 节点之间的关系。
 */
export interface GraphEdge {
  /** 起点节点 id（上层/更抽象） */
  from: string;
  /** 终点节点 id（下层/更具体） */
  to: string;
  /** 关系类型 */
  type: 'contains' | 'related_to' | 'part_of' | 'depends_on';
  /** AI 置信度，0-1 */
  confidence: number;
  /** 关系描述（可选） */
  description?: string;
}

/** 图谱 = 节点集合 + 边集合（构建内存态） */
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** 文章级落盘 meta：commitId = 上次成功抽图时的 commit */
export type ArticleGraphMeta = {
  commitId: string;
  dirty: boolean;
};

/** 目录 / 域落盘 meta */
export type DirGraphMeta = {
  dirty: boolean;
};

/** 落盘完整图文件 */
export type GraphFile<M extends ArticleGraphMeta | DirGraphMeta = DirGraphMeta> = {
  version: 1;
  meta: M;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type ArticleGraphFile = GraphFile<ArticleGraphMeta>;
export type DirGraphFile = GraphFile<DirGraphMeta>;

/**
 * LLM 原始输出 —— doc 节点桩。
 * AI 只输出 label/description 等内容字段，
 * id / type / sources 由外层代码补全。
 */
export interface DocNodeStub {
  /** 节点标题 */
  label: string;
  /** 定义（可选） */
  definition?: string;
  /** 描述（必填） */
  description: string;
  /** 置信度 */
  confidence: number;
  /** 对应文章内的标题（可选，AI 能对应上就填） */
  heading?: string;
}

/**
 * LLM 原始输出 —— concept 节点桩。
 * AI 只输出内容字段，id / type 由外层代码补全。
 */
export interface ConceptNodeStub {
  /** 概念名称 */
  label: string;
  /** 定义（可选） */
  definition?: string;
  /** 描述（必填） */
  description: string;
  /** 置信度 */
  confidence: number;
}

/**
 * LLM 原始输出 —— concept 关系桩。
 */
export interface ConceptRelationStub {
  /** 起点概念 id */
  fromId: string;
  /** 终点概念 id */
  toId: string;
  /** 关系类型 */
  type: 'related_to' | 'part_of' | 'depends_on';
  /** 关系描述 */
  description?: string;
  /** 置信度 */
  confidence: number;
}

import type { TreeNode } from '../../../shared/types/tree.js';

/**
 * 外部 IO 依赖 —— 全部通过注入方式传入。
 *
 * 核心模块不直接依赖 mdocs 运行时、不感知 AI 实现方式，
 * 所有读写、AI 调用都通过这个接口，方便单测 mock，也方便未来更换实现。
 */
export interface GraphDeps {
  // —— AI 能力 ——
  /** 从文章 Markdown 中提取 doc 节点 */
  extractDocNodes(markdown: string): Promise<DocNodeStub[]>;
  /** 从 doc 节点中归纳 concept 节点 */
  induceConceptNodes(docNodes: { label: string; description: string }[]): Promise<ConceptNodeStub[]>;
  /** 归纳 concept 节点之间的关系 */
  induceConceptRelations(concepts: { id: string; label: string; description: string }[]): Promise<ConceptRelationStub[]>;
  /** 为节点生成 contains 关系 */
  generateContains(nodes: GraphNode[]): Promise<GraphEdge[]>;

  // —— 文档操作 ——
  /** 读取文档内容（目前是简易纯文本提取） */
  readMarkdown: (documentId: string) => Promise<string>;
  /** 获取文档当前的 head commit id（用于增量判断） */
  getCurrentCommitId: (documentId: string) => Promise<string>;
  /** 获取文档标题 */
  getDocTitle: (documentId: string) => Promise<string>;

  // —— 图谱缓存（完整 GraphFile） ——
  readArticleCache: (documentId: string) => Promise<ArticleGraphFile | null>;
  writeArticleCache: (documentId: string, file: ArticleGraphFile) => Promise<void>;
  readDirGraph: (folderId: string) => Promise<DirGraphFile | null>;
  writeDirGraph: (folderId: string, file: DirGraphFile) => Promise<void>;
  readDomainGraph: (domainId: string) => Promise<DirGraphFile | null>;
  writeDomainGraph: (domainId: string, file: DirGraphFile) => Promise<void>;
}

export { TreeNode };
