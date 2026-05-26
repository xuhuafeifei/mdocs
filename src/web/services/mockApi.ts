/**
 * Demo Mode Mock API 存储
 * 使用 IndexedDB 存储 demo 数据，支持持久化
 */
import type { DocumentDetail } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import type { TreeNode } from "../../shared/types/tree";
import type { VisitorDirectoryEntry } from "../../shared/types/visitor";
import { FOLDER_DESC_FILENAME, folderDescPathForFolder } from "../../shared/folderDesc";
import { normalisePathSegmentForStorage } from "../../shared/storagePath";
import { ApiRequestError } from "./api-request-error";
import { DEMO_VISITOR, DEMO_VISITOR_ID, DEMO_DOMAINS, DEMO_DOCUMENTS, buildTree } from "./mockData";
import type { Bookmark, MyDocument } from "./endpoints";

/** 数据库名称 */
const DB_NAME = "mdocs-demo";

/** 数据库版本 */
const DB_VERSION = 1;

/** 对象存储名称 */
const STORE_DOCUMENTS = "documents";
const STORE_DOMAINS = "domains";

const SYNTHETIC_FOLDER_PREFIX = "folder-";

/**
 * 初始化 IndexedDB 数据库
 */
async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
        db.createObjectStore(STORE_DOCUMENTS, { keyPath: "documentId" });
      }
      if (!db.objectStoreNames.contains(STORE_DOMAINS)) {
        db.createObjectStore(STORE_DOMAINS, { keyPath: "domainId" });
      }
    };
  });
}

/**
 * 检查数据库是否已有数据，没有则初始化默认数据
 */
async function ensureInitialized(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCUMENTS, "readonly");
    const store = tx.objectStore(STORE_DOCUMENTS);
    const countReq = store.count();

    countReq.onsuccess = () => {
      if (countReq.result === 0) {
        void initDefaultData(db).then(resolve).catch(reject);
      } else {
        resolve();
      }
    };
    countReq.onerror = () => reject(countReq.error);
  });
}

/**
 * 初始化默认数据
 */
async function initDefaultData(db: IDBDatabase): Promise<void> {
  const docTx = db.transaction(STORE_DOCUMENTS, "readwrite");
  const docStore = docTx.objectStore(STORE_DOCUMENTS);
  for (const doc of DEMO_DOCUMENTS) {
    docStore.add(doc);
  }
  await new Promise((resolve, reject) => {
    docTx.oncomplete = resolve;
    docTx.onerror = () => reject(docTx.error);
  });

  const domainTx = db.transaction(STORE_DOMAINS, "readwrite");
  const domainStore = domainTx.objectStore(STORE_DOMAINS);
  for (const domain of DEMO_DOMAINS) {
    domainStore.add(domain);
  }
  await new Promise((resolve, reject) => {
    domainTx.oncomplete = resolve;
    domainTx.onerror = () => reject(domainTx.error);
  });
}

/**
 * 获取数据库实例（带初始化）
 */
let dbPromise: Promise<IDBDatabase> | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = initDB().then(async (db) => {
      await ensureInitialized(db);
      return db;
    });
  }
  return dbPromise;
}

async function getAllDocuments(): Promise<DocumentDetail[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCUMENTS, "readonly");
    const store = tx.objectStore(STORE_DOCUMENTS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as DocumentDetail[]);
    req.onerror = () => reject(req.error);
  });
}

async function findDocumentByPath(domainId: string, relativePath: string): Promise<DocumentDetail | undefined> {
  const all = await getAllDocuments();
  return all.find((d) => d.domainId === domainId && d.relativePath === relativePath);
}

/** 与后端 createDocument 对齐的文件名归一化 */
function normalizeFileName(fileName: string): string {
  let normalized = fileName.trim();
  normalized = normalized.split(/[\\/]/).pop() || "untitled";
  normalized = normalized.replace(/[^\w\u4e00-\u9fa5\-_.]/g, "_");
  if (!normalized.toLowerCase().endsWith(".md")) {
    normalized += ".md";
  }
  if (normalized === ".md") {
    normalized = "untitled.md";
  }
  return normalized;
}

/**
 * 前端树使用 `folder-${path}` 作为占位目录 ID；创建子项时需按路径拼接而非查库。
 * 返回 `null` 表示不是占位 ID，应从 IndexedDB 解析父节点。
 */
function syntheticFolderPathFromId(parentId: string): string | null {
  if (!parentId.startsWith(SYNTHETIC_FOLDER_PREFIX)) return null;
  return parentId.slice(SYNTHETIC_FOLDER_PREFIX.length);
}

// ==================== Mock API 实现 ====================

/**
 * 获取当前访客信息
 */
export async function mockFetchMe() {
  return DEMO_VISITOR;
}

/**
 * 获取域列表
 */
export async function mockFetchDomains(): Promise<DomainSummary[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOMAINS, "readonly");
    const store = tx.objectStore(STORE_DOMAINS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取文档树
 */
export async function mockFetchTree(domainId: string = "default"): Promise<TreeNode[]> {
  const db = await getDB();
  const docs = await new Promise<DocumentDetail[]>((resolve, reject) => {
    const tx = db.transaction(STORE_DOCUMENTS, "readonly");
    const store = tx.objectStore(STORE_DOCUMENTS);
    const req = store.getAll();
    req.onsuccess = () =>
      resolve((req.result as DocumentDetail[]).filter((d) => d.domainId === domainId));
    req.onerror = () => reject(req.error);
  });
  return buildTree(docs);
}

/**
 * 获取单个文档
 */
export async function mockGetDocument(documentId: string): Promise<DocumentDetail> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCUMENTS, "readonly");
    const store = tx.objectStore(STORE_DOCUMENTS);
    const req = store.get(documentId);
    req.onsuccess = () => {
      if (req.result) {
        resolve(req.result as DocumentDetail);
      } else {
        reject(new Error(`Document not found: ${documentId}`));
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 计算内容 hash（Demo 用简单模拟）
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}

/**
 * 创建文档
 */
export async function mockCreateDocument(input: {
  fileName: string;
  displayName?: string;
  content: string;
  domainId?: string;
  parentId?: string;
}): Promise<DocumentDetail> {
  const domainId = input.domainId?.trim() || "default";
  const normalisedFile = normalizeFileName(input.fileName);

  let relativePath: string;
  let parentIdResolved: string | null = null;

  if (input.parentId) {
    const synPath = syntheticFolderPathFromId(input.parentId);
    if (synPath !== null) {
      relativePath = synPath ? `${synPath}/${normalisedFile}` : normalisedFile;
    } else {
      let parent: DocumentDetail;
      try {
        parent = await mockGetDocument(input.parentId);
      } catch {
        throw new ApiRequestError(400, "INVALID_PARENT", "无效的父节点或父节点不是文件夹");
      }
      if ((parent.fileType ?? "md") !== "dir") {
        throw new ApiRequestError(400, "INVALID_PARENT", "无效的父节点或父节点不是文件夹");
      }
      if (parent.domainId !== domainId) {
        throw new ApiRequestError(403, "FORBIDDEN", "不能跨域创建文档");
      }
      relativePath = `${parent.relativePath}/${normalisedFile}`;
      parentIdResolved = input.parentId;
    }
  } else {
    relativePath = normalisedFile;
  }

  if (await findDocumentByPath(domainId, relativePath)) {
    throw new ApiRequestError(409, "DOC_EXISTS", "文档已存在");
  }

  const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const permission = domainId === DEMO_VISITOR_ID ? 0 : 1;
  const displayName =
    input.displayName?.trim() ||
    normalisedFile.replace(/\.md$/i, "");

  const doc: DocumentDetail = {
    documentId,
    relativePath,
    displayName,
    content: input.content,
    contentHash: hashContent(input.content),
    permission,
    ownerVisitorId: DEMO_VISITOR_ID,
    domainId,
    updatedBy: DEMO_VISITOR_ID,
    updatedAt: now,
    createdAt: now,
    fileType: "md",
    parentId: parentIdResolved,
  };

  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCUMENTS, "readwrite");
    const store = tx.objectStore(STORE_DOCUMENTS);
    const req = store.add(doc);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });

  return doc;
}

/**
 * 更新文档
 */
export async function mockUpdateDocument(
  documentId: string,
  input: { content: string; displayName?: string; permission?: number },
): Promise<DocumentDetail> {
  const db = await getDB();
  const existing = await mockGetDocument(documentId);
  const updated: DocumentDetail = {
    ...existing,
    ...input,
    contentHash: hashContent(input.content),
    updatedAt: new Date().toISOString(),
  };

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCUMENTS, "readwrite");
    const store = tx.objectStore(STORE_DOCUMENTS);
    const req = store.put(updated);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });

  return updated;
}

/**
 * 删除文档
 */
export async function mockDeleteDocument(documentId: string): Promise<void> {
  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCUMENTS, "readwrite");
    const store = tx.objectStore(STORE_DOCUMENTS);
    const req = store.delete(documentId);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}

/**
 * 注册访客（Demo 模式直接返回固定访客）
 */
export async function mockRegisterVisitor(_visitorName: string) {
  return {
    visitor: DEMO_VISITOR,
    visitorToken: "demo-token",
    recoveryCode: "ABCD-EFGH-IJKL-MNOP",
  };
}

/**
 * 恢复码找回访客（Demo 模式模拟）
 */
export async function mockRecoverVisitor(_recoveryCode: string) {
  return {
    visitor: DEMO_VISITOR,
    visitorToken: "demo-token-recovered",
  };
}

/**
 * 创建文件夹：写入目录行 + ___desc___.md（与后端语义一致）
 */
export async function mockCreateFolder(input: {
  name: string;
  parentId?: string;
  domainId?: string;
  description?: string;
}): Promise<{ folderId: string; path: string }> {
  const domainId = input.domainId?.trim() || "default";
  const storageName = normalisePathSegmentForStorage(input.name);
  if (!storageName) {
    throw new ApiRequestError(400, "INVALID_PATH", "目录名不合法");
  }

  let normalizedPath: string;
  let parentFolderId: string | null = null;

  if (input.parentId) {
    const synPath = syntheticFolderPathFromId(input.parentId);
    if (synPath !== null) {
      normalizedPath = synPath ? `${synPath}/${storageName}` : storageName;
    } else {
      let parent: DocumentDetail;
      try {
        parent = await mockGetDocument(input.parentId);
      } catch {
        throw new ApiRequestError(404, "INVALID_PARENT", "父目录不存在");
      }
      if ((parent.fileType ?? "md") !== "dir") {
        throw new ApiRequestError(404, "INVALID_PARENT", "父目录不存在");
      }
      if (parent.domainId !== domainId) {
        throw new ApiRequestError(403, "FORBIDDEN", "不能跨域创建目录");
      }
      normalizedPath = `${parent.relativePath}/${storageName}`;
      parentFolderId = input.parentId;
    }
  } else {
    normalizedPath = storageName;
  }

  if (await findDocumentByPath(domainId, normalizedPath)) {
    throw new ApiRequestError(409, "DOC_EXISTS", "同名目录已存在");
  }

  const descPath = folderDescPathForFolder(normalizedPath);
  if (await findDocumentByPath(domainId, descPath)) {
    throw new ApiRequestError(409, "DOC_EXISTS", "同名目录已存在");
  }

  const folderId = crypto.randomUUID();
  const descId = crypto.randomUUID();
  const now = new Date().toISOString();
  const permission = domainId === DEMO_VISITOR_ID ? 0 : 1;
  const descContent = input.description ?? `# ${input.name}`;

  const dirDoc: DocumentDetail = {
    documentId: folderId,
    relativePath: normalizedPath,
    displayName: input.name,
    content: "",
    contentHash: hashContent(""),
    permission,
    ownerVisitorId: DEMO_VISITOR_ID,
    domainId,
    updatedBy: DEMO_VISITOR_ID,
    updatedAt: now,
    createdAt: now,
    fileType: "dir",
    parentId: parentFolderId,
  };

  const descDoc: DocumentDetail = {
    documentId: descId,
    relativePath: descPath,
    displayName: input.name,
    content: descContent,
    contentHash: hashContent(descContent),
    permission,
    ownerVisitorId: DEMO_VISITOR_ID,
    domainId,
    updatedBy: DEMO_VISITOR_ID,
    updatedAt: now,
    createdAt: now,
    fileType: "md",
    parentId: folderId,
  };

  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCUMENTS, "readwrite");
    const store = tx.objectStore(STORE_DOCUMENTS);
    store.add(dirDoc);
    store.add(descDoc);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  return { folderId, path: normalizedPath };
}

/**
 * 递归删除目录下全部内容（与 DELETE /api/documents/folder/:id 对齐）
 */
export async function mockRemoveFolder(folderDocumentId: string): Promise<{ deletedCount: number }> {
  let folder: DocumentDetail;
  try {
    folder = await mockGetDocument(folderDocumentId);
  } catch {
    throw new ApiRequestError(404, "DOC_NOT_FOUND", "目录不存在");
  }

  const descMarker = "/" + FOLDER_DESC_FILENAME;
  if (
    (folder.fileType ?? "md") === "md" &&
    folder.relativePath.toLowerCase().endsWith(descMarker.toLowerCase())
  ) {
    const pid = folder.parentId;
    if (!pid) {
      throw new ApiRequestError(400, "BAD_REQUEST", "描述文档无父目录");
    }
    try {
      folder = await mockGetDocument(pid);
    } catch {
      throw new ApiRequestError(404, "DOC_NOT_FOUND", "父目录不存在");
    }
  }

  if ((folder.fileType ?? "md") !== "dir") {
    throw new ApiRequestError(400, "BAD_REQUEST", "不是目录");
  }
  if (folder.ownerVisitorId !== DEMO_VISITOR_ID) {
    throw new ApiRequestError(403, "FORBIDDEN", "仅创建者可删除此目录");
  }

  const pathPrefix = `${folder.relativePath}/`;
  const inDomain = (await getAllDocuments()).filter((d) => d.domainId === folder.domainId);
  const toDelete = inDomain.filter(
    (d) => d.documentId === folder.documentId || d.relativePath.startsWith(pathPrefix),
  );

  const notOwned = toDelete.filter((d) => d.ownerVisitorId !== DEMO_VISITOR_ID);
  if (notOwned.length > 0) {
    throw new ApiRequestError(403, "FORBIDDEN", `目录下有 ${notOwned.length} 篇文档不属于你，无法删除`);
  }

  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCUMENTS, "readwrite");
    const store = tx.objectStore(STORE_DOCUMENTS);
    for (const d of toDelete) {
      store.delete(d.documentId);
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  return { deletedCount: toDelete.length };
}

/**
 * DELETE /api/folders/:id（与旧 mock 路由兼容）
 */
export async function mockDeleteFolder(folderId: string): Promise<void> {
  await mockRemoveFolder(folderId);
}

// ==================== 书签 Mock ====================

const bookmarkStore = new Map<string, Set<string>>(); // visitorId -> Set<documentId>

/**
 * 检查文档是否已收藏
 */
export async function mockCheckBookmark(documentId: string): Promise<{ bookmarked: boolean }> {
  return { bookmarked: bookmarkStore.get(DEMO_VISITOR_ID)?.has(documentId) ?? false };
}

/**
 * 添加收藏
 */
export async function mockAddBookmark(documentId: string): Promise<void> {
  if (!bookmarkStore.has(DEMO_VISITOR_ID)) bookmarkStore.set(DEMO_VISITOR_ID, new Set());
  bookmarkStore.get(DEMO_VISITOR_ID)!.add(documentId);
}

/**
 * 取消收藏
 */
export async function mockRemoveBookmark(documentId: string): Promise<void> {
  bookmarkStore.get(DEMO_VISITOR_ID)?.delete(documentId);
}

/**
 * 获取收藏列表
 */
export async function mockFetchBookmarks(): Promise<Bookmark[]> {
  const ids = bookmarkStore.get(DEMO_VISITOR_ID) ?? new Set<string>();
  const allDocs = await getAllDocuments();
  const bookmarks: Bookmark[] = [];
  for (const docId of ids) {
    const doc = allDocs.find((d) => d.documentId === docId);
    if (doc) {
      bookmarks.push({
        documentId: doc.documentId,
        domainId: doc.domainId,
        relativePath: doc.relativePath,
        displayName: doc.displayName,
        ownerVisitorId: doc.ownerVisitorId,
        ownerVisitorName: DEMO_VISITOR.visitorName,
        permission: doc.permission,
        createdAt: doc.createdAt,
        bookmarkedAt: doc.updatedAt,
        isDeleted: false,
      });
    }
  }
  return bookmarks;
}

// ==================== 评论 Mock ====================

interface CommentEntry {
  commentId: string;
  documentId: string;
  visitorId: string;
  visitorName: string;
  parentId: string | null;
  replyToVisitorId: string | null;
  replyToVisitorName: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
}

const commentStore = new Map<string, CommentEntry[]>(); // documentId -> comments[]

/**
 * 获取评论列表
 */
export async function mockFetchComments(documentId: string) {
  const comments = commentStore.get(documentId) ?? [];
  return { comments, total: comments.filter((c) => !c.isDeleted).length };
}

/**
 * 创建评论
 */
export async function mockCreateComment(
  documentId: string,
  input: { content: string; parentId?: string | null; replyToVisitorId?: string | null; replyToVisitorName?: string | null },
): Promise<CommentEntry> {
  const comment: CommentEntry = {
    commentId: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    documentId,
    visitorId: DEMO_VISITOR_ID,
    visitorName: DEMO_VISITOR.visitorName,
    parentId: input.parentId ?? null,
    replyToVisitorId: input.replyToVisitorId ?? null,
    replyToVisitorName: input.replyToVisitorName ?? null,
    content: input.content,
    isDeleted: false,
    createdAt: new Date().toISOString(),
  };
  if (!commentStore.has(documentId)) commentStore.set(documentId, []);
  commentStore.get(documentId)!.push(comment);
  return comment;
}

/**
 * 删除评论（软删除）
 */
export async function mockDeleteComment(_documentId: string, commentId: string) {
  for (const comments of commentStore.values()) {
    const idx = comments.findIndex((c) => c.commentId === commentId);
    if (idx >= 0) {
      const existing = comments[idx]!;
      comments[idx] = {
        commentId: existing.commentId,
        documentId: existing.documentId,
        visitorId: existing.visitorId,
        visitorName: existing.visitorName,
        parentId: existing.parentId,
        replyToVisitorId: existing.replyToVisitorId,
        replyToVisitorName: existing.replyToVisitorName,
        content: existing.content,
        isDeleted: true,
        createdAt: existing.createdAt,
      };
      return { success: true };
    }
  }
  throw new ApiRequestError(404, "COMMENT_NOT_FOUND", "评论不存在");
}

// ==================== 访客目录 Mock ====================

/**
 * 获取访客目录（返回 demo 访客信息）
 */
export async function mockFetchVisitorsDirectory(): Promise<VisitorDirectoryEntry[]> {
  return [{
    visitorId: DEMO_VISITOR_ID,
    visitorName: DEMO_VISITOR.visitorName,
  }];
}

// ==================== 文档邀请 Mock ====================

const inviteStore = new Map<string, Array<{ visitorId: string; permission: string }>>();

/**
 * 获取文档邀请列表
 */
export async function mockGetDocumentInvites(documentId: string) {
  return inviteStore.get(documentId) ?? [];
}

/**
 * 添加文档邀请
 */
export async function mockAddDocumentInvite(documentId: string, targetVisitorId: string, targetPermission: string) {
  if (!inviteStore.has(documentId)) inviteStore.set(documentId, []);
  const invites = inviteStore.get(documentId)!;
  const existing = invites.findIndex((i) => i.visitorId === targetVisitorId);
  if (existing >= 0) {
    invites[existing] = { visitorId: targetVisitorId, permission: targetPermission };
  } else {
    invites.push({ visitorId: targetVisitorId, permission: targetPermission });
  }
}

/**
 * 删除文档邀请
 */
export async function mockRemoveDocumentInvite(documentId: string, targetVisitorId: string) {
  const invites = inviteStore.get(documentId) ?? [];
  const idx = invites.findIndex((i) => i.visitorId === targetVisitorId);
  if (idx >= 0) invites.splice(idx, 1);
}

// ==================== 我的文档 Mock ====================

/**
 * 获取当前访客创建的所有文档
 */
export async function mockFetchMyDocuments(): Promise<MyDocument[]> {
  const allDocs = await getAllDocuments();
  return allDocs
    .filter((d) => d.ownerVisitorId === DEMO_VISITOR_ID)
    .map((d) => ({
      documentId: d.documentId,
      domainId: d.domainId,
      relativePath: d.relativePath,
      displayName: d.displayName,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      permission: d.permission,
    }));
}
