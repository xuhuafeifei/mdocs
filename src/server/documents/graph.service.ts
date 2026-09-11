/**
 * 图谱服务层 —— mdocs 运行时适配层。
 *
 * 职责：
 * 1. 组装 GraphDeps（把 mdocs 的 DB / file-store / Agent 包装成 graph 核心模块需要的接口）
 * 2. 提供对外入口：buildGraphByDocId(docId)
 * 3. 管理图谱隐藏文件的读写（DB 记录 + 文件存储）
 *
 * 图谱文件使用特殊 file_type：
 * - graph_dir：__graph__/ 目录（存放各文章的图谱缓存）
 * - graph_file：图谱 JSON 文件（文章级缓存、目录级图谱）
 * 这些文件不出现在文档树中（tree.service 只处理 md 和 dir）
 *
 * 核心模块在 ./graph/ 下，纯逻辑，不依赖 mdocs。
 * 本文件是"胶水层"，把 mdocs 的真实组件注入给核心模块。
 */
import { getDb } from "../db/connection.js";
import {
  findDocumentById,
  listDocumentsByDomain,
  type DocumentRow,
} from "../db/repositories/document.repo.js";
import { findDomainById } from "../db/repositories/domain.repo.js";
import { buildFolderSubtree } from "./tree.service.js";
import { readDocument } from "../storage/file-store.js";
import {
  buildGraph,
  aggregateAndInduce,
  type BuildGraphOptions,
} from "./graph/index.js";
import type { Graph, GraphDeps } from "./graph/types.js";
import type { GraphAgentConfig } from "./graph/graph-agent.js";
import {
  extractDocNodes as aiExtractDocNodes,
  induceConceptNodes as aiInduceConceptNodes,
  generateContains as aiGenerateContains,
  induceConceptRelations as aiInduceConceptRelations,
} from "./graph/llm-chains.js";
import { FILE_TYPE } from "../../shared/file-types.js";
import { getPolicy, graphWalkIncludeTypes } from "../../shared/file-type-policy.js";
import type { TreeNode, FolderSubtreeNode } from "../../shared/types/tree.js";
import {
  getDirGraphPayload,
  getDomainGraphPayload,
  readArticleGraphFile,
  readDirGraphFile,
  readDomainGraphFile,
  writeArticleGraphFile,
  writeDirGraphFile,
  writeDomainGraphFile,
} from "./graph-cache-io.js";

/* ── 对外入口 ── */

/**
 * 读取指定目录的图谱缓存（不触发构建）。
 */
export function getGraphByFolderId(folderId: string): Graph | null {
  return getDirGraphPayload(folderId);
}

/**
 * 根据文档/目录 ID 构建知识图谱（mdocs 胶水入口）。
 *
 * 与核心 `buildGraph(rootNode, deps, options)` 的区别：
 * - 本函数：只拿 docId → 查库、拼 TreeNode、造 GraphDeps，再调用 buildGraph
 * - buildGraph：已有树和 deps，负责递归抽文章 / 归纳 / 写缓存
 *
 * `options.force` / `onArticle` / `onFolderPhase` 原样传给 buildGraph。
 */
export async function buildGraphByDocId(
  docId: string,
  agentConfig: GraphAgentConfig,
  visitorId?: string,
  options: BuildGraphOptions = {},
): Promise<Graph> {
  const db = getDb();
  const doc = findDocumentById(db, docId);
  if (!doc) {
    throw new Error(`文档不存在：${docId}`);
  }

  console.log(`[Graph] 开始构建图谱，docId: ${docId}`);
  console.log(`[Graph] 类型: ${doc.file_type}，路径: ${doc.relative_path}`);

  // dir → 带子树的 folder 节点；md → document 节点
  const rootNode = buildTreeNodeForDoc(doc, visitorId);
  console.log(`[Graph] 根节点类型: ${rootNode.type}，名称: ${rootNode.name}`);

  // 注入读盘 / AI / 写图谱缓存
  const deps = createGraphDeps(agentConfig, doc.domain_id, doc.owner_visitor_id);

  // 真正构建在核心模块
  const graph = await buildGraph(rootNode, deps, options);
  console.log(`[Graph] 构建完成！节点: ${graph.nodes.length}，边: ${graph.edges.length}`);
  console.log(`[Graph]   doc 节点: ${graph.nodes.filter(n => n.type === 'doc').length}`);
  console.log(`[Graph]   concept 节点: ${graph.nodes.filter(n => n.type === 'concept').length}`);

  return graph;
}

/**
 * 读取域级图谱（不触发构建）。
 */
export function getDomainGraph(domainId: string): Graph | null {
  return getDomainGraphPayload(domainId);
}

/**
 * 构建域级知识图谱。
 *
 * 流程：
 * 1. 查域下所有一级节点（parent_id IS NULL）
 * 2. 每个一级节点调用 buildGraph（自底向上构建）
 * 3. 调用 aggregateAndInduce 在顶层进行归纳
 * 4. 写入域级图谱文件
 */
export async function buildDomainGraph(
  domainId: string,
  agentConfig: GraphAgentConfig,
  options: BuildGraphOptions = {},
): Promise<Graph> {
  const db = getDb();
  const domain = findDomainById(db, domainId);
  if (!domain) {
    throw new Error(`域不存在：${domainId}`);
  }
  const ownerVisitorId = domain.creator_visitor_id;
  const deps = createGraphDeps(agentConfig, domainId, ownerVisitorId);

  console.log(`[Graph] 开始构建域级图谱，domainId: ${domainId}`);

  const allDocs = listDocumentsByDomain(db, domainId);
  const topLevelDocs = allDocs.filter((d) => {
    if (d.parent_id) return false;
    if (d.file_type === FILE_TYPE.GRAPH_FILE || d.file_type === FILE_TYPE.GRAPH_DIR) {
      return false;
    }
    const policy = getPolicy(d.file_type as any);
    // 结构节点（dir）或可抽取文章才进域顶层 walk；html 等跳过
    return Boolean(policy?.graphWalkStruct || policy?.graphExtract);
  });

  console.log(`[Graph] 一级节点数量: ${topLevelDocs.length}`);

  const childGraphs: Graph[] = [];
  for (const doc of topLevelDocs) {
    try {
      const node = buildTreeNodeForDoc(doc);
      const childGraph = await buildGraph(node, deps, options);
      childGraphs.push(childGraph);
    } catch (err) {
      console.warn(`[Graph] 节点构建失败: ${doc.document_id}`, err);
    }
  }

  const result = await aggregateAndInduce(childGraphs, deps);

  console.log(
    `[Graph] 域级图谱构建完成！节点: ${result.nodes.length}，边: ${result.edges.length}`,
  );

  await deps.writeDomainGraph(domainId, {
    version: 1,
    meta: { dirty: false },
    nodes: result.nodes,
    edges: result.edges,
  });

  return result;
}

/* ── TreeNode 组装 ── */

/**
 * 把 DB 中的文档行转换为 TreeNode，供 graph 核心模块使用。
 *
 * - 目录（dir）：递归拉取子树
 * - 目录描述文件（folder_desc / ___desc___.md）：当作目录处理，使用它的父目录
 * - 普通文章（md）：构造 document 节点
 * - 其他类型：抛错（不应该出现在图谱构建中）
 */
function buildTreeNodeForDoc(doc: DocumentRow, visitorId?: string): TreeNode {
  const db = getDb();
  let folderDoc = doc;

  // 如果是目录描述文件，找到它的父目录作为图谱构建的根
  if (doc.file_type === FILE_TYPE.FOLDER_DESC) {
    if (!doc.parent_id) {
      throw new Error(`目录描述文件没有父目录：${doc.document_id}`);
    }
    const parent = findDocumentById(db, doc.parent_id);
    if (!parent) {
      throw new Error(`父目录不存在：${doc.parent_id}`);
    }
    folderDoc = parent;
  }

  if (folderDoc.file_type === FILE_TYPE.FOLDER) {
    const subtree = buildFolderSubtree(folderDoc.document_id, visitorId, { includeTypes: graphWalkIncludeTypes() });
    return {
      type: "folder",
      name: folderDoc.display_name || folderDoc.relative_path.split("/").pop() || folderDoc.document_id,
      path: folderDoc.relative_path,
      documentId: folderDoc.document_id,
      children: subtreeNodesToTreeNodes(subtree),
    };
  }

  // 普通文章
  return {
    type: "document",
    name: doc.relative_path.split("/").pop() || doc.document_id,
    path: doc.relative_path,
    documentId: doc.document_id,
    displayName: doc.display_name,
    ownerVisitorId: doc.owner_visitor_id,
    updatedAt: doc.updated_at,
    fileType: doc.file_type,
  };
}

/**
 * FolderSubtreeNode[] → TreeNode[] 转换。
 * buildFolderSubtree 返回的是精简结构，这里补全 graph 模块需要的字段。
 *
 * 注意：path 字段暂时用 id 代替，因为 graph 核心模块主要用 documentId，
 * path 只是展示用，不影响核心逻辑。
 */
function subtreeNodesToTreeNodes(nodes: FolderSubtreeNode[]): TreeNode[] {
  return nodes.map((n): TreeNode => {
    if (n.type === "folder") {
      return {
        type: "folder",
        name: n.title,
        path: n.id,
        documentId: n.id,
        children: subtreeNodesToTreeNodes(n.children),
      };
    }
    return {
      type: "document",
      name: n.title,
      path: n.id,
      documentId: n.id,
      displayName: n.title,
      ownerVisitorId: "",
      updatedAt: "",
      fileType: "md",
    };
  });
}

/* ── GraphDeps 组装 ── */

/**
 * 组装 GraphDeps：把 mdocs 的真实组件包装成 graph 模块需要的接口。
 *
 * 每个方法都是薄薄一层适配：
 * - DB 查询 → 拿文档信息
 * - file-store → 读写文件内容
 * - 图谱文件有独立的 file_type（graph_file / graph_dir）
 */
function createGraphDeps(
  agentConfig: GraphAgentConfig,
  domainId: string,
  ownerVisitorId: string,
): GraphDeps {
  const db = getDb();

  return {
    // —— AI 能力（基于 tool 方式，结构化输出） ——

    /** 从文章中提取 doc 节点 */
    extractDocNodes: async (markdown) => {
      console.log(`[Graph] AI 提取 doc 节点中...（文章长度: ${markdown.length}）`);
      const result = await aiExtractDocNodes(markdown, agentConfig);
      console.log(`[Graph]   → 提取到 ${result.length} 个 doc 节点`);
      return result;
    },

    /** 从 doc 节点归纳 concept 节点 */
    induceConceptNodes: async (docNodes) => {
      console.log(`[Graph] AI 归纳 concept 节点中...（输入 ${docNodes.length} 个顶层 doc 节点）`);
      const result = await aiInduceConceptNodes(docNodes, agentConfig);
      console.log(`[Graph]   → 归纳出 ${result.length} 个 concept 节点`);
      return result;
    },

    /** 归纳 concept 节点之间的关系 */
    induceConceptRelations: async (concepts) => {
      console.log(`[Graph] AI 生成 concept 关系中...（输入 ${concepts.length} 个 concept 节点）`);
      const result = await aiInduceConceptRelations(concepts, agentConfig);
      console.log(`[Graph]   → 生成 ${result.length} 条 concept 关系`);
      return result;
    },

    /** 生成 contains 关系 */
    generateContains: async (nodes) => {
      console.log(`[Graph] AI 生成 contains 关系中...（输入 ${nodes.length} 个节点）`);
      const result = await aiGenerateContains(nodes, agentConfig);
      console.log(`[Graph]   → 生成 ${result.length} 条 contains 边`);
      return result;
    },

    // —— 文档操作 ——

    /**
     * 读取文章的内容。
     * 目前文件存的是 Lexical JSON，先做简易纯文本提取。
     */
    readMarkdown: async (documentId: string) => {
      const doc = findDocumentById(db, documentId);
      if (!doc) throw new Error(`文档不存在：${documentId}`);
      const { content } = readDocument(domainId, doc.relative_path);
      return extractTextFromLexical(content);
    },

    getCurrentCommitId: async (documentId: string) => {
      const doc = findDocumentById(db, documentId);
      if (!doc) throw new Error(`文档不存在：${documentId}`);
      return doc.head_commit_id ?? "";
    },

    readArticleCache: async (documentId: string) => readArticleGraphFile(documentId),

    writeArticleCache: async (documentId, file) => {
      writeArticleGraphFile(documentId, file);
    },

    getDocTitle: async (documentId: string) => {
      const doc = findDocumentById(db, documentId);
      if (!doc) return documentId;
      return doc.display_name || doc.relative_path.split("/").pop() || documentId;
    },

    readDirGraph: async (folderId: string) => readDirGraphFile(folderId),

    writeDirGraph: async (folderId, file) => {
      writeDirGraphFile(folderId, file);
    },

    readDomainGraph: async (id: string) => readDomainGraphFile(id),

    writeDomainGraph: async (id, file) => {
      writeDomainGraphFile(id, file);
    },
  };
}

export { createGraphDeps, buildTreeNodeForDoc };
export type { GraphDeps } from './graph/types.js';

/**
 * 简易 Lexical JSON → 纯文本提取。
 */
function extractTextFromLexical(jsonStr: string): string {
  try {
    const state = JSON.parse(jsonStr);
    const textParts: string[] = [];

    function walk(node: any) {
      if (typeof node?.text === "string") {
        textParts.push(node.text);
      }
      if (node?.type === "paragraph" || node?.type === "heading") {
        textParts.push("\n");
      }
      if (Array.isArray(node?.children)) {
        for (const child of node.children) {
          walk(child);
        }
      }
    }

    if (Array.isArray(state?.root?.children)) {
      for (const child of state.root.children) {
        walk(child);
      }
    }
    return textParts.join("").trim();
  } catch {
    return jsonStr;
  }
}
