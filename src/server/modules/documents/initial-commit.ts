import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { insertCommit } from "./repo/commit.repo";
import { insertDocument, updateDocumentContent, updateDocumentHeadCommit } from "./repo/document.repo";
import type { Documents } from "./entity/document.entity.js";
import { readDocument, writeCommitBlob, writeDocument } from "../../infra/storage/file-store";
import { FOLDER_DESC_FILENAME } from "../../../shared/folderDesc";

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

  insertDocument({
    document_id: input.documentId,
    domain_id: input.domainId,
    relative_path: input.relativePath,
    display_name: input.displayName,
    owner_visitor_id: input.ownerVisitorId,
    created_by: input.actorVisitorId,
    updated_by: input.actorVisitorId,
    content_hash: write.contentHash,
    head_commit_id: commitId,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
    permission: input.permission,
    file_type: input.fileType ?? "md",
    parent_id: input.parentId,
  }, db);
  insertCommit({
    commit_id: commitId,
    document_id: input.documentId,
    content_hash: write.contentHash,
    blob_ref: blob.blobRef,
    author_visitor_id: input.actorVisitorId,
    created_at: input.createdAt,
    message: "",
    source: "manual",
  }, db);

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
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, head_commit_id, created_at, updated_at,
              permission, file_type, parent_id
       FROM documents
       WHERE head_commit_id IS NULL
         AND file_type = 'md'
         AND (relative_path = ? OR relative_path LIKE ?)`,
    )
    .all(FOLDER_DESC_FILENAME, `%/${FOLDER_DESC_FILENAME}`) as Documents[];

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

    insertCommit({
      commit_id: commitId,
      document_id: row.document_id,
      content_hash: contentHash,
      blob_ref: blob.blobRef,
      author_visitor_id: row.owner_visitor_id,
      created_at: now,
      message: "",
      source: "manual",
    }, db);
    updateDocumentContent({
      ...row,
      content_hash: contentHash,
      updated_at: now,
    }, db);
    updateDocumentHeadCommit({
      ...row,
      head_commit_id: commitId,
      updated_at: now,
    }, db);
  }
}
