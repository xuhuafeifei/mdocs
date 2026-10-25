# 评论面板堆到正文下方，而不是从右侧滑出 — 2026-10-25

## 现象

点顶栏「评论」按钮后，评论面板出现在正文**下方左侧**（约 360×320，落在编辑区左边缘），像被挤歪了一样，而不是贴在右侧、占满高度的抽屉。

## 根因

`App.tsx` 把 `<CommentsPanel>` 渲染在 `.mdocs-editor-split-pane--primary` 里，作为 `EditorPaneHost` 的**同级节点**；而该 pane 是 `display:flex; flex-direction: column`。评论面板因此沿纵向排在编辑器后面。

真正的横向容器 `.mdocs-editor-with-comments`（`flex-direction: row`）在 `EditorPaneHost` 内部，只包住了 `.mdocs-editor-container`，评论面板从来没进过这个行容器 —— 所以 `comments.css` 里 `.mdocs-editor-with-comments` 的横向布局一直没生效。

## 修法

1. `EditorPaneHost` 新增 `aside?: ReactNode`，渲染进 `.mdocs-editor-with-comments` 内部、`.mdocs-editor-container` 之后。
2. `App.tsx` 里主栏 / 分屏下栏的 `<CommentsPanel>` 从「同级」改为通过 `aside` 传进去（面板状态、开关逻辑不变）。
3. 详情补充：
   - 抽屉拉宽后编辑区变窄，顶栏按钮会溢出；`.mdocs-editor-toolbar` 加 `flex-wrap: wrap`，窄容器时自动换行而不是被面板压住。
   - 窄屏（≤768px）右侧抽屉占不下：改为底部上滑面板（`position: fixed` + `width: 100vw`，隐藏拖宽手柄）。
     用 `vw` 而不是 `%`：祖先若有 transform，`%` 会按该祖先算宽（实测会变成 720px）。

## 验证（1424×841 视口）

- 打开评论：`.mdocs-comments-panel` → `x=1011, right=1371, h=841, w=360`，编辑器收窄到 751；顶栏换行后 `scrollWidth == clientWidth`，无按钮被遮。
- 关闭评论：面板消失，顶栏回到 62px 单行。
- 420 宽：面板 `fixed`、`w=420, h=62vh`，贴底。

## 涉及文件

- `src/web/app/EditorPaneHost.tsx`（`aside` prop）
- `src/web/app/App.tsx`（两处 `CommentsPanel` 位置）
- `src/web/app/comments.css`（窄屏底部面板、`min-height`）
- `src/web/app/App.css`（`.mdocs-editor-toolbar` 允许换行）
