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

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "documentId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return _dbPromise;
}

export async function saveDraft(doc: DraftRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDraft(documentId: string): Promise<DraftRecord | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(documentId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDraft(documentId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(documentId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Delete a draft only if its updatedAt hasn't changed — optimistic lock. */
export async function deleteDraftIfUnchanged(
  documentId: string,
  expectedUpdatedAt: number,
): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(documentId);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing || existing.updatedAt !== expectedUpdatedAt) {
        resolve(false);
        return;
      }
      store.delete(documentId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function listAllDrafts(): Promise<DraftRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
