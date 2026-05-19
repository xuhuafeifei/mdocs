# 评论面板可调宽度 + 输入框可调高度 + 换行显示

## 背景

评论功能（`CommentsPanel.tsx` / `comments.css`）原有限制：

1. 评论内容以普通文本渲染，输入时的换行 `\n` 被折叠成空格，长评论显示成一坨
2. 评论面板宽度写死 `360px`，长评论或代码片段挤得难看
3. 输入框只能写 60px 高的几行字，没有任何手段拖大

## 改动

### 1. 评论内容保留换行

`.mdocs-comment-content` 增加 `white-space: pre-wrap`，让发出去的评论保留输入时的换行和空格，长评论不再挤成一坨。

### 2. 整个评论面板宽度可拖

`CommentsPanel.tsx` 内新增宽度状态 `panelWidth`（默认 360px），面板左边缘渲染一个 4px 宽的拖拽条 `.mdocs-comments-resize-handle`（hover/active 时变蓝），鼠标按住后通过全局 `mousemove` 监听 `window.innerWidth - e.clientX` 计算新宽度。

约束：`280px ~ 600px`。

### 3. 输入框顶部可拖调整高度

输入框上方新增一根灰色横条 `.mdocs-comments-input-drag-handle`（宽 40px，居中显示，hover 变蓝），鼠标按住通过 `e.movementY` 的负值累加调整 `inputHeight` 状态：向上拖 → 输入框变高，向下拖 → 输入框变矮。

约束：`60px ~ 600px`。

拖拽期间：
- `document.body.style.userSelect = "none"` 防止误选中文字
- `document.body.style.cursor = "row-resize"` 让光标在整个页面都保持拖拽样式
- `mouseup` 时全部还原

为什么不用 `resize: vertical`：
- 浏览器原生 `resize: vertical` 的拖拽手柄在**右下角**且只能往下变大，从底部往上缩 textarea 时会被 wrapper 的 flex 布局抵消，看起来"拖不动"
- 也无法实现"输入框顶部能拉"的直观语义（用户想让输入区往评论列表里"长"）

所以改成 React state + 自定义顶部 handle，textarea 设 `resize: none` 关掉原生 resize，高度由 `style={{ height: inputHeight }}` 接管。

### 4. 实现要点

- 两个拖拽用同一个全局 `mousemove` / `mouseup` 监听，用 `isDraggingRef` / `isInputDraggingRef` 两个 ref 区分谁在拖
- 用 ref 而不是 state 的原因：拖拽过程中改 state 会触发 re-render，监听器闭包会陈旧；ref 是稳定引用，任何时候读到都是最新值
- 输入框高度用 `movementY` 增量而不是绝对位置：避免因为 wrapper padding、border、reply notice 显隐导致基准点漂移；只关心"鼠标本帧移动了多少"

## 涉及文件

- `src/web/app/CommentsPanel.tsx` — 两个拖拽状态 + handle + 全局监听
- `src/web/app/comments.css` — 拖拽条样式、textarea 取消原生 resize、评论内容 `pre-wrap`
