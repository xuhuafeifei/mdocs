import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { insertCommit } from "../db/repositories/commit.repo.js";
import { insertDocument, updateDocumentContent, updateDocumentHeadCommit } from "../db/repositories/document.repo.js";
import { readDocument, writeCommitBlob, writeDocument } from "../storage/file-store.js";
import { FOLDER_DESC_FILENAME } from "../../shared/folderDesc.js";

export type InsertMarkdownWithInitialCommitInput = {
  documentId: string;
  domainId: string;
  relativePath: string;
  displayName: string;
  content: string;
  ownerVisitorId: string;
  actorVisitorId: string;
  createdAt: string;
  updatedAt: string;
  permission: number;
  fileType?: string;
  parentId: string | null;
};

/** 新建 md 文档：写盘 + 首版 commit + head_commit_id（与普通 createDocument 一致）。 */
export function insertMarkdownDocumentWithInitialCommit(
  db: Database.Database,
  input: InsertMarkdownWithInitialCommitInput,
): { commitId: string; contentHash: string } {
  const write = writeDocument(input.domainId, input.relativePath, input.content);
  const commitId = randomUUID();
  const blob = writeCommitBlob(write.contentHash, input.content);

  insertDocument(db, {
    documentId: input.documentId,
    domainId: input.domainId,
    relativePath: input.relativePath,
    displayName: input.displayName,
    ownerVisitorId: input.ownerVisitorId,
    createdBy: input.actorVisitorId,
    updatedBy: input.actorVisitorId,
    contentHash: write.contentHash,
    headCommitId: commitId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    permission: input.permission,
    fileType: input.fileType ?? "md",
    parentId: input.parentId,
  });
  insertCommit(db, {
    commitId,
    documentId: input.documentId,
    contentHash: write.contentHash,
    blobRef: blob.blobRef,
    authorVisitorId: input.actorVisitorId,
    createdAt: input.createdAt,
  });

  return { commitId, contentHash: write.contentHash };
}

function isFolderDescRelativePath(relativePath: string): boolean {
  return relativePath === FOLDER_DESC_FILENAME || relativePath.endsWith(`/${FOLDER_DESC_FILENAME}`);
}

/**
 * 为历史 folder desc（___desc___.md）补首版 commit。
 * 新建目录已走 insertMarkdownDocumentWithInitialCommit，此迁移只处理旧数据。
 */
export function backfillFolderDescHeadCommits(db: Database.Database): void {
  const rows = db
    .prepare(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id, updated_by, updated_at, permission
       FROM documents
       WHERE head_commit_id IS NULL
         AND file_type = 'md'
         AND (relative_path = ? OR relative_path LIKE ?)`,
    )
    .all(FOLDER_DESC_FILENAME, `%/${FOLDER_DESC_FILENAME}`) as {
    document_id: string;
    domain_id: string;
    relative_path: string;
    display_name: string;
    owner_visitor_id: string;
    updated_by: string;
    updated_at: string;
    permission: number;
  }[];

  for (const row of rows) {
    if (!isFolderDescRelativePath(row.relative_path)) continue;
    let content: string;
    let contentHash: string;
    try {
      ({ content, contentHash } = readDocument(row.domain_id, row.relative_path));
    } catch {
      continue;
    }

    const commitId = randomUUID();
    const blob = writeCommitBlob(contentHash, content);
    const now = row.updated_at;

    insertCommit(db, {
      commitId,
      documentId: row.document_id,
      contentHash,
      blobRef: blob.blobRef,
      authorVisitorId: row.owner_visitor_id,
      createdAt: now,
    });
    updateDocumentContent(db, {
      documentId: row.document_id,
      displayName: row.display_name,
      contentHash,
      updatedBy: row.updated_by,
      updatedAt: now,
      permission: row.permission,
    });
    updateDocumentHeadCommit(db, {
      documentId: row.document_id,
      headCommitId: commitId,
      updatedBy: row.updated_by,
      updatedAt: now,
    });
  }
}
