# 主界面右侧空白 / 编辑区不铺满 — 布局修复记录

**本文回答：** 为何文档页右侧出现大面积空白或灰色条、编辑器白底区域不横向撑满；以及在 `App.css` 中如何修复。

## 涉及文件

- `src/web/app/App.css` — 唯一改动点（`.mdocs-shell` / `.mdocs-layout` / `.mdocs-main`）

## 现象（两阶段）

### 1）整列空白（第二列几乎是空的）

- **DOM**：`div.mdocs-shell` 为 CSS Grid，模板为两列 `260px | 1fr`。
- **文档页结构**：侧栏 + 主内容被包在**同一个** `div.mdocs-layout` 里，作为 `mdocs-shell` 的**唯一**一个参与布局的子节点（访客条等为 `position:absolute/fixed`，不占栅格）。
- **结果**：该子节点默认只占**第 1 列（260px）**，第 2 列 `1fr` 空置，视觉上像「右侧整片空白」。
- **对照**：设置页 `SettingsPage` 用 Fragment 直接输出 `aside` + `main` 两个兄弟节点，恰好占满两列，故不易发现该问题。

**修复：** 让文档区容器跨满 shell 的两列。

```css
.mdocs-layout {
  grid-column: 1 / -1;
}
```

### 2）主内容区只有一窄条白底，右侧仍有一条灰底

- **DOM**：`mdocs-layout` 为横向 `display: flex`（默认 `flex-direction: row`），左侧 `aside.mdocs-sidebar` 固定宽度。
- **原因**：`main.mdocs-main` **未**声明 `flex: 1`，等价于 `flex-grow: 0`，主区域宽度按**内容**收缩，不会吃掉侧栏右侧剩余空间；多出的宽度落在 `mdocs-layout` 背景上，呈灰/浅蓝条。
- **注意**：这与「栅格只占一列」是**不同**根因，需两步都修。

**修复：** 主区占满 flex 剩余主轴空间，并保留 `min-width: 0` 以利子项收缩与省略号。

```css
.mdocs-main {
  flex: 1;
  min-width: 0;
  /* 其余原有 flex 列方向、min-height、overflow 等保持不变 */
}
```

## 检索关键词（供 AI / 全文搜索）

`mdocs-shell` · `mdocs-layout` · `mdocs-main` · `grid-template-columns` · `grid-column` · `flex: 1` · `min-width: 0` · 右侧空白 · 编辑区宽度

## 经验

1. **Grid 子项数量与列定义要一致**：外层列模板若按「左栏 | 右栏」写了两列，但实际只挂了一个「侧栏+正文」包装器，必须用 `grid-column: 1 / -1` 跨列，或改为单列表层由内部 flex 负责分栏。
2. **横向 flex 里「主内容」要显式长大**：侧栏 `flex-shrink: 0` + 主区 `flex: 1; min-width: 0` 是常见组合，缺 `flex: 1` 会出现「内容多宽主区就多宽」的缺口。
