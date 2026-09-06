# pull-sync-silent-noop-with-draft-2026-09-05

> 一句话：有未发布草稿时点「拉取更新」曾静默无效果；现改为有分叉则进合并，否则提示。

## 现象
点击「拉取更新」无任何反馈；`sync-status` 已为 `behind`。

## 根因
`handleSyncClick` 在 `draft && !draft.published` 时直接 `return`，且该判断写在「打开合并」之前，导致冲突/分叉路径永远走不到。

## 方案
1. 先处理 `conflictPending` → 打开 MergeView  
2. 有草稿且 `behind` → 写入 diverged conflict 并打开合并  
3. 有草稿且未落后 → toast `pullBlockedDraft`  
4. 无草稿 → 原 `executePullRemote`

## 涉及文件
| 路径 | 符号 | 说明 |
|------|------|------|
| `src/web/app/App.tsx` | `handleSyncClick` | 修正分支顺序与反馈 |
| `src/web/i18n/locales/zh.ts` / `en.ts` | `pullBlockedDraft` | 文案 |

## 验证
- 本地有草稿 + behind：点拉取 → 进入合并 UI  
- 本地有草稿 + 未 behind：点拉取 → toast  
- 无草稿：点拉取 → 覆盖为远端正文  
