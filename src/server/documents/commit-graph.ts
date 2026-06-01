/**
 * 文档提交 DAG 的图遍历与校验。
 *
 * 命名见 fgbg-docs/commit-naming-and-merge-base.md
 */
import type Database from "better-sqlite3";
import { DocumentError } from "../access/access-control.js";
import { findCommitById, listParentCommitIds } from "../db/repositories/commit.repo.js";

/**
 * 判断 ancestorId 是否位于 nodeId 的祖先链上（含「自身」）。
 * 沿 commit_parents 边从 nodeId 向上 BFS。
 */
export function isAncestorOf(
  db: Database.Database,
  ancestorId: string,
  nodeId: string,
): boolean {
  if (ancestorId === nodeId) return true;
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const parents = listParentCommitIds(db, cur);
    for (const p of parents) {
      if (p === ancestorId) return true;
      if (!visited.has(p)) {
        visited.add(p);
        queue.push(p);
      }
    }
  }
  return false;
}

/** 校验 commit 存在且属于指定文档，否则 400。 */
export function assertCommitBelongsToDocument(
  db: Database.Database,
  commitId: string,
  documentId: string,
): void {
  const row = findCommitById(db, commitId);
  if (!row || row.document_id !== documentId) {
    throw new DocumentError("INVALID_COMMIT", "提交节点不存在或不属于该文档", 400);
  }
}

/**
 * 求两提交在 DAG 上的最近公共祖先（LCA），用于 merge 三路 diff 的 mergeBaseCommitId。
 * 若一方是另一方的祖先，返回祖先侧节点。
 */
export function findMergeBaseCommitId(
  db: Database.Database,
  commitA: string,
  commitB: string,
): string {
  if (commitA === commitB) return commitA;
  if (isAncestorOf(db, commitA, commitB)) return commitA;
  if (isAncestorOf(db, commitB, commitA)) return commitB;

  const ancestorsOfA = new Set<string>();
  const queueA = [commitA];
  while (queueA.length > 0) {
    const cur = queueA.shift()!;
    if (ancestorsOfA.has(cur)) continue;
    ancestorsOfA.add(cur);
    for (const p of listParentCommitIds(db, cur)) {
      queueA.push(p);
    }
  }

  const visitedB = new Set<string>();
  const queueB = [commitB];
  while (queueB.length > 0) {
    const cur = queueB.shift()!;
    if (ancestorsOfA.has(cur)) return cur;
    if (visitedB.has(cur)) continue;
    visitedB.add(cur);
    for (const p of listParentCommitIds(db, cur)) {
      queueB.push(p);
    }
  }

  throw new DocumentError(
    "BAD_REQUEST",
    "无法计算 mergeBaseCommitId：两提交无公共祖先",
    400,
  );
}

/**
 * merge 发布前校验分叉关系。
 * - localBaseCommitId 与 remoteCommitId 不能相同（否则应走普通线性发布）
 * - localBaseCommitId 必须是 remoteCommitId 的祖先（允许远端在分叉后线性前进）
 */
export function assertMergeFork(
  db: Database.Database,
  localBaseCommitId: string,
  remoteCommitId: string,
): void {
  if (localBaseCommitId === remoteCommitId) {
    throw new DocumentError(
      "BAD_REQUEST",
      "合并发布要求 localBaseCommitId 与 remoteCommitId 不同",
      400,
    );
  }
  if (!isAncestorOf(db, localBaseCommitId, remoteCommitId)) {
    throw new DocumentError(
      "BAD_REQUEST",
      "localBaseCommitId 不是 remoteCommitId 的祖先，无法合并",
      400,
    );
  }
}
