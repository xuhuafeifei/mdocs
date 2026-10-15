# 窄屏目录：push 跟手、表格先滚、收拢压缝、首滑卡顿

> 一句话：侧栏与正文同轨推开；表还能横滚就先滚表；修收拢后正文一条缝；修要先点一下才能滚。

## 现象

1. 只能贴左缘右滑才开目录；宽表上稍微横滑就弹出浮层目录。
2. 收拢目录后正文被挤成左边一条缝，右侧大片空白。
3. 窄屏第一次滑动不跟手，要点一下之后才能正常滚动。

## 根因

1. 旧实现是 fixed 抽屉 + 低阈值左缘手势，和表横滑抢事件。
2. push 轨道仍被 `.mdocs-shell > .mdocs-layout { flex:1 }` 压成一屏宽，`main` 用 `100%` 与侧栏互挤。
3. `window` 上非 passive 的 `touchmove` 让浏览器等 `preventDefault` 判决；竖滑未及时让出，首势被拖住。

## 方案

- 布局：去掉 scrim 浮层；`--mdocs-nav-reveal` 平移 `sidebar|main`；轨道宽 = `navW + 100vw`，`main` 固定 `100vw`。
- 手势：跟手写 CSS 变量（少 setState）；竖向占优立刻放弃；横滚有余量先交给容器。
- `touch-action`：正文 `pan-y`，编辑区 / sheet 滚容器 `pan-x pan-y`。

## 涉及

| 路径 | 说明 |
|------|------|
| `src/web/app/hooks/useEdgeSwipeOpen.ts` | push 跟手、竖滑优先、横滚优先 |
| `src/web/app/hooks/useEdgeSwipeOpen.test.ts` | 横滚祖先 / absorb 单测 |
| `src/web/app/App.css` | reader 轨道与 touch-action |
| `src/web/app/App.tsx` / `SettingsPage.tsx` | layoutRef + reveal 接线 |
