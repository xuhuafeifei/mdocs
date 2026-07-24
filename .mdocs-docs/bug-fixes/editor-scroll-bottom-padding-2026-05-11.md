# 编辑器滚动到底部没有留白 — 底部空隙修复记录

**本文回答：** 为何给编辑器 scroll 容器加 `padding-bottom` 或 `::after` 没有效果；以及最终如何让文档底部出现真正的呼吸空间。

## 涉及文件

- `src/web/app/App.css` — `.mdocs-document-editor-root` / `.mdocs-editor-scroll-host`
- `src/web/app/DocumentEditor.tsx` — scroll 容器节点改用 className

## 现象

文档滚动到底部时，最后一行文字紧贴可视区下边缘，没有留白，阅读体验差。

## 根因分析

### 1）库的编辑器根节点带 `height: 100%`

`@lobehub/editor`（`@fgbg/lobe-editor`）的 `ReactPlainText` 渲染的根 `div` 带有如下库内样式：

```css
/* 来自库内 styles$1.__root */
height: 100%;
display: flex;
flex-direction: column;
```

这使得编辑器根节点（即我们给 `Editor` 传入的 `className="mdocs-document-editor-root"` 所在节点）**恒等于 scroll 容器的高度**，不会随内容增长。

### 2）文字通过 `overflow: visible` 溢出到盒外

根节点内部的 `contenteditable` 为 `flex: 1; min-height: 0`，在一个高度固定（`height: 100%`）的 flex column 里被限定在容器高度内。文字超出时通过默认的 `overflow: visible` 向外溢出，在视觉上超出根节点的布局盒子。

scroll 容器（`overflow: auto`）**能看到这些溢出内容**并产生滚动，但溢出内容的位置是从根节点盒子内部延伸出来的，完全独立于盒子之后的任何元素。

### 3）所有"在盒子后面加空间"的方案都失效

| 方案 | 为什么失效 |
|------|-----------|
| scroll 容器加 `padding-bottom` | 全局有 `* { box-sizing: border-box }`；且 `padding-bottom` 在 Chromium 的 scroll container 里有时不计入 `scrollHeight`（已知 bug） |
| scroll 容器加 `::after { height: 80px }` | `::after` 追加在编辑器根节点（`height: 100%`）**之后**，溢出文字却延伸到根节点盒子**之外更远处**，覆盖了 `::after`，`::after` 对最大滚动位置没有贡献 |
| `contenteditable` 加 `padding-bottom` | 全局 `box-sizing: border-box` 使 padding 被吸收进固定高度盒子内，压缩了内容区，文字溢出起点上移，绝对溢出终点不变 |

## 修复方案

在 `.mdocs-document-editor-root` 上覆盖库的 `height: 100%`，改为 `height: auto + min-height: 100%`：

```css
.mdocs-document-editor-root {
  height: auto !important;  /* 覆盖库内的 height: 100% */
  min-height: 100%;         /* 短文档时仍撑满视口 */
}
```

**效果：**
- 编辑器根节点现在随文字内容自然撑高（`height: auto`）
- scroll 容器的 `::after { height: 80px }` 追加在根节点真实末尾之后，对 `scrollHeight` 有实际贡献
- 滚动到底部时，`::after` 的 80px 白色空隙可见

同时 scroll 容器改用 CSS class 统一管理：

```css
/* src/web/app/App.css */
.mdocs-editor-scroll-host {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 16px 16px 0;
}

.mdocs-editor-scroll-host::after {
  content: "";
  display: block;
  height: 80px;
}
```

```tsx
/* DocumentEditor.tsx — scroll 容器 */
<div className="mdocs-editor-scroll-host">
  <Editor ... />
</div>
```

## 经验与规律

1. **第三方组件可能隐含 `height: 100%`**：引入编辑器类库时，库内根节点常带 `height: 100%`，这在 scroll container 内会导致「内容永远不超出容器」的假象。需要用 `height: auto !important` + `min-height: 100%` 组合覆盖。

2. **`overflow: auto` 容器的 `padding-bottom` 有兼容性问题**：在 flex 布局中，scroll 容器的 `padding-bottom` 在 Chromium 下不稳定地被计入 `scrollHeight`。最可靠的方案是用真实 DOM 节点或 `::after` 伪元素添加高度块，但**前提是内容高度必须靠内容本身撑开，而非靠 `height: 100%` 填充**。

3. **`box-sizing: border-box` 全局重置会影响 padding 分析**：项目里 `* { box-sizing: border-box }` 使所有 padding 都在盒子内部消化，`padding-bottom` 在 flex 子项上只会压缩内容区，不会增加元素对 scroll container 的贡献高度。

## 检索关键词（供 AI / 全文搜索）

`height: 100%` · `height: auto` · `min-height: 100%` · `overflow: visible` · scroll 底部留白 · `padding-bottom` 失效 · `::after` 无效 · `scrollHeight` · `box-sizing: border-box` · `flex: 1 min-height: 0` · `mdocs-editor-scroll-host` · `mdocs-document-editor-root` · `@lobehub/editor` · `ReactPlainText`
