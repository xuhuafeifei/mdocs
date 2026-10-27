# 评论侧栏错位 + DocChrome tooltip 被裁切

> 一句话：评论必须挂在 `.mdocs-editor-with-comments` 横排里；顶栏横向滚动会裁切 CSS `::before` tooltip，改 portal。

## 现象

1. 点顶栏「评论」后，评论框出现在正文中间（像浮在编辑区里），而不是贴编辑器右侧。
2. DocChrome 顶栏为窄栏加横向滚动后，收藏 / 拉取 / 发布 / 评论 / 文档信息等 tooltip 被挡住或看不见。

## 根因

1. **评论挂载点错误**：`CommentsPanel` 被渲染为 `.mdocs-editor-split-pane`（`flex-direction: column`）的兄弟节点，落在 `EditorPaneHost` **之外**。侧栏设计依赖 `.mdocs-editor-with-comments`（横向 flex）把面板放在 `.mdocs-editor-container` 右侧；挂在 column 分屏容器上时被挤到编辑器下方/中间。
2. **overflow 裁切 tooltip**：`.mdocs-editor-header-scroll { overflow-x: auto }` 形成 scrollport；`.mdocs-tooltip::before/::after` 是 `position: absolute` 子元素，溢出部分被裁掉。CSS 规定一侧非 `visible` 时另一侧也不能真正 `visible`，无法只滚 x、放行 y 上的伪元素提示。

## 方案

1. `EditorPaneHost` 增加 `commentsSlot`，在 `.mdocs-editor-with-comments` 内、编辑容器旁渲染；`App.tsx` 主/副分屏把 `CommentsPanel` 改经该 slot 传入。
2. DocChrome 顶栏提示改为 `ChromeTip`：`createPortal` 到 `document.body` 的 `position: fixed` 浮层；scrollport 内不再依赖会被裁切的 CSS tooltip。

顺带保留顶栏 `flex-wrap: nowrap` + 横向滚动（窄栏不折两行）。

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `src/web/app/EditorPaneHost.tsx` | `commentsSlot` | 评论挂回横排容器 |
| `src/web/app/App.tsx` | `commentsSlot={…}` | 主/副栏传入 `CommentsPanel` |
| `src/web/app/DocChrome.tsx` | `ChromeTip` | portal tooltip |
| `src/web/app/App.css` | `.mdocs-editor-header-scroll` `.mdocs-chrome-tip` | 横向滚 + portal 样式 |
| `src/web/app/comments.css` | `.mdocs-editor-with-comments` | 既有横排约定（未改语义） |

## 验证

- 打开 md 文 → 点评论 → 面板贴右侧，可拖宽；关后再开位置正确。
- 分屏上下栏各自打开评论时，面板跟当前聚焦栏。
- 缩窄中间编辑区使顶栏出现横向滚动条 → 悬停收藏/拉取/发布/评论/文档信息，提示在按钮下方可见、不被裁切。

## 可复用模式

- **侧栏/抽屉类 UI**：必须挂在约定 flex 容器内（此处 `.mdocs-editor-with-comments`），不要挂到外层 column/stack 当「顺手兄弟」。
- **可横向滚动的工具栏**：CSS `::before` tooltip 与 `overflow-x: auto` 不兼容；优先 portal / fixed，或原生 `title`。
- 已写入 `map/frontend.md`「DocChrome / 评论侧栏」节。
