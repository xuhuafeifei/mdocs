/**
 * 图谱缓存生命周期：与 document.service 主链路解耦。
 * 主链路只 schedule；隐藏文件 IO 全在本模块 + graph.service 导出函数。
 */
import { getDb } from "../../db/connection.js";
import { findDocumentById } from "../../db/repositories/document.repo.js";
import { findCommitById } from "../../db/repositories/commit.repo.js";
import { readCommitBlob, readDocument } from "../../storage/file-store.js";
import { extractPlainTextFromLexical } from "../lexical-text.js";
import {
  changeRatio,
  DEFAULT_GRAPH_DIRTY_RATIO,
} from "./change-ratio.js";
import {
  deleteArticleGraphCache,
  readArticleGraphFile,
  readDirGraphFile,
  readDomainGraphFile,
  writeArticleGraphFile,
  writeDirGraphFile,
  writeDomainGraphFile,
} from "../graph-cache-io.js";

export function scheduleGraphLifecycle(task: () => Promise<void>): void {
  setImmediate(() => {
    void task().catch((err) => {
      console.warn("[graph-lifecycle]", err);
    });
  });
}

/** 从 folderId 自身起标 dirty，再沿 parent_id 向上；最后域图 */
export async function markAncestorsDirty(params: {
  domainId: string;
  folderId: string | null;
}): Promise<void> {
  let p: string | null = params.folderId;
  const db = getDb();
  while (p != null) {
    const file = readDirGraphFile(p);
    if (file) {
      file.meta.dirty = true;
      writeDirGraphFile(p, file);
    }
    const row = findDocumentById(db, p);
    p = row?.parent_id ?? null;
  }
  const domainFile = readDomainGraphFile(params.domainId);
  if (domainFile) {
    domainFile.meta.dirty = true;
    writeDomainGraphFile(params.domainId, domainFile);
  }
}

export async function onArticleDeleted(params: {
  domainId: string;
  documentId: string;
  parentId: string | null;
}): Promise<void> {
  await markAncestorsDirty({
    domainId: params.domainId,
    folderId: params.parentId,
  });
  deleteArticleGraphCache(params.documentId);
}

export async function onArticleMoved(params: {
  domainId: string;
  documentId: string;
  oldParentId: string | null;
  newParentId: string | null;
}): Promise<void> {
  await markAncestorsDirty({
    domainId: params.domainId,
    folderId: params.oldParentId,
  });
  await markAncestorsDirty({
    domainId: params.domainId,
    folderId: params.newParentId,
  });
  deleteArticleGraphCache(params.documentId);
}

export async function onArticlePublished(params: {
  domainId: string;
  documentId: string;
  parentId: string | null;
}): Promise<void> {
  const cached = readArticleGraphFile(params.documentId);
  if (!cached) return;

  const oldLexical = readLexicalAtCommit(params.documentId, cached.meta.commitId);
  const newLexical = readCurrentLexical(params.documentId);
  if (oldLexical == null || newLexical == null) return;

  const ratio = changeRatio(
    extractPlainTextFromLexical(oldLexical),
    extractPlainTextFromLexical(newLexical),
  );
  if (ratio < DEFAULT_GRAPH_DIRTY_RATIO) return;

  cached.meta.dirty = true;
  writeArticleGraphFile(params.documentId, cached);
  await markAncestorsDirty({
    domainId: params.domainId,
    folderId: params.parentId,
  });
}

export async function onFolderDeleted(params: {
  domainId: string;
  parentId: string | null;
}): Promise<void> {
  await markAncestorsDirty({
    domainId: params.domainId,
    folderId: params.parentId,
  });
}

function readCurrentLexical(documentId: string): string | null {
  const db = getDb();
  const doc = findDocumentById(db, documentId);
  if (!doc) return null;
  try {
    return readDocument(doc.domain_id, doc.relative_path).content;
  } catch {
    return null;
  }
}

function readLexicalAtCommit(documentId: string, commitId: string): string | null {
  const db = getDb();
  const commit = findCommitById(db, commitId);
  if (!commit || commit.document_id !== documentId) return null;
  try {
    return readCommitBlob(commit.blob_ref);
  } catch {
    return null;
  }
}
