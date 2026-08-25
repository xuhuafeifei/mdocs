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
  findDocumentByPath,
  insertDocument,
  updateDocumentContent,
  type DocumentRow,
} from "../db/repositories/document.repo.js";
import { buildFolderSubtree } from "./tree.service.js";
import { readDocument, writeDocument } from "../storage/file-store.js";
import { buildGraph } from "./graph/index.js";
import type { Graph, GraphDeps, DocNode } from "./graph/types.js";
import type { GraphAgentConfig } from "./graph/graph-agent.js";
import {
  extractDocNodes as aiExtractDocNodes,
  induceConceptNodes as aiInduceConceptNodes,
  generateContains as aiGenerateContains,
} from "./graph/llm-chains.js";
import {
  ARTICLE_GRAPH_DIRNAME,
  DIR_GRAPH_FILENAME,
  GRAPH_FILE_TYPE,
  articleGraphFileName,
} from "../../shared/graph-files.js";
import type { TreeNode, FolderSubtreeNode } from "../../shared/types/tree.js";
import { FILE_TYPE } from "../../shared/file-types.js";
import { randomUUID, createHash } from "node:crypto";

/* ── 对外入口 ── */

/**
 * 根据文档 ID 构建知识图谱。
 *
 * - 如果 docId 对应目录 → 自底向上构建整棵子树的图谱
 * - 如果 docId 对应文章 → 只提取该文章的 doc 节点
 *
 * @param docId 文章 ID 或目录的 documentId
 * @param agentConfig Agent 配置（用于调用 AI）
 * @param visitorId 访客 ID（用于权限校验，不传则不过滤）
 * @returns 构建完成的图谱（nodes + edges）
 */
export async function buildGraphByDocId(
  docId: string,
  agentConfig: GraphAgentConfig,
  visitorId?: string,
): Promise<Graph> {
  const db = getDb();
  const doc = findDocumentById(db, docId);
  if (!doc) {
    throw new Error(`文档不存在：${docId}`);
  }

  console.log(`[Graph] 开始构建图谱，docId: ${docId}`);
  console.log(`[Graph] 类型: ${doc.file_type}，路径: ${doc.relative_path}`);

  // 根据节点类型组装 TreeNode（graph 核心模块只认 TreeNode）
  const rootNode = buildTreeNodeForDoc(doc, visitorId);
  console.log(`[Graph] 根节点类型: ${rootNode.type}，名称: ${rootNode.name}`);

  const deps = createGraphDeps(agentConfig, doc.domain_id, doc.owner_visitor_id);

  const graph = await buildGraph(rootNode, deps);
  console.log(`[Graph] 构建完成！节点: ${graph.nodes.length}，边: ${graph.edges.length}`);
  console.log(`[Graph]   doc 节点: ${graph.nodes.filter(n => n.type === 'doc').length}`);
  console.log(`[Graph]   concept 节点: ${graph.nodes.filter(n => n.type === 'concept').length}`);

  return graph;
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
    const subtree = buildFolderSubtree(folderDoc.document_id, visitorId);
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
     * TODO: 后续接入 lobe headless 做完整的 Lexical → Markdown 转换。
     */
    readMarkdown: async (documentId: string) => {
      const doc = findDocumentById(db, documentId);
      if (!doc) throw new Error(`文档不存在：${documentId}`);
      const { content } = readDocument(domainId, doc.relative_path);
      return extractTextFromLexical(content);
    },

    /** 获取文章当前的 head commit id，用于增量判断 */
    getCurrentCommitId: async (documentId: string) => {
      const doc = findDocumentById(db, documentId);
      if (!doc) throw new Error(`文档不存在：${documentId}`);
      return doc.head_commit_id ?? "";
    },

    /**
     * 读取文章级图谱缓存。
     * 缓存在该文章所在目录的 __graph__/{docId}.graph.json 中。
     * 不存在或解析失败返回 null。
     */
    readArticleCache: async (documentId: string) => {
      const doc = findDocumentById(db, documentId);
      if (!doc || !doc.parent_id) return null;

      const graphDir = findGraphDir(db, doc.parent_id, domainId);
      if (!graphDir) return null;

      const fileName = articleGraphFileName(documentId);
      const filePath = `${graphDir.relative_path}/${fileName}`;
      const graphFile = findDocumentByPath(db, domainId, filePath);
      if (!graphFile) return null;

      try {
        const { content } = readDocument(domainId, graphFile.relative_path);
        const data = JSON.parse(content) as { commitId: string; nodes: DocNode[] };
        return { nodes: data.nodes, commitId: data.commitId };
      } catch {
        return null;
      }
    },

    /**
     * 写入文章级图谱缓存。
     * 如果 __graph__ 目录不存在则自动创建。
     * 文件格式：{ commitId, nodes: DocNode[] }
     */
    writeArticleCache: async (documentId: string, nodes: DocNode[], commitId: string) => {
      const doc = findDocumentById(db, documentId);
      if (!doc || !doc.parent_id) return;

      const graphDir = ensureGraphDir(db, doc.parent_id, domainId, ownerVisitorId);
      const fileName = articleGraphFileName(documentId);
      const filePath = `${graphDir.relative_path}/${fileName}`;
      const content = JSON.stringify({ commitId, nodes }, null, 2);

      const existing = findDocumentByPath(db, domainId, filePath);
      if (existing) {
        updateDocumentContent(db, {
          documentId: existing.document_id,
          displayName: fileName,
          contentHash: contentHash(content),
          updatedBy: ownerVisitorId,
          updatedAt: new Date().toISOString(),
        });
      } else {
        createGraphFile(db, {
          domainId,
          relativePath: filePath,
          displayName: fileName,
          parentId: graphDir.document_id,
          content,
          ownerVisitorId,
        });
      }

      writeDocument(domainId, filePath, content);
    },

    /** 获取文章标题（display_name，回退到文件名） */
    getDocTitle: async (documentId: string) => {
      const doc = findDocumentById(db, documentId);
      if (!doc) return documentId;
      return doc.display_name || doc.relative_path.split("/").pop() || documentId;
    },

    /**
     * 读取目录级图谱。
     * 存储在该目录下的 ___graph___.json 文件中。
     * 不存在或解析失败返回 null。
     */
    readDirGraph: async (folderId: string) => {
      const folder = findDocumentById(db, folderId);
      if (!folder) return null;

      const filePath = `${folder.relative_path}/${DIR_GRAPH_FILENAME}`;
      const graphFile = findDocumentByPath(db, domainId, filePath);
      if (!graphFile) return null;

      try {
        const { content } = readDocument(domainId, graphFile.relative_path);
        return JSON.parse(content) as Graph;
      } catch {
        return null;
      }
    },

    /**
     * 写入目录级图谱。
     * 存储在该目录下的 ___graph___.json 文件中。
     */
    writeDirGraph: async (folderId: string, graph: Graph) => {
      const folder = findDocumentById(db, folderId);
      if (!folder) return;

      const filePath = `${folder.relative_path}/${DIR_GRAPH_FILENAME}`;
      const content = JSON.stringify(graph, null, 2);

      const existing = findDocumentByPath(db, domainId, filePath);
      if (existing) {
        updateDocumentContent(db, {
          documentId: existing.document_id,
          displayName: DIR_GRAPH_FILENAME,
          contentHash: contentHash(content),
          updatedBy: ownerVisitorId,
          updatedAt: new Date().toISOString(),
        });
      } else {
        createGraphFile(db, {
          domainId,
          relativePath: filePath,
          displayName: DIR_GRAPH_FILENAME,
          parentId: folderId,
          content,
          ownerVisitorId,
        });
      }

      writeDocument(domainId, filePath, content);
    },
  };
}

/* ── 图谱文件/目录管理 ── */

/**
 * 查找指定父目录下的 __graph__ 子目录。
 * @returns 目录行，不存在返回 null
 */
function findGraphDir(
  db: ReturnType<typeof getDb>,
  parentId: string,
  domainId: string,
): DocumentRow | null {
  const parent = findDocumentById(db, parentId);
  if (!parent) return null;

  const graphDirPath = `${parent.relative_path}/${ARTICLE_GRAPH_DIRNAME}`;
  const found = findDocumentByPath(db, domainId, graphDirPath);
  return found || null;
}

/**
 * 确保 __graph__ 目录存在，不存在则创建。
 * @returns 目录行
 */
function ensureGraphDir(
  db: ReturnType<typeof getDb>,
  parentId: string,
  domainId: string,
  ownerVisitorId: string,
): DocumentRow {
  const existing = findGraphDir(db, parentId, domainId);
  if (existing) return existing;

  const parent = findDocumentById(db, parentId);
  if (!parent) throw new Error(`父目录不存在：${parentId}`);

  const now = new Date().toISOString();
  const dirId = randomUUID();
  const dirPath = `${parent.relative_path}/${ARTICLE_GRAPH_DIRNAME}`;

  insertDocument(db, {
    documentId: dirId,
    domainId,
    relativePath: dirPath,
    displayName: ARTICLE_GRAPH_DIRNAME,
    ownerVisitorId,
    createdBy: ownerVisitorId,
    updatedBy: ownerVisitorId,
    contentHash: "",
    createdAt: now,
    updatedAt: now,
    permission: 1,
    fileType: GRAPH_FILE_TYPE.DIR,
    parentId,
  });

  return findDocumentById(db, dirId)!;
}

/** 创建一个 graph_file 类型的文件（DB + 磁盘） */
function createGraphFile(
  db: ReturnType<typeof getDb>,
  params: {
    domainId: string;
    relativePath: string;
    displayName: string;
    parentId: string;
    content: string;
    ownerVisitorId: string;
  },
): void {
  const now = new Date().toISOString();
  insertDocument(db, {
    documentId: randomUUID(),
    domainId: params.domainId,
    relativePath: params.relativePath,
    displayName: params.displayName,
    ownerVisitorId: params.ownerVisitorId,
    createdBy: params.ownerVisitorId,
    updatedBy: params.ownerVisitorId,
    contentHash: contentHash(params.content),
    createdAt: now,
    updatedAt: now,
    permission: 1,
    fileType: GRAPH_FILE_TYPE.FILE,
    parentId: params.parentId,
  });
}

/* ── 工具函数 ── */

/**
 * 简易 Lexical JSON → 纯文本提取。
 *
 * TODO: 后续接入 lobe headless 做完整的 Lexical → Markdown 转换，
 * 让 AI 能看到更丰富的格式信息（标题层级、列表、代码块等）。
 */
function extractTextFromLexical(jsonStr: string): string {
  try {
    const state = JSON.parse(jsonStr);
    const textParts: string[] = [];

    function walk(node: any) {
      if (typeof node?.text === "string") {
        textParts.push(node.text);
      }
      // 段落和标题之间加换行，保留基本结构
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
    // 解析失败就返回原文，不影响主流程
    return jsonStr;
  }
}

/** 计算内容哈希（图谱文件用，不需要强一致性，sha1 足够） */
function contentHash(str: string): string {
  return createHash("sha1").update(str).digest("hex");
}
