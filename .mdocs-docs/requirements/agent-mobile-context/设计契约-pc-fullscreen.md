# agent-mobile-context 增量 — PC 全屏切换

> **状态**：已同意（2026-09-10）  
> 依据：[`设计契约.md`](./设计契约.md)（手机全屏已落地）  
> 范围：仅前端面板布局；不改 SSE / references / 后端。

## 现状

| 端 | 行为 |
|----|------|
| 窄屏（`isNarrow`，≤768） | `fullscreen={true}`，铺满视口；无浮层锚点 |
| PC | 跟随 FAB 的浮层（约 480×680），**无全屏入口** |

## 方案

### A. 手机

- **不变**：打开即全屏；不提供「退出全屏回浮层」。
- 关闭仍走现有关闭按钮 / FAB。

### B. PC

| 项 | 约定 |
|----|------|
| 默认 | 仍为 FAB 旁浮层（现状） |
| 入口 | 面板 header 增加「全屏 / 退出全屏」图标按钮（lucide `Maximize2` / `Minimize2`） |
| 状态 | `App` 持有 `agentPanelFullscreen: boolean`；`fullscreen={isNarrow \|\| agentPanelFullscreen}` |
| 关闭后 | 关闭面板时 **重置** `agentPanelFullscreen=false`（下次打开仍是浮层） |
| 窄屏 | **不渲染** 全屏切换按钮（本来就是全屏） |
| CSS | 复用已有 `.mdocs-agent-panel--fullscreen`，不新增布局类 |

### C. 不做

- 不记 localStorage（不持久化全屏偏好）
- 不改 FAB 拖动 / 锚点算法
- 不改帮写全屏层（`AiWriteWorkbench`）

```text
App
  isNarrow → 强制 fullscreen，无切换钮
  !isNarrow → 浮层默认；header 切换 agentPanelFullscreen
AgentChatPanel(fullscreen, onToggleFullscreen?)
```

## 变更触达

| 文件 | 改动 |
|------|------|
| `App.tsx` | `agentPanelFullscreen` state；传 `fullscreen` / `onToggleFullscreen`；关面板时重置 |
| `AgentChatPanel.tsx` | PC 显示 Maximize/Minimize；调用 `onToggleFullscreen` |
| `App.css` | 仅在需要时微调 header 按钮间距（可无改） |

## 验收

1. PC：打开助手 → 浮层；点全屏 → 铺满；再点 → 回浮层；关闭再开 → 浮层。
2. 手机：打开即全屏；无全屏切换按钮。

## 请确认

同意本增量后按上表改前端。若希望「关闭后记住全屏」再说一声。
