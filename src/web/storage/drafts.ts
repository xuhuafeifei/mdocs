/**
 * 本地草稿存储（IndexedDB）
 * 提供草稿的增删改查能力，作为自动保存的持久化层。
 */
import type { DraftConflictRecord, DraftConflictStatus } from "./draft-version.js";

export type { DraftConflictRecord, DraftConflictStatus };

// ---- 数据库配置 ----
const DB_NAME = "mdocs-drafts";
const DB_VERSION = 4;
const STORE = "drafts";

/**
 * IndexedDB 主键为 `documentId`。
 *
 * **只存「草稿本体」**：正文 + 展示名 + 时间戳；以及发布失败 / 同步 head / merge 冲突等扩展字段。
 * 路径、域、owner、`permission` 等文档 meta **不写入草稿**，始终以 `GET /api/documents/:id` 为准。
 */
export interface DraftRecord {
  documentId: string;
  /** Lexical JSON serialization */
  content: string;
  displayName: string;
  updatedAt: number;
  published: boolean;
  relativePath?: string;
  permission?: number;
  ownerVisitorId?: string;
  domainId?: string;
  publishError?: string;
  publishErrorAt?: number;
  /** 开编分叉点：草稿**首次创建**时对应的服务端 head，之后不再随自动保存更新 */
  localBaseCommitId?: string;
  conflictStatus?: DraftConflictStatus;
  conflict?: DraftConflictRecord;
}

/** 自动发布失败后写入草稿，供 listAllDrafts({ skipFailed: true }) 跳过重试。 */
export const DRAFT_PUBLISH_ERROR = {
  DOC_NOT_FOUND: "DOC_NOT_FOUND",
  SYNC_HEAD_MISSING: "SYNC_HEAD_MISSING",
} as const;

export type DraftPublishErrorCode = (typeof DRAFT_PUBLISH_ERROR)[keyof typeof DRAFT_PUBLISH_ERROR];

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "documentId" });
        }
        const oldVersion = ev.oldVersion;
        if (oldVersion > 0 && oldVersion < 4) {
          const tx = req.transaction!;
          const store = tx.objectStore(STORE);
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            const v = cursor.value as Record<string, unknown>;
            if (typeof v.baseCommitId === "string" && !v.localBaseCommitId) {
              v.localBaseCommitId = v.baseCommitId;
              delete v.baseCommitId;
            }
            const conflict = v.conflict as Record<string, unknown> | undefined;
            if (conflict) {
              if (typeof conflict.baseCommitId === "string" && !conflict.localBaseCommitId) {
                conflict.localBaseCommitId = conflict.baseCommitId;
                delete conflict.baseCommitId;
              }
              if (
                typeof conflict.expectedHeadCommitId === "string" &&
                !conflict.remoteCommitId
              ) {
                conflict.remoteCommitId = conflict.expectedHeadCommitId;
                delete conflict.expectedHeadCommitId;
              }
            }
            cursor.update(v);
            cursor.continue();
          };
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return _dbPromise;
}

/**
 * 写入/更新正文草稿：覆盖 content / displayName / updatedAt，并合并保留 conflict、publishError。
 * `localBaseCommitId` 仅在**尚无该 documentId 草稿**时，用当时的 head 写入一次（开编基准）。
 */
export async function upsertContentDraft(params: {
  documentId: string;
  content: string;
  displayName: string;
  /** 开编时服务端 head；仅首次创建草稿时写入 localBaseCommitId */
  localBaseCommitIdAtEditStart?: string | null;
  /** 首次落盘时写入的文档快照 meta（后续自动保存不覆盖） */
  snapshotMeta?: {
    relativePath: string;
    permission: number;
    ownerVisitorId: string;
    domainId: string;
  };
}): Promise<void> {
  const existing = await getDraft(params.documentId);
  const record: DraftRecord = {
    documentId: params.documentId,
    content: params.content,
    displayName: params.displayName,
    updatedAt: Date.now(),
    published: false,
  };
  if (existing?.localBaseCommitId) {
    record.localBaseCommitId = existing.localBaseCommitId;
  } else {
    const head = params.localBaseCommitIdAtEditStart?.trim();
    if (head) record.localBaseCommitId = head;
  }
  if (existing?.relativePath) {
    record.relativePath = existing.relativePath;
  } else if (params.snapshotMeta) {
    record.relativePath = params.snapshotMeta.relativePath;
  }
  if (existing?.permission != null) {
    record.permission = existing.permission;
  } else if (params.snapshotMeta) {
    record.permission = params.snapshotMeta.permission;
  }
  if (existing?.ownerVisitorId) {
    record.ownerVisitorId = existing.ownerVisitorId;
  } else if (params.snapshotMeta) {
    record.ownerVisitorId = params.snapshotMeta.ownerVisitorId;
  }
  if (existing?.domainId) {
    record.domainId = existing.domainId;
  } else if (params.snapshotMeta) {
    record.domainId = params.snapshotMeta.domainId;
  }

  if (existing?.publishError) {
    record.publishError = existing.publishError;
    record.publishErrorAt = existing.publishErrorAt;
  }
  if (existing?.conflictStatus) {
    record.conflictStatus = existing.conflictStatus;
  }
  if (existing?.conflict) {
    record.conflict = existing.conflict;
  }
  await saveDraft(record);
}

/**
 * Merge 发布成功后：用服务端合成稿重建本地草稿，开编基准 = 新 head（冲突字段清空）。
 */
export async function rebuildDraftAfterMerge(params: {
  documentId: string;
  content: string;
  displayName: string;
  headCommitId: string;
  relativePath: string;
  permission: number;
  ownerVisitorId: string;
  domainId: string;
}): Promise<void> {
  await saveDraft({
    documentId: params.documentId,
    content: params.content,
    displayName: params.displayName,
    updatedAt: Date.now(),
    published: false,
    localBaseCommitId: params.headCommitId,
    relativePath: params.relativePath,
    permission: params.permission,
    ownerVisitorId: params.ownerVisitorId,
    domainId: params.domainId,
    conflictStatus: "none",
  });
}

function sanitizeDraft(doc: DraftRecord): DraftRecord {
  const sanitized: DraftRecord = {
    documentId: doc.documentId,
    content: doc.content,
    displayName: doc.displayName,
    updatedAt: doc.updatedAt,
    published: doc.published,
  };
  if (doc.relativePath) sanitized.relativePath = doc.relativePath;
  if (doc.permission != null) sanitized.permission = doc.permission;
  if (doc.ownerVisitorId) sanitized.ownerVisitorId = doc.ownerVisitorId;
  if (doc.domainId) sanitized.domainId = doc.domainId;
  if (doc.publishError != null) sanitized.publishError = doc.publishError;
  if (doc.publishErrorAt != null) sanitized.publishErrorAt = doc.publishErrorAt;
  if (doc.localBaseCommitId) sanitized.localBaseCommitId = doc.localBaseCommitId;
  if (doc.conflictStatus != null) sanitized.conflictStatus = doc.conflictStatus;
  if (doc.conflict != null) sanitized.conflict = doc.conflict;
  return sanitized;
}

export async function saveDraft(doc: DraftRecord): Promise<void> {
  const db = await openDB();
  const sanitized = sanitizeDraft(doc);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(sanitized);
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

export async function listAllDrafts(opts?: { skipFailed?: boolean }): Promise<DraftRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      let result: DraftRecord[] = req.result;
      if (opts?.skipFailed) {
        result = result.filter((d: DraftRecord) => !d.publishError);
      }
      resolve(result);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markDraftPublishError(documentId: string, error: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(documentId);
    req.onsuccess = () => {
      const existing = req.result;
      if (existing) {
        store.put(
          sanitizeDraft({
            ...existing,
            publishError: error,
            publishErrorAt: Date.now(),
          }),
        );
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearDraftPublishError(documentId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(documentId);
    req.onsuccess = () => {
      const existing = req.result;
      if (existing) {
        store.put(
          sanitizeDraft({
            ...existing,
            publishError: undefined,
            publishErrorAt: undefined,
          }),
        );
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/** 写入发布冲突快照（409 或进入 diverged 后手动 merge 前） */
export async function saveDraftConflict(
  documentId: string,
  patch: {
    conflict: DraftConflictRecord;
    conflictStatus: DraftConflictStatus;
    localBaseCommitId: string;
  },
): Promise<void> {
  const existing = await getDraft(documentId);
  if (!existing) return;
  await saveDraft({
    ...existing,
    localBaseCommitId: patch.localBaseCommitId,
    conflictStatus: patch.conflictStatus,
    conflict: patch.conflict,
  });
}

export async function clearDraftConflict(documentId: string): Promise<void> {
  const existing = await getDraft(documentId);
  if (!existing) return;
  await saveDraft({
    ...existing,
    conflict: undefined,
    conflictStatus: "none",
  });
}
