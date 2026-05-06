/**
 * 本地草稿存储（IndexedDB）
 * 提供草稿的增删改查能力，作为自动保存的持久化层。
 * 使用 IndexedDB 而非 localStorage，因为草稿内容可能很大（Lexical JSON）。
 */

// ---- 数据库配置 ----
const DB_NAME = "mdocs-drafts";
const DB_VERSION = 1;
const STORE = "drafts";

export interface DraftRecord {
  documentId: string;
  /** Lexical JSON serialization */
  content: string;
  displayName: string;
  updatedAt: number;
  published: boolean;
  // Cached document metadata — avoids a network fetch when re-opening a draft.
  relativePath?: string;
  permission?: number;
  ownerVisitorId?: string;
  domainId?: string;
}

// ---- 数据库连接单例 ----
let _dbPromise: Promise<IDBDatabase> | null = null;

/**
 * 打开 IndexedDB 连接，按需创建对象存储。
 * 使用单例模式缓存 Promise，避免重复打开数据库。
 */
function openDB(): Promise<IDBDatabase> {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      // 数据库版本升级时创建对象存储（以 documentId 为主键）
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "documentId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return _dbPromise;
}

/**
 * 保存或更新草稿记录（按 documentId 覆盖）。
 */
export async function saveDraft(doc: DraftRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 根据文档 ID 读取草稿。
 */
export async function getDraft(documentId: string): Promise<DraftRecord | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(documentId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 删除指定文档的草稿。
 */
export async function deleteDraft(documentId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(documentId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 乐观锁删除：仅当草稿的 updatedAt 与预期一致时才删除。
 * 用于防止自动发布期间草稿被用户继续编辑而导致误删。
 */
export async function deleteDraftIfUnchanged(
  documentId: string,
  expectedUpdatedAt: number,
): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    // 先读取当前草稿
    const getReq = store.get(documentId);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      // 如果草稿不存在或 updatedAt 已变化，说明期间被修改了，不删除
      if (!existing || existing.updatedAt !== expectedUpdatedAt) {
        resolve(false);
        return;
      }
      // updatedAt 一致，安全删除
      store.delete(documentId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * 读取所有草稿记录（供草稿列表页和自动发布扫描使用）。
 */
export async function listAllDrafts(): Promise<DraftRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
