import type Database from "better-sqlite3";

/** document_commits 表行结构：一次发布的不可变快照节点。 */
export interface CommitRow {
  commit_id: string;
  document_id: string;
  content_hash: string;
  blob_ref: string;
  author_visitor_id: string;
  created_at: string;
}

/** 插入一条提交节点（不含 parent 边，边由 insertCommitParent 单独写入）。 */
export function insertCommit(
  db: Database.Database,
  input: {
    commitId: string;
    documentId: string;
    contentHash: string;
    blobRef: string;
    authorVisitorId: string;
    createdAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO document_commits
     (commit_id, document_id, content_hash, blob_ref, author_visitor_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.commitId,
    input.documentId,
    input.contentHash,
    input.blobRef,
    input.authorVisitorId,
    input.createdAt,
  );
}

/** 插入一条父子边；merge 时对同一 child 调用两次即可表达双父。 */
export function insertCommitParent(
  db: Database.Database,
  input: { childCommitId: string; parentCommitId: string },
): void {
  db.prepare(
    `INSERT INTO commit_parents (child_commit_id, parent_commit_id) VALUES (?, ?)`,
  ).run(input.childCommitId, input.parentCommitId);
}

/** 按 commit_id 查询单条提交。 */
export function findCommitById(db: Database.Database, commitId: string): CommitRow | undefined {
  return db
    .prepare<string, CommitRow>(
      `SELECT commit_id, document_id, content_hash, blob_ref, author_visitor_id, created_at
       FROM document_commits WHERE commit_id = ?`,
    )
    .get(commitId);
}

/** 列出某提交节点的全部直接父节点 id。 */
export function listParentCommitIds(
  db: Database.Database,
  childCommitId: string,
): string[] {
  const rows = db
    .prepare<string, { parent_commit_id: string }>(
      `SELECT parent_commit_id FROM commit_parents WHERE child_commit_id = ?`,
    )
    .all(childCommitId);
  return rows.map((r) => r.parent_commit_id);
}

/** 统计父边数量（线性提交为 1，merge 提交为 2）。 */
export function countParents(db: Database.Database, childCommitId: string): number {
  const row = db
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) as c FROM commit_parents WHERE child_commit_id = ?`,
    )
    .get(childCommitId);
  return row?.c ?? 0;
}
