# 知识图谱单一焦点 — 代码索引

> 所属需求：`knowledge-graph`（增量：焦点模型）
> 第一期：焦点互斥 + 树高亮切换。Ask 引用和后端只读控制为第二期。

## 第一期变更

| 文件 | 符号 | 说明 |
|------|------|------|
| `src/web/app/App.tsx` | `AppFocus` 类型 | 新增 `AppFocus` union type |
| `src/web/app/App.tsx` | `focus` state | 新增 `useState<AppFocus>`，驱动树高亮和主区 |
| `src/web/app/App.tsx` | `openGraph` / `closeGraph` | 图谱打开/关闭时切换焦点 |
| `src/web/app/App.tsx` | `activeDocumentId` 派生 | 从 `focus` 派生，而非独立 state |
| `src/web/app/DocumentTree.tsx` | `graphFocusAnchorId` prop | 接收 graph 焦点锚点，驱动独立高亮 |
| `src/web/app/DocumentTree.tsx` + CSS | `mdocs-tree-row--graph-focus` | 图谱焦点独立高亮样式 |
| `src/web/app/GraphPage.tsx` | `onClose` | 已实现：手机端关闭按钮 |

## 第二期（本期不做）

| 文件 | 说明 |
|------|------|
| `src/web/app/AgentChatPanel.tsx` | 引用芯片双形态；`references` 互斥字段 |
| `src/web/services/endpoints.ts` | chat body 类型扩展 |
| Agent run / references 注入 | 识别 `graphFileId` |
| `tools-documents` / overwrite | graph 只读、禁止写 |