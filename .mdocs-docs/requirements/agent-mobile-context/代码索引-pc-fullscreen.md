# agent-mobile-context / PC 全屏 — 代码索引

## 关键词

| 关键词 | 路径 | 符号 / 说明 |
|--------|------|-------------|
| PC 全屏状态 | `src/web/app/App.tsx` | `agentPanelFullscreen`；关面板 / 开文档时重置 |
| fullscreen 合成 | `src/web/app/App.tsx` | `fullscreen={isNarrow \|\| agentPanelFullscreen}` |
| 切换回调 | `src/web/app/App.tsx` | `onToggleFullscreen`（窄屏不传） |
| 全屏按钮 | `src/web/app/AgentChatPanel.tsx` | `Maximize2` / `Minimize2`；有 `onToggleFullscreen` 才渲染 |
| 全屏样式 | `src/web/app/App.css` | `.mdocs-agent-panel--fullscreen`（复用） |

## 契约

- 手机全屏（已落地）：[`设计契约.md`](./设计契约.md)
- PC 全屏切换：[`设计契约-pc-fullscreen.md`](./设计契约-pc-fullscreen.md)
