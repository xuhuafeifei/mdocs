# 编辑器内容宽度溢出 Bug 修复记录

> **问题现象**：编辑器内插入宽表格（14 列）或大图片时，横向撑开整个编辑器容器，导致右侧 Outline 大纲被挤出视野。刷新无效，必须关闭左侧目录树才能看到大纲。

---

## 根本原因分析

这是 **CSS Flex 布局的经典陷阱**：`min-width: auto` 默认行为。

### Flex 布局规则

在 `display: flex` 的行布局中：
- flex item 默认 `min-width: auto`，意味着**容器会被内容撑开，哪怕设置了 `flex: 1`**
- 子元素设置 `overflow-x: auto` 会失效，因为父容器已经被内容撑大了
- `flexShrink: 0` 的元素会被挤出可见区域

### 问题分层解剖

```
.mdocs-shell (grid: 260px | 1fr)
└── .mdocs-editor-content-area (flex: 1, min-width: 0 ✅ mdocs 侧已加)
    └── Block (outlined, horizontal flex)  ⚠️  缺少 min-width: 0！
        ├── .mdocs-editor-scroll-host (overflow: auto)
        │   └── Editor
        │       └── .editor_table_scrollable_wrapper  ⚠️  缺少 min-width: 0！（上游问题）
        └── OutlineSideRail (flexShrink: 0, width: 200px)
```

**两层都有问题：**

| 层级 | 问题位置 | 问题描述 |
|------|----------|----------|
| 上游 | `.editor_table_scrollable_wrapper` | 只设置了 `overflow-x: auto`，但缺少 `min-width: 0`，flex 下会被表格撑开 |
| mdocs | 外层 `Block` (Editor + Outline 共享容器) | 只设置了 `minHeight: 0`，缺少 `minWidth: 0` |

---

## 修复方案

采用 **上游修复 + mdocs 双重保险** 策略：

### 1. 上游修复：@fgbg/lobe-editor (1.0.0-fork.9)

**表格宽度溢出修复**：
```typescript
// src/plugins/table/react/style.ts
export const styles = createStaticStyles(
  ({ css }) => css`
    overflow-x: auto;
    // flex 布局下，min-width: auto 会让容器按内容无限撑开，导致 overflow-x: auto 失效
    // 设置 min-width: 0 是 CSS flex 布局经典 fix
    min-width: 0;
    ...
  `
);
```

**图片宽度溢出修复**：
```typescript
// src/plugins/image/react/style.ts
export const styles = createStaticStyles(({ css }) => ({
  image: css`
    ...
    img {
      max-width: 100% !important; // 覆盖 Antd Image 的 min(4200px, 100%)
    }
  `,
  blockImage: css`
    ...
    img {
      max-width: 100% !important;
    }
  `,
}));
```

### 2. mdocs 侧补充修复

**外层 Block 增加 minWidth: 0**：
```tsx
// src/web/app/DocumentEditor.tsx
<Block
  variant="outlined"
  horizontal
  style={{ 
    background: "var(--mdocs-surface)", 
    flex: 1, 
    minHeight: 0, 
    minWidth: 0,  // 新增：防止宽表格撑开 Outline
    borderRadius: 0, 
    outline: "none" 
  }}
>
```

**CSS 补丁（双重保险）**：
```css
/* src/web/app/App.css */
.mdocs-editor-content-area {
  min-width: 0 !important;
}

.mdocs-editor-content-area .editor_table_scrollable_wrapper {
  min-width: 0 !important;
  max-width: 100% !important;
}

.mdocs-editor-content-area img {
  max-width: 100% !important;
}
```

---

## 验证清单

- ✅ 14 列宽表格：在编辑器内横向滚动，不再撑开容器
- ✅ 大图片：宽度限制在容器内，max-width: 100% 生效
- ✅ 左侧目录树展开/收起：Outline 始终可见，不会被挤出
- ✅ 只读模式：同样生效

---

## 经验总结

1. **Flex 布局只要用 `overflow: auto`，必须配套 `min-width: 0`**（横向滚动）或 `min-height: 0`（纵向滚动）
2. **第三方 UI 组件库的内联样式优先级高**，需要 `!important` 覆盖
3. **CSS 问题优先分层排查**：从外层容器到内层内容，逐层检查约束是否传递到位
4. **上游修复 + 本地补丁**是 fork 依赖的最佳实践，避免反复阻塞开发