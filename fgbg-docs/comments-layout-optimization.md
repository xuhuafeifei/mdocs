# 评论区布局优化

## 优化背景

评论输入区域存在垂直空间浪费问题：
- 拖拽手柄占用固定垂直空间
- 字符计数独占一行
- 底部操作按钮独占一行
- 整体 padding 较大

## 优化方案

### 1. 输入区域紧凑化

**修改文件：** `src/web/app/comments.css`

**优化内容：**
- 输入区域上下 padding 从 `16px` 减为 `12px`
- 拖拽手柄尺寸缩小为 `32×3px`，下边距从 `12px` 减为 `8px`
- 字符计数改为浮动显示在输入框右下角（使用 `position: absolute` + 渐变背景遮罩）
- 输入框底部 padding 增加到 `24px` 为字符计数预留显示空间

**代码变更：**
```css
.mdocs-comments-input-wrapper {
  padding: 12px 16px;
  position: relative;
}

.mdocs-comments-input-drag-handle {
  width: 32px;
  height: 3px;
  margin: 0 auto 8px;
}

.mdocs-comments-input {
  padding: 8px 12px 24px;  /* 底部增加 padding 容纳字符计数 */
}

.mdocs-comments-char-count {
  position: absolute;
  right: 22px;
  transform: translateY(-22px);
  font-size: 0.75rem;
  background: linear-gradient(to bottom, transparent 0%, white 30%);
  pointer-events: none;
  z-index: 1;
}
```

### 2. 输入框高度自动适配

**修改文件：** `src/web/app/CommentsPanel.tsx`

**功能：**
- 输入内容换行时自动增长高度
- 删除内容时自动缩回默认高度（80px）
- 高度上限为 300px，超出后显示滚动条
- 手动拖拽仍然可用，与自动适配逻辑不冲突

**代码变更：**
```tsx
const MAX_INPUT_HEIGHT = 300;
const MIN_INPUT_HEIGHT = 80;
const textareaRef = useRef<HTMLTextAreaElement>(null);

function adjustTextareaHeight() {
  const ta = textareaRef.current;
  if (!ta) return;
  ta.style.height = "auto";
  const sh = ta.scrollHeight;
  const clamped = Math.min(Math.max(sh, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT);
  ta.style.height = `${clamped}px`;
  setInputHeight(clamped);
}

// onChange 时触发
onChange={(e) => {
  setNewComment(e.target.value.slice(0, 512));
  setTimeout(() => adjustTextareaHeight(), 0);
}}

// 切换回复状态时也调整高度
useEffect(() => {
  setTimeout(() => adjustTextareaHeight(), 0);
}, [replyTo]);
```

## 优化效果

- **节省垂直空间：** 约 30-40px，评论列表可显示更多内容
- **交互体验：** 输入换行自动撑高，删空自动缩回，无需手动拖拽
- **视觉效果：** 字符计数浮动显示更现代，整体布局更紧凑
- **保持功能：** 拖拽调整高度、拖拽调整面板宽度均保留

## 涉及文件

- `src/web/app/comments.css` - 样式优化
- `src/web/app/CommentsPanel.tsx` - 自动高度逻辑
