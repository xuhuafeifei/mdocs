# batch_update_slots 仍整篇假 Diff

> 一句话：批量只改几个标题，全文仍成对红绿；根因是提案仍走整篇 LCS，且旧边用 `toJSON()` 与 `getDocument('json')` 不一致。

## 现象

Agent `batch_update_slots`（如只改 6 个小节标题）后，未改段落也红删 + 绿增（文案可完全相同）。

## 根因

1. 前端虽已 `batchRangesToProposedState` + `overwriteAllFromState`（避免整篇 MD 往返，见 [batch-diff-full-doc-false-hunks-2026-11-06](./batch-diff-full-doc-false-hunks-2026-11-06.md)），但仍对**全文**跑 LCS。
2. `applyOverwritePlan` 旧边用 `editor.getEditorState().toJSON()`，批量 base / 未改块来自 `getDocument('json')` → `exportNodeToJSON`；双序列化路径漂移 + 区间改块数后 LCS 错配 → 大片假 modify。

## 方案

- Lobe：`applyBatchSlotRanges` — 按 ranges 高→低只在触及区间插入 DiffHunk，不跑整篇 LCS。
- Lobe：`overwriteAll` / `FromState` 旧边改为 `exportNodeToJSON`（与 getDocument 同源）。
- mdocs：`batch_update_slots` 直接调 `applyBatchSlotRanges`。
- 依赖：`@fgbg/lobe-editor` → `1.0.0-fork.45`。

## 涉及文件

| 路径 | 说明 |
|------|------|
| `my-lobe-editor/src/plugins/diff/api.ts` | `applyBatchSlotRanges`；旧边 export 对齐 |
| `src/web/app/App.tsx` / `DocumentEditor.tsx` / `agentDiff.ts` | 接线 |

## 验证

- 只 batch 改若干标题 → 仅这些位置有 hunk；文首未改段落无红绿。
