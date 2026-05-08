/**
 * Demo Mode Mock API 存储
 * 使用 IndexedDB 存储 demo 数据，支持持久化
 */
import type { DocumentDetail } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import type { TreeNode } from "../../shared/types/tree";
import { DEMO_VISITOR, DEMO_VISITOR_ID, DEMO_DOMAINS, DEMO_DOCUMENTS, buildTree } from "./mockData";

/** 数据库名称 */
const DB_NAME = "mdocs-demo";

/** 数据库版本 */
const DB_VERSION = 1;

/** 对象存储名称 */
const STORE_DOCUMENTS = "documents";
const STORE_DOMAINS = "domains";

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
        // 没有数据，初始化默认数据
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
  // 初始化文档
  const docTx = db.transaction(STORE_DOCUMENTS, "readwrite");
  const docStore = docTx.objectStore(STORE_DOCUMENTS);
  for (const doc of DEMO_DOCUMENTS) {
    docStore.add(doc);
  }
  await new Promise((resolve, reject) => {
    docTx.oncomplete = resolve;
    docTx.onerror = () => reject(docTx.error);
  });

  // 初始化域
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
    req.onsuccess = () => resolve(req.result.filter((d: DocumentDetail) => d.domainId === domainId));
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
        resolve(req.result);
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
  const db = await getDB();
  const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const doc: DocumentDetail = {
    documentId,
    relativePath: input.fileName,
    displayName: input.displayName || input.fileName.replace(/\.md$/, ""),
    content: input.content,
    contentHash: hashContent(input.content),
    permission: 1,
    ownerVisitorId: DEMO_VISITOR_ID,
    domainId: input.domainId || "default",
    updatedBy: DEMO_VISITOR_ID,
    updatedAt: now,
    createdAt: now,
  };

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
  };
}

/**
 * 创建文件夹（Demo 模式不实际存储，返回模拟结果）
 */
export async function mockCreateFolder(input: { name: string; domainId?: string }) {
  return {
    folderId: `folder-${Date.now()}`,
    path: input.name,
  };
}

/**
 * 删除文件夹（Demo 模式不实际操作）
 */
export async function mockDeleteFolder(_folderId: string): Promise<void> {
  // Demo 模式不实际删除文件夹
}
