/** 草稿版本 / 冲突状态（与 IndexedDB DraftRecord 同存） */

export type DraftConflictStatus = "none" | "publish_conflict" | "diverged";

export interface DraftConflictRecord {
  /** 开编时服务端 head（与 DraftRecord.baseCommitId 同源） */
  baseCommitId: string;
  /** 冲突/合并时远端当前 head */
  expectedHeadCommitId: string;
  /** merge 前本地支 Lexical JSON，冲突瞬间冻结 */
  localSnapshotContent: string;
}
