/**
 * document_commits / commit_parents 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 * 入参/返回均为表实体（缺列传 null）。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { CommitParents, DocumentCommits } from "../entity/commit.entity.js";

export type { CommitParents, DocumentCommits } from "../entity/commit.entity.js";

const COMMIT_SELECT =
  `commit_id, document_id, content_hash, blob_ref, author_visitor_id, created_at,
   COALESCE(message, '') AS message, COALESCE(source, 'manual') AS source`;

export function insertCommit(
  input: DocumentCommits,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO document_commits
     (commit_id, document_id, content_hash, blob_ref, author_visitor_id, created_at, message, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.commit_id,
      input.document_id,
      input.content_hash,
      input.blob_ref,
      input.author_visitor_id,
      input.created_at,
      input.message,
      input.source,
    );
}

/** 插入一条父子边；merge 时对同一 child 调用两次即可表达双父。 */
export function insertCommitParent(
  input: CommitParents,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `INSERT INTO commit_parents (child_commit_id, parent_commit_id) VALUES (?, ?)`,
    )
    .run(input.child_commit_id, input.parent_commit_id);
}

export function findCommitById(
  commitId: string,
  db?: Database.Database,
): DocumentCommits | undefined {
  return resolveDb(db)
    .prepare<string, DocumentCommits>(
      `SELECT ${COMMIT_SELECT}
       FROM document_commits WHERE commit_id = ?`,
    )
    .get(commitId);
}

export function listCommitsByDocument(
  documentId: string,
  db?: Database.Database,
): DocumentCommits[] {
  return resolveDb(db)
    .prepare<string, DocumentCommits>(
      `SELECT ${COMMIT_SELECT}
       FROM document_commits
       WHERE document_id = ?
       ORDER BY created_at DESC, rowid DESC`,
    )
    .all(documentId);
}

export function findLatestNonAutoCommit(
  documentId: string,
  db?: Database.Database,
): DocumentCommits | undefined {
  return resolveDb(db)
    .prepare<string, DocumentCommits>(
      `SELECT ${COMMIT_SELECT}
       FROM document_commits
       WHERE document_id = ?
         AND COALESCE(source, 'manual') != 'auto'
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(documentId);
}

export function listParentCommitIds(
  childCommitId: string,
  db?: Database.Database,
): string[] {
  const rows = resolveDb(db)
    .prepare<string, { parent_commit_id: string }>(
      `SELECT parent_commit_id FROM commit_parents WHERE child_commit_id = ?`,
    )
    .all(childCommitId);
  return rows.map((r) => r.parent_commit_id);
}

export function countParents(
  childCommitId: string,
  db?: Database.Database,
): number {
  const row = resolveDb(db)
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) as c FROM commit_parents WHERE child_commit_id = ?`,
    )
    .get(childCommitId);
  return row?.c ?? 0;
}
