/**
 * 上次关闭时的界面，IndexedDB 里只有一条（id = "current"）。
 * 正文仍走各文档草稿；这里只记域，以及当时是否开着文档 / 设置 / 图谱。
 * 冷启动：有 documentId 就打开文章，否则只恢复 domainId。
 */
const DB_NAME = "mdocs-session";
const DB_VERSION = 1;
const STORE = "session";
const CURRENT_ID = "current";

export interface LastSessionGraph {
  scope: "folder" | "domain";
  resourceId: string;
  name: string;
}

export interface LastSession {
  domainId: string;
  view: "docs" | "settings";
  documentId: string | null;
  graph: LastSessionGraph | null;
}

interface LastSessionRow extends LastSession {
  id: typeof CURRENT_ID;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("open mdocs-session failed"));
    });
  }
  return dbPromise;
}

export async function loadLastSession(): Promise<LastSession | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(CURRENT_ID);
    req.onsuccess = () => {
      const row = req.result as LastSessionRow | undefined;
      if (!row) {
        resolve(null);
        return;
      }
      resolve({
        domainId: row.domainId,
        view: row.view === "settings" ? "settings" : "docs",
        documentId: row.documentId || null,
        graph: row.graph ?? null,
      });
    };
    req.onerror = () => reject(req.error ?? new Error("load last session failed"));
  });
}

export async function saveLastSession(session: LastSession): Promise<void> {
  const db = await openDB();
  const row: LastSessionRow = {
    id: CURRENT_ID,
    domainId: session.domainId,
    view: session.view,
    documentId: session.documentId,
    graph: session.graph,
    updatedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("save last session failed"));
  });
}
