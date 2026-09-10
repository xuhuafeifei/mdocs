# 左侧目录树整栏滚动（头尾未固定）

> 一句话：侧栏头尾应钉住，仅中间目录树滚动；此前整栏随页滚、顶栏底栏被带走。

## 现象

1. 左侧目录节点过多、超出视口时滚动：
   - 顶部品牌 / 新建 / 折叠等随滚动移出视口
   - 底部访客名 / 收藏 / 退出随滚动移出视口
2. 观感上像整块 Sidebar 在滚，而不是仅树列表在滚
3. 伴随：打开长文时整页出现浏览器级纵向滚动，侧栏高度被正文撑开

## 期望

- Header（品牌 + 折叠）、Actions（新建等）、Footer（用户信息）固定
- 仅 `.mdocs-sidebar-list` 出现纵向滚动条
- 主壳锁定视口高度；正文在编辑区内部滚动

## 根因

1. **父级高度失控**：`.mdocs-shell` 内除 `.mdocs-layout` 外还有 `AgentFab` / Agent 面板 / 帮写等兄弟节点。旧版 shell 为两列 grid 时，兄弟占格会把 layout 挤到隐式行；即便同格叠放，子项默认 `min-height: auto` 仍可能把主区撑高。侧栏随 layout 被拉高后，中间列表拿不到有限高度，`overflow-y: auto` 不生效。
2. **滚动容器错位的表象**：列表无法成为真正的滚动容器时，滚轮落到页面/外层，头尾一起滑走。
3. **侧栏 flex 未钉死**：虽有 column + list `flex:1`，在父高度无限时等价于内容撑开，而非「剩余空间内滚动」。

## 方案

1. **结构**：悬浮层（FAB / Agent / 帮写 / 恢复码等）移出 `.mdocs-shell`，shell 只承载设置页或 `.mdocs-layout`
2. **高度链**：`app-root` / `shell` / `layout` / `main` / `sidebar`：`min-height: 0` + `overflow: hidden` + 视口/100% 高度约束；`html, body, #root` 禁止整页滚动
3. **侧栏内部**：
   - sidebar：`flex` 列 + `overflow: hidden` + `height/max-height: 100%`
   - header / actions / footer：`flex: 0 0 auto`
   - list：`flex: 1 1 0` + `overflow-y: auto` + `overscroll-behavior: contain`

## 涉及文件

| 路径 | 符号 | 说明 |
|------|------|------|
| `src/web/app/App.tsx` | `App` 渲染树 | 悬浮层移出 shell；顺带补全 html/md 嵌套三元闭合括号 |
| `src/web/app/App.css` | `.mdocs-app-root` `.mdocs-shell` `.mdocs-layout` `.mdocs-sidebar` `.mdocs-sidebar-list` `.mdocs-main` | 高度链与头尾固定、列表局部滚动 |
| `src/web/styles/global.css` | `html, body, #root` | `overflow: hidden` |

## 验证

1. 展开足够多的目录节点，使树高于视口
2. 在树区域滚轮：顶栏、底栏不动；仅树列表滚动
3. 打开长文：浏览器无整页滚动条；正文在编辑区滚动；侧栏高度仍为视口

## 可复用模式

- **壳内只放主布局，fixed 浮层放壳外**，避免 grid/flex 兄弟参与最小高度计算
- 侧栏标准式：外层 `overflow: hidden` + 中间 `flex: 1 1 0; min-height: 0; overflow-y: auto`
- 可写入 / 已对照：`map/frontend.md`「App shell / 路由」
