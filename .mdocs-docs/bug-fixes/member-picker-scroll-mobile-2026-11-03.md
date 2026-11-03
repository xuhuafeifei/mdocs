# 工作空间「成员」弹窗：列表不滚动 + 手机端错位

> 一句话：弹窗被手机上设置页的 `transform` 带着跑，且两栏没有可收缩的滚动容器，访客一多就看不全。

## 现象

1. 访客目录变长后，左侧「全部访客」看不全，弹窗被内容撑高、底部按钮被挤出屏幕。
2. 右侧「已选成员」同样不滚。
3. 手机端整个弹窗偏移到屏幕左侧外（约 -300px），右侧被裁掉。

## 根因

1. **弹窗挂在设置页容器里**：手机端设置页用 `transform: translateX(-300px)` 做「左栏推屏」，`position: fixed` 的后代会被这个 transform 重新定位 → 遮罩宽度变成 690，而不是 390。
2. **没有可收缩的 flex 链**：`.mdocs-visitor-picker-dialog` 是 flex 列，但内容区是个无类名 `div`（`min-height: auto`），它按内容高度撑开，把 footer 顶出弹窗；`.mdocs-visitor-picker-columns` 的网格行也没被压到可用高度。
3. **手机端没有真正切上下分**：只在 720px 断点把列改成单列，但 `max-height: none`，于是两块内容叠加溢出。

## 方案

1. `VisitorPickerModal` 用 `createPortal(..., document.body)`，脱离 transform 祖先。
2. 内容区加 `.mdocs-visitor-picker-body`：`display:flex; flex-direction:column; flex:1 1 auto; min-height:0`。
3. `.mdocs-visitor-picker-columns`：`grid-template-columns: minmax(0,1fr) ×2`（`1fr` 的最小值是 min-content，会被长 ID 撑宽）+ `grid-template-rows: minmax(0,1fr)`；两栏 `min-height:0`，表格容器 `overflow:auto`。
4. 手机（≤720px）：整屏抽屉 `90vh`、`grid-template-rows: minmax(0,1fr) minmax(0,1fr)`（上下分），表格 `min-width:460px` 让两栏各自横向滚动；footer 加 `safe-area-inset-bottom`。
5. 顺手修：搜索框原本是横向 toolbar 的 `flex:1 1 100%`，进入纵向 flex 后被拉成整块高度 → 在 body 内重置为 `flex:0 0 auto`。

## 涉及文件

| 路径 | 说明 |
|------|------|
| `src/web/app/VisitorPickerModal.tsx` | portal 到 body；内容区加 `mdocs-visitor-picker-body` |
| `src/web/app/domain.css` | flex 收缩链、`minmax(0,1fr)`、手机上下分与横向滚动 |

## 验证

- 桌面 1000×500（矮窗口）：两栏各自可纵向滚动，footer 始终可见。
- 手机 390×844：弹窗 `x=0 w=390`，上下分栏（各 ~295px），两栏均可横向滚动，footer 在视口内。
- 桌面 1440：弹窗 960、两栏 461+461 均分。

## 可复用模式

- **凡是 `position: fixed` 的弹窗，都要 portal 到 `document.body`**：mdocs 的移动端布局大量使用 `transform` 推屏，fixed 会跟着跑（该项目此前也踩过「发布弹窗被 reader transform 带跑」）。
- **flex/grid 里做内部滚动**：容器要 `min-height:0`，网格用 `minmax(0,1fr)`，中间不能有未设 flex 的裸 `div`。
