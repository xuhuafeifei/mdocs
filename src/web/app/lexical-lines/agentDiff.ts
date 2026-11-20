import type { SerializedEditorState } from "lexical";

/**
 * 智能助手 → live Editor Diff 操作（对应 Lobe updateSlot / insertAfterSlot / removeSlot / overwriteAll）。
 * batch_update_slots 走 applyBatchSlotRanges（只对改动区间打 hunk，不跑整篇 LCS）。
 */
export type ApplyAgentDiffOp =
  | { op: "overwrite_all"; markdown: string }
  | { op: "overwrite_all_state"; state: SerializedEditorState }
  | {
      op: "batch_update_slots";
      ranges: Array<{ start: number; end: number; markdown: string }>;
    }
  | { op: "update_slot"; slot: number; markdown: string }
  | { op: "insert_after_slot"; slot: number; markdown: string }
  | { op: "remove_slot"; slot: number };

export type ApplyAgentDiffResult = { ok: true } | { ok: false; error: string };

export type ApplyAgentDiffFn = (op: ApplyAgentDiffOp) => ApplyAgentDiffResult;
