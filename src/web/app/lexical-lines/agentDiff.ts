import type { SerializedEditorState } from "lexical";

/**
 * 智能助手 → live Editor Diff 操作（对应 Lobe updateSlot / insertAfterSlot / removeSlot / overwriteAll）。
 * batch_update_slots 走 overwrite_all_state（Lexical JSON），避免整篇 MD 往返假 Diff。
 */
export type ApplyAgentDiffOp =
  | { op: "overwrite_all"; markdown: string }
  | { op: "overwrite_all_state"; state: SerializedEditorState }
  | { op: "update_slot"; slot: number; markdown: string }
  | { op: "insert_after_slot"; slot: number; markdown: string }
  | { op: "remove_slot"; slot: number };

export type ApplyAgentDiffResult = { ok: true } | { ok: false; error: string };

export type ApplyAgentDiffFn = (op: ApplyAgentDiffOp) => ApplyAgentDiffResult;
