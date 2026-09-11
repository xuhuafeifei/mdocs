# map — frontend

人读长文：[`../archive/frontend-structure.md`](../archive/frontend-structure.md)

### App shell / 路由

- **关键词**：`App` `DocumentTree` `DocumentEditor` `react-router` `mdocs-shell` `mdocs-sidebar-list`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/main.tsx` | 挂载 |
  | `src/web/app/App.tsx` | 主壳 / `openDocument`；悬浮层在 shell **外** |
  | `src/web/app/App.css` | `.mdocs-shell` `.mdocs-sidebar` `.mdocs-sidebar-list` |
  | `src/web/app/DocumentTree.tsx` | 文档树根节点 = `.mdocs-sidebar-list` |
  | `src/web/app/DocumentEditor.tsx` | 编辑器容器 |
  | `src/web/app/DocChrome.tsx` | 文档顶栏（桌面+reader）；`aiWrite`/`comments` |
  | `src/web/app/HtmlEditor.tsx` | HTML 预览/编辑（sandbox iframe） |
  | `src/web/app/MergeView.tsx` | 冲突 merge；`fileType` → raw-text 管道 |
- **布局约定**：shell 只承载 layout；侧栏头尾 `flex: 0 0 auto`，仅 list `overflow-y: auto`（见 [`../bug-fixes/sidebar-tree-scroll-header-footer-2026-09-10.md`](../bug-fixes/sidebar-tree-scroll-header-footer-2026-09-10.md)）
- **需求**：同域拖拽移动见 [`../requirements/document-move/`](../requirements/document-move/)（已同意）；HTML 文档见 [`../requirements/html-documents/`](../requirements/html-documents/)

### API 客户端

- **关键词**：`api` `endpoints` `ApiRequestError`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/services/client.ts` | `api` |
  | `src/web/services/endpoints.ts` | 各端点 |

### Hooks / 本地存储

- **关键词**：`useAutoSave` `useAutoPublish` `IndexedDB` `draft`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/hooks/useAutoSave.ts` | 自动保存 |
  | `src/web/app/hooks/useAutoPublish.ts` | 自动发布 |
  | `src/web/storage/drafts.ts` | `saveDraft` / `getDraft`；`contentKind` lexical\|html |

### 异步卸载保护（可复用）

- **关键词**：`mountedRef` `expectedDocIdRef` `unmount guard`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/App.tsx` | openDocument 竞态守卫 |
- **记录**：[`../bug-fixes/async-unmount-guard-pattern-2026-05-11.md`](../bug-fixes/async-unmount-guard-pattern-2026-05-11.md)、[`open-document-race-condition-2026-05-10.md`](../bug-fixes/open-document-race-condition-2026-05-10.md)

### i18n / 设置

- **关键词**：`i18n` `SettingsPage` `localStorage` `mdocs.`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/i18n/` | `en.ts` / `zh.ts` |
  | `src/web/app/SettingsPage.tsx` | 设置页 |

### 知识图谱（分层展示）

- **关键词**：`GraphPage` `contains` `globalDepth` `展开一级` `可见子图`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/GraphPage.tsx` | `GraphPage` |
  | `src/web/app/graph-layered-view.ts` | `buildContainsHierarchy` / `computeVisibleIds` |
- **需求**：[`../requirements/knowledge-graph/设计契约-layered-view.md`](../requirements/knowledge-graph/设计契约-layered-view.md)

### 知识图谱（访问门禁）

- **关键词**：`graph access` `full` `viaDocumentInvites` `GRAPH_FORBIDDEN`
- **结论**：private/restricted 仅域协作 `full`；public 放开；invite 不授图谱。
- **需求**：[`../requirements/knowledge-graph/设计契约-graph-access.md`](../requirements/knowledge-graph/设计契约-graph-access.md) · [代码索引](../requirements/knowledge-graph/代码索引-graph-access.md)

### AI 帮写（coding）

- **关键词**：`AiWrite` `帮写` `currentMd` `proposedMd` `hunk` `sending` `纯编辑` `inline diff` `红行只读` `diff 编提案`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/ai-write/AiWriteWorkbench.tsx` | `AiWriteWorkbench` |
  | `src/web/app/ai-write/AiWriteMarkdownPane.tsx` | `AiWriteMarkdownPane` |
  | `src/web/app/ai-write/markdown-hunks.ts` | `computeLineHunks` |
- **需求**：[`../requirements/agent-normal-coding-modes/`](../requirements/agent-normal-coding-modes/)

### 冲突 Merge（inline）

- **关键词**：`MergeView` `MergeInlinePane` `接收` `拒绝` `全部用我的` `三路 diff`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/MergeView.tsx` | `MergeView` |
  | `src/web/app/merge/MergeInlinePane.tsx` | `MergeInlinePane` |
  | `src/web/app/merge/merge-plan.ts` | `buildThreeWayMergePlan` |
- **需求**：[`../requirements/merge-inline-ui/`](../requirements/merge-inline-ui/)
