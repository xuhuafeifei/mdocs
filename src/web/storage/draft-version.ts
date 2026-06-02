/** 草稿版本 / 冲突状态（与 IndexedDB DraftRecord 同存） */

export type DraftConflictStatus = "none" | "publish_conflict" | "diverged";

export interface DraftConflictRecord {
  /** 开编分叉点（与 DraftRecord.localBaseCommitId 同源） */
  localBaseCommitId: string;
  /** 进入冲突 / merge 时远端 tip */
  remoteCommitId: string;
  /** merge 前本地支 Lexical JSON，冲突瞬间冻结 */
  localSnapshotContent: string;
}
