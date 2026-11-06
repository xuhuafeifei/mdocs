# batch_update_slots 全文假 Diff

> 一句话：批量改几段却整篇红绿；根因是合成提案时整篇 Lexical→MD→再 parse，未改块也变了形态。

## 现象

Agent `batch_update_slots` 后，未改段落也成对红删 + 绿增，看起来像「全文都改了」。

## 根因

1. 前端按 ranges 拼出提案块后，原先 `batchRangesToProposedMarkdown` 把**整篇** hydrate 再 `export().markdown`。
2. 再 `overwriteAll(md)`：旧边 = live `toJSON()`，新边 = 全文 MD 再解析。
3. 未改块经 MD 往返后 indent/拆分/列表边界等漂移，LCS 对齐一崩 → 大片 modify。

（`overwrite_all` 单工具已有 canonicalize + 纯文本 equal 兜底，见 [overwrite-all-false-diff-hunks-2026-10-28](./overwrite-all-false-diff-hunks-2026-10-28.md)；批量路径多了一次整篇往返，更容易炸。）

## 方案

- Lobe：新增 `overwriteAllFromState(editor, SerializedEditorState)`。
- mdocs：`batchRangesToProposedState` 保留 base JSON 未改块，直接 `overwrite_all_state`。
- 依赖：`@fgbg/lobe-editor` → `1.0.0-fork.39`。

## 涉及文件

| 路径 | 说明 |
|------|------|
| `my-lobe-editor/src/plugins/diff/api.ts` | `overwriteAllFromState` |
| `src/web/app/lexical-lines/batchSlotRangesApply.ts` | `batchRangesToProposedState` |
| `src/web/app/App.tsx` / `DocumentEditor.tsx` / `agentDiff.ts` | 接线 |
