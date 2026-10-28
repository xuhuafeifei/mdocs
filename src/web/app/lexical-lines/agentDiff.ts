/**
 * 智能助手 → live Editor Diff 操作（对应 Lobe updateSlot / insertAfterSlot / removeSlot / overwriteAll）。
 * batch_update_slots 在 App 侧合成 Markdown 后走 overwrite_all，不直接进本类型。
 */
export type ApplyAgentDiffOp =
  | { op: "overwrite_all"; markdown: string }
  | { op: "update_slot"; slot: number; markdown: string }
  | { op: "insert_after_slot"; slot: number; markdown: string }
  | { op: "remove_slot"; slot: number };

export type ApplyAgentDiffResult = { ok: true } | { ok: false; error: string };

export type ApplyAgentDiffFn = (op: ApplyAgentDiffOp) => ApplyAgentDiffResult;
