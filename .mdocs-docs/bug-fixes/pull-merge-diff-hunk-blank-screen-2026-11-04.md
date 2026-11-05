# 拉取更新进合并时整页「mdocs 加载中…」（含 Keep All 后）

> 一句话：AI Diff 草稿里的 `diff-hunk` 进 Merge 桥抛错，无 ErrorBoundary → `#root:empty`，桌面壳尤甚。

## 现象

- 桌面壳（WKWebView）上，AI Diff 审阅中或点完 **Keep All** 再点「拉取更新」，整页变成「mdocs 加载中…」且不再恢复。
- 浏览器里不易复现（状态/缓存差异）。
- 文案来自 `index.html` 的 `#root:empty::before`，不是 App 内 `phase === "loading"`。

## 根因

1. 有未发布草稿且落后远端时，「拉取更新」打开 `MergeView`，本地快照来自 IndexedDB 草稿的 Lexical JSON。
2. AI Diff 会把 `diff-hunk` 写进编辑器并自动保存进草稿；**Keep All** 只改活编辑器，防抖草稿常仍带 hunk。
3. `LexicalMarkdownBridge` 未注册 Diff 节点；`setDocument` / 初始 `content` 遇 `diff-hunk` 抛错。
4. 应用无 ErrorBoundary → React 卸掉整棵树 → `#root:empty` → CSS「mdocs 加载中…」。

## 方案

- 纯函数 `stripDiffHunksFromLexicalJson`（对齐 `flattenCanonicalState(..., "keep")`，不依赖 editor 包）在 Bridge / 建 conflict / 渲染 MergeView 前压掉 hunk。
- `handleSyncClick` 先 `saveBeforeNavRef` 再读草稿，让 Keep All 后的正文先落盘。
- `MergeErrorBoundary` 包住合并页，避免再炸成整页空 root。

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `src/web/app/merge/stripDiffHunksFromLexicalJson.ts` | `stripDiffHunksFromLexicalJson` | 压 hunk |
| `src/web/app/LexicalMarkdownBridge.tsx` | `LexicalMarkdownBridge` | 灌入前 strip |
| `src/web/app/App.tsx` | `handleSyncClick` | 拉前刷盘 + conflict strip |
| `src/web/app/MergeErrorBoundary.tsx` | `MergeErrorBoundary` | 合并页容错 |

## 验证

- Diff 审阅中 / Keep All 后点「拉取更新」→ 进入合并页，不再整页「mdocs 加载中…」。
- `pnpm vitest run src/web/app/merge/stripDiffHunksFromLexicalJson.test.ts`
- 阿里云已 pack 验证；npm `@fgbg/mdocs@3.1.6`。

## 可复用模式

- 已写入 [`../map/frontend.md`](../map/frontend.md)「冲突 Merge（inline）」：进合并前 strip `diff-hunk`；拉前刷盘；合并页 ErrorBoundary。
- 「永远 mdocs 加载中」优先当 **JS 未挂载 / 树被卸光**（`#root:empty`），不要先怀疑接口。
