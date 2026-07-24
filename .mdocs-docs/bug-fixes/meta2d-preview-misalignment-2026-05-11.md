# Meta2d 缩略图预览错位 / 仅见左上角裁切 修复记录

## 现象

在 mdocs（及 lobe-editor）中，Markdown 里 Meta2d 图块的**预览卡片**里，图形挤在白色区域内**左上角**，部分内容被上边缘裁切；看起来像「坐标错位」，实为**显示与导出参数不一致**叠加导致。

## 根因

### 1. 预览容器与 SVG 固有尺寸（主因）

- `canvas2svg` 序列化出的根 `<svg>` 常带有**较大的** `width` / `height`（与导出画布一致）。
- 预览外层卡片宽度仅数百像素，且曾使用 **`overflow: hidden`**。
- 浏览器按 SVG 的固有尺寸排版时，可视区域只覆盖图形的**左上角**，其余被裁掉 → 表现为「错位」「顶边被切」。

### 2. 与 Meta2d 官方 `downloadSvg` 对齐

`@meta2d/core` 的 `downloadSvg` 对 `getRect()` 的处理是：

- 仅将 `rect.x`、`rect.y` 各减 **10**（留白），**不改变** `rect.width` / `rect.height`。
- `Canvas2Svg` 构造尺寸为 **`rect.width + 20` × `rect.height + 20`**。
- 将**同一份** `rect`（已减过 x/y）传入 `renderPenRaw(ctx, pen, rect, true)`。

若自定义导出把传给 `renderPenRaw` 的矩形宽高改成「已膨胀」的版本，虽主要平移只用 `x/y`，但与官方路径不一致，维护/export 行为可能对齐产生偏差；**应以官方 `downloadSvg` 为准**。

### 3. 笔过滤

官方导出循环中跳过 `visible === false` 且 **`!isShowChild(pen, store)`** 的笔。预览生成若不排除，可能与编辑器内可见内容不一致。

## 修复方案

### A. UI：`DiagramPreview.tsx`（my-lobe-editor）

- 对序列化字符串在根 `<svg>` 上注入内联样式：`max-width: 100%`、`height: auto`、`display: block`、水平居中，使大图在卡片内**等比缩小**。
- 预览区使用 **flex 居中**、**`maxHeight` + `overflow: auto`**，避免固定小框裁切长图。

### B. 导出：`meta2dManager.ts` 中 `generateSvgFromDiagram`（my-lobe-editor）

- 取 `engine.getRect()` 后 **`rect.x -= 10`、`rect.y -= 10`**，`new Canvas2Svg(ceil(width+20), ceil(height+20))`，与官方一致。
- 使用 **`isShowChild(pen, store)`** 与 `visible` 过滤笔，再调用 `renderPenRaw`。

## 涉及文件（实现仓库）

| 仓库 | 路径 |
|------|------|
| **my-lobe-editor** | `src/plugins/meta2d/react/DiagramPreview.tsx` |
| **my-lobe-editor** | `src/plugins/meta2d/utils/meta2dManager.ts` |

mdocs 通过依赖 `@fgbg/lobe-editor`（或本地 `link:` / `file:` 指向 `my-lobe-editor`）获得上述行为；**不以 mdocs 内打补丁为长期方案**，以 my-lobe-editor 源为准。

## 检索关键词（供 AI / 人类）

`Meta2d` `canvas2svg` `DiagramPreview` `generateSvgFromDiagram` `getRect` `downloadSvg` `renderPenRaw` `isShowChild` `overflow hidden` 预览 错位 裁切 缩略图

## 经验教训

1. **大固有尺寸的 inline SVG 在窄容器里必须用 `max-width: 100%` / `height: auto`（或等价）**，否则 `overflow: hidden` 会只显示一角。
2. **与库里已有导出路径（`downloadSvg`）保持一致**，减少坐标与留白上的分叉。
3. **预览渲染应使用与导出相同的可见性规则**（`isShowChild` 等）。
