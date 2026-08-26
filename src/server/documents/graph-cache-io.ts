/**
 * 图谱隐藏文件 IO —— DB 行 + 磁盘内容的读写删除。
 *
 * 两层缓存（见 graph-cache-dirty / knowledge-graph 契约）：
 * - 文章级：`{父目录}/__graph__/{documentId}.graph.json`，DB id = `{documentId}.graph-file`
 * - 目录级：`{目录}/___graph___.json`，DB id = `{folderId}.graph-file`
 * - 域级：域根 `___graph___.json`，DB id = `{domainId}.graph-file`
 *
 * 落盘形状为完整 `GraphFile`（version + meta + nodes + edges）；
 * 读路径经 `parseArticleGraphFile` / `parseDirGraphFile` 兼容旧格式。
 *
 * 调用方：
 * - `graph.service` 的 GraphDeps 适配
 * - `graph/lifecycle` 的 dirty 标记与删缓存
 *
 * 本模块不跑 AI、不改正文文档。
 */
import { createHash } from "node:crypto";
import { getDb } from "../db/connection.js";
import {
  deleteDocument,
  findDocumentById,
  findDocumentByPath,
  insertDocument,
  updateDocumentContent,
  type DocumentRow,
} from "../db/repositories/document.repo.js";
import { findDomainById } from "../db/repositories/domain.repo.js";
import { deleteDocumentFile, readDocument, writeDocument } from "../storage/file-store.js";
import {
  ARTICLE_GRAPH_DIRNAME,
  DIR_GRAPH_FILENAME,
  GRAPH_FILE_TYPE,
  articleGraphFileName,
} from "../../shared/graph-files.js";
import { FILE_TYPE } from "../../shared/file-types.js";
import type { ArticleGraphFile, DirGraphFile, Graph } from "./graph/types.js";
import {
  graphFileToGraph,
  parseArticleGraphFile,
  parseDirGraphFile,
} from "./graph/graph-file.js";

function contentHash(str: string): string {
  return createHash("sha1").update(str).digest("hex");
}

/** 写隐藏文件时的 owner：优先正文/目录行，否则域创建者 */
function resolveOwnerVisitorId(documentId: string, domainId: string): string {
  const db = getDb();
  const doc = findDocumentById(db, documentId);
  if (doc) return doc.owner_visitor_id;
  const domain = findDomainById(db, domainId);
  return domain?.creator_visitor_id ?? "system";
}

/** 读文章级图谱缓存；不存在或解析失败返回 null */
export function readArticleGraphFile(documentId: string): ArticleGraphFile | null {
  const db = getDb();
  const graphFile = findDocumentById(db, `${documentId}.graph-file`);
  if (!graphFile) return null;
  try {
    const { content } = readDocument(graphFile.domain_id, graphFile.relative_path);
    return parseArticleGraphFile(JSON.parse(content));
  } catch {
    return null;
  }
}

/**
 * 写文章级图谱缓存。
 * 正文须有 parent_id（落在某目录下）；会按需创建 `__graph__/`。
 * 无父目录（域根文章）时静默跳过。
 */
export function writeArticleGraphFile(
  documentId: string,
  file: ArticleGraphFile,
): void {
  const db = getDb();
  const doc = findDocumentById(db, documentId);
  if (!doc || !doc.parent_id) return;

  const ownerVisitorId = doc.owner_visitor_id;
  const domainId = doc.domain_id;
  const graphDir = ensureGraphDir(db, doc.parent_id, domainId, ownerVisitorId);
  const fileName = articleGraphFileName(documentId);
  const filePath = `${graphDir.relative_path}/${fileName}`;
  const content = JSON.stringify(file, null, 2);

  upsertGraphFileContent({
    documentId: `${documentId}.graph-file`,
    domainId,
    relativePath: filePath,
    displayName: fileName,
    parentId: graphDir.document_id,
    content,
    ownerVisitorId,
  });
}

/** 删除文章级缓存（DB 行 + 磁盘）；不存在则 noop */
export function deleteArticleGraphCache(documentId: string): void {
  const db = getDb();
  const graphFile = findDocumentById(db, `${documentId}.graph-file`);
  if (!graphFile) return;
  try {
    deleteDocumentFile(graphFile.domain_id, graphFile.relative_path);
  } catch {
    // 盘上可能已不存在
  }
  deleteDocument(db, graphFile.document_id);
}

/** 读目录级 `___graph___.json`；不存在或解析失败返回 null */
export function readDirGraphFile(folderId: string): DirGraphFile | null {
  const db = getDb();
  const graphFile = findDocumentById(db, `${folderId}.graph-file`);
  if (!graphFile) return null;
  try {
    const { content } = readDocument(graphFile.domain_id, graphFile.relative_path);
    return parseDirGraphFile(JSON.parse(content));
  } catch {
    return null;
  }
}

/** 写目录级图谱（含 meta.dirty）；目录行须存在 */
export function writeDirGraphFile(folderId: string, file: DirGraphFile): void {
  const db = getDb();
  const folder = findDocumentById(db, folderId);
  if (!folder) return;

  const filePath = `${folder.relative_path}/${DIR_GRAPH_FILENAME}`;
  const content = JSON.stringify(file, null, 2);
  upsertGraphFileContent({
    documentId: `${folderId}.graph-file`,
    domainId: folder.domain_id,
    relativePath: filePath,
    displayName: DIR_GRAPH_FILENAME,
    parentId: folderId,
    content,
    ownerVisitorId: folder.owner_visitor_id,
  });
}

/** 读域级图谱；不存在或解析失败返回 null */
export function readDomainGraphFile(domainId: string): DirGraphFile | null {
  const db = getDb();
  const graphFile = findDocumentById(db, `${domainId}.graph-file`);
  if (!graphFile) return null;
  try {
    const { content } = readDocument(domainId, graphFile.relative_path);
    return parseDirGraphFile(JSON.parse(content));
  } catch {
    return null;
  }
}

/** 写域级图谱到域根 `___graph___.json`（parent_id = null） */
export function writeDomainGraphFile(domainId: string, file: DirGraphFile): void {
  const db = getDb();
  const filePath = DIR_GRAPH_FILENAME;
  const content = JSON.stringify(file, null, 2);
  const ownerVisitorId = resolveOwnerVisitorId(domainId, domainId);
  const existing = findDocumentById(db, `${domainId}.graph-file`);

  if (existing) {
    updateDocumentContent(db, {
      documentId: existing.document_id,
      displayName: DIR_GRAPH_FILENAME,
      contentHash: contentHash(content),
      updatedBy: ownerVisitorId,
      updatedAt: new Date().toISOString(),
    });
  } else {
    insertDocument(db, {
      documentId: `${domainId}.graph-file`,
      domainId,
      relativePath: filePath,
      displayName: DIR_GRAPH_FILENAME,
      ownerVisitorId,
      createdBy: ownerVisitorId,
      updatedBy: ownerVisitorId,
      contentHash: contentHash(content),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permission: 1,
      fileType: FILE_TYPE.GRAPH_FILE,
      parentId: null,
    });
  }
  writeDocument(domainId, filePath, content);
}

/** GET API：只返回 nodes+edges，剥掉 meta */
export function getDirGraphPayload(folderId: string): Graph | null {
  const file = readDirGraphFile(folderId);
  return file ? graphFileToGraph(file) : null;
}

/** GET API：域级 nodes+edges */
export function getDomainGraphPayload(domainId: string): Graph | null {
  const file = readDomainGraphFile(domainId);
  return file ? graphFileToGraph(file) : null;
}

/** 按 relative_path upsert graph_file 行并写盘 */
function upsertGraphFileContent(params: {
  documentId: string;
  domainId: string;
  relativePath: string;
  displayName: string;
  parentId: string | null;
  content: string;
  ownerVisitorId: string;
}): void {
  const db = getDb();
  const existing = findDocumentByPath(db, params.domainId, params.relativePath);
  if (existing) {
    updateDocumentContent(db, {
      documentId: existing.document_id,
      displayName: params.displayName,
      contentHash: contentHash(params.content),
      updatedBy: params.ownerVisitorId,
      updatedAt: new Date().toISOString(),
    });
  } else {
    insertDocument(db, {
      documentId: params.documentId,
      domainId: params.domainId,
      relativePath: params.relativePath,
      displayName: params.displayName,
      ownerVisitorId: params.ownerVisitorId,
      createdBy: params.ownerVisitorId,
      updatedBy: params.ownerVisitorId,
      contentHash: contentHash(params.content),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permission: 1,
      fileType: GRAPH_FILE_TYPE.FILE,
      parentId: params.parentId,
    });
  }
  writeDocument(params.domainId, params.relativePath, params.content);
}

/** 查找父目录下的 `__graph__` 子目录行 */
function findGraphDir(
  db: ReturnType<typeof getDb>,
  parentId: string,
  domainId: string,
): DocumentRow | null {
  const parent = findDocumentById(db, parentId);
  if (!parent) return null;
  const graphDirPath = `${parent.relative_path}/${ARTICLE_GRAPH_DIRNAME}`;
  return findDocumentByPath(db, domainId, graphDirPath) || null;
}

/**
 * 确保 `__graph__/` 目录 DB 行存在（file_type=graph_dir）。
 * 仅建元数据行，不在盘上单独建空目录；文章缓存写入时会带出路径。
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
  const dirId = `${parentId}.graph-dir`;
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
