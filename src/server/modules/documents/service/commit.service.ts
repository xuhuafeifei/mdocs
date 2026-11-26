/**
 * commits 薄 service：本聚合对 `commit.repo` 的唯一出口。
 * 业务代码只依赖本文件，不直打 repo。
 * 对外不透传 Database；连接由 repo 内 getDb() 解析（单测 mock getDb）。
 */
import type { CommitParents, DocumentCommits } from "../entity/commit.entity.js";
import {
  countParents as countParentsRepo,
  findCommitById as findCommitByIdRepo,
  findLatestNonAutoCommit as findLatestNonAutoCommitRepo,
  insertCommit as insertCommitRepo,
  insertCommitParent as insertCommitParentRepo,
  listCommitsByDocument as listCommitsByDocumentRepo,
  listParentCommitIds as listParentCommitIdsRepo,
} from "../repo/commit.repo.js";

export type { CommitParents, DocumentCommits } from "../entity/commit.entity.js";

export function insertCommit(input: DocumentCommits): void {
  insertCommitRepo(input);
}

export function insertCommitParent(input: CommitParents): void {
  insertCommitParentRepo(input);
}

export function findCommitById(commitId: string): DocumentCommits | undefined {
  return findCommitByIdRepo(commitId);
}

export function listCommitsByDocument(documentId: string): DocumentCommits[] {
  return listCommitsByDocumentRepo(documentId);
}

export function findLatestNonAutoCommit(
  documentId: string,
): DocumentCommits | undefined {
  return findLatestNonAutoCommitRepo(documentId);
}

export function listParentCommitIds(childCommitId: string): string[] {
  return listParentCommitIdsRepo(childCommitId);
}

export function countParents(childCommitId: string): number {
  return countParentsRepo(childCommitId);
}
