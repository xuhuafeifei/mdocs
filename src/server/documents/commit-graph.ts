/**
 * 文档提交 DAG 的图遍历与校验。
 *
 * 用于 merge 发布前确认：base 是否为 expectedHead 的祖先（分叉是否成立）。
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
  // hash set优化
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const parents = listParentCommitIds(db, cur);
    for (const p of parents) {
      if (p === ancestorId) return true;
      // bfs的时候会存在重复遍历的情况，set 去重
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
 * merge 发布前校验分叉关系。
 * - base 与 expectedHead 不能相同（否则应走普通线性发布）
 * - base 必须是 expectedHead 的祖先（共同祖先之后分两路改）
 */
export function assertMergeFork(
  db: Database.Database,
  baseCommitId: string,
  expectedHeadCommitId: string,
): void {
  /* 
   * 如果 base(本地 commit 的父节点) 和 expect(远端文章最新的节点)相同
   * 则不走 conflict merge逻辑, 应该走普通线性发布逻辑
   */
  if (baseCommitId === expectedHeadCommitId) {
    throw new DocumentError(
      "BAD_REQUEST",
      "合并发布要求 base 与 expectedHead 不同",
      400,
    );
  }
  if (!isAncestorOf(db, baseCommitId, expectedHeadCommitId)) {
    throw new DocumentError(
      "BAD_REQUEST",
      "base 不是 expectedHead 的祖先，无法合并",
      400,
    );
  }
}
