# map — frontend

人读长文：[`../archive/frontend-structure.md`](../archive/frontend-structure.md)

### 中间上下分屏（PC）

- **关键词**：`editor split` `上下分屏` `openBelow` `Alt+click`
- **结论**：仅 PC；上/下均可编；类型可混；同 id 禁止双开；URL 跟上栏。
- **定位**：`EditorPaneHost.tsx` · `editorSplitStorage.ts` · `App.tsx`（`openDocumentBelow`）
- **需求**：[`../requirements/editor-vertical-split/`](../requirements/editor-vertical-split/)

### 最近打开标签 / 回顶

- **关键词**：`recent tabs` `最近打开` `scroll to top` `回顶` `pin`
- **结论**：仅 PC；发布栏下方；钉住常驻 / 未钉吸附悬停展开；右侧大纲·Lobe·钉子；Lobe 默认关。上下分屏各一份标签。窄屏无。回顶 `scrollTop > 240`。
- **定位**：`RecentDocTabs.tsx` · `recentDocTabs.ts` · `editorWorkbenchPrefs.ts` · `ScrollToTopButton.tsx` · `App.tsx`
- **需求**：[`../requirements/recent-doc-tabs/`](../requirements/recent-doc-tabs/)

### App shell / 路由

- **关键词**：`App` `DocumentTree` `开始写作` `工作空间` `react-router` `mdocs-shell` `mdocs-sidebar-list` `DocSearchOverlay` `⌘K`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/main.tsx` | 挂载 |
  | `src/web/app/App.tsx` | 主壳 / `openDocument`；悬浮层在 shell **外**；侧栏搜索 + ⌘K |
  | `src/web/app/DocSearchOverlay.tsx` | 文档搜索浮层；模式用 `MiniSelect`；窄屏两行 bar |
  | `src/web/app/MiniSelect.tsx` | 通用小下拉（搜索模式等） |
  | `src/web/app/App.css` | `.mdocs-shell` `.mdocs-sidebar` `.mdocs-sidebar-list` `.mdocs-doc-search-*` |
  | `src/web/app/hooks/useEdgeSwipeOpen.ts` | 窄屏左缘右滑开侧栏 / 左滑关 |
  | `src/web/app/DocumentTree.tsx` | 文档树根节点 = `.mdocs-sidebar-list` |
  | `src/web/app/DocumentEditor.tsx` | 编辑器容器 |
  | `src/web/app/DocChrome.tsx` | 文档顶栏（桌面+reader）；`aiWrite`/`comments`；`ChromeTip` portal |
  | `src/web/app/EditorPaneHost.tsx` | `commentsSlot` → `.mdocs-editor-with-comments` 内横排 |
  | `src/web/app/CommentsPanel.tsx` | 评论侧栏；**勿**挂到 split-pane column 外 |
- **布局约定（评论）**：`CommentsPanel` 必须是 `.mdocs-editor-with-comments` 的子节点（与 `.mdocs-editor-container` 横排）；挂在 `.mdocs-editor-split-pane`（column）下会错位。见 [`../bug-fixes/comments-slot-and-docchrome-tooltip-2026-10-27.md`](../bug-fixes/comments-slot-and-docchrome-tooltip-2026-10-27.md)
- **布局约定（顶栏 tooltip）**：`.mdocs-editor-header-scroll` 有 `overflow-x: auto` 时，CSS `::before` tooltip 会被裁切 → 用 portal/`ChromeTip`
  | `src/web/app/HtmlEditor.tsx` | HTML 预览/编辑（sandbox iframe） |
  | `src/web/app/SheetEditor.tsx` | `.sheet` 工作簿 UI；窄屏 `readerHeaderDocked` 免盖工具栏 |
  | `src/shared/sheetDocument.ts` | workbook JSON（`sheets[]`）/ 行列与表标签 mutate |
  | `src/web/app/MergeView.tsx` | 冲突 merge；`fileType` → raw-text 管道 |
- **布局约定**：shell 只承载 layout；侧栏头尾 `flex: 0 0 auto`，仅 list `overflow-y: auto`（见 [`../bug-fixes/sidebar-tree-scroll-header-footer-2026-09-10.md`](../bug-fixes/sidebar-tree-scroll-header-footer-2026-09-10.md)）
- **需求**：同域拖拽移动见 [`../requirements/document-move/`](../requirements/document-move/)（已同意，含目录子树）；HTML 文档见 [`../requirements/html-documents/`](../requirements/html-documents/)；文章搜索浮层见 [`../requirements/search-title-index/`](../requirements/search-title-index/)

### 文章版本历史

- **关键词**：`version history` `restoreDocumentVersion` `commits` `版本历史` `LexicalDiff` `compare` `fullscreen`
- **结论**：文档信息菜单打开面板；恢复 = 旧 blob 新 commit（parent=原 head）；预览|对比双选 + 全屏；对比用 `@lobehub/editor/renderer` `LexicalDiff`（仅 md）。
- **定位**：`VersionHistoryPanel.tsx` · `restoreDocumentVersionApi` · `LexicalDiff`
- **需求**：[`../requirements/document-version-restore/`](../requirements/document-version-restore/) · [`../requirements/version-history-compare-fullscreen/`](../requirements/version-history-compare-fullscreen/)

### 设置 · 回收站 / 多 CLI Token

- **关键词**：`trash` `回收站` `restore` `cliToken` `多 Token`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/SettingsPage.tsx` | tab `trash`；CLI 启停/硬删 |
  | `src/web/app/TrashPanel.tsx` | `listDeletedDocumentsApi` / `restoreDocumentApi` |
- **需求**：[`../requirements/document-trash-ui/`](../requirements/document-trash-ui/)；[`../requirements/cli-multi-token/`](../requirements/cli-multi-token/)

### API 客户端

- **关键词**：`api` `endpoints` `ApiRequestError`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/services/client.ts` | `api` |
  | `src/web/services/endpoints.ts` | 各端点 |

### Hooks / 本地存储

- **关键词**：`useAutoSave` `useAutoPublish` `IndexedDB` `draft` `scroll` `LRU`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/hooks/useAutoSave.ts` | 自动保存 |
  | `src/web/app/hooks/useAutoPublish.ts` | 自动发布 |
  | `src/web/app/hooks/useDocScrollCache.ts` | 文档滚动位置记住/恢复 |
  | `src/web/storage/drafts.ts` | `saveDraft` / `getDraft` / `subscribeDraftPresence`；`contentKind` lexical\|html |
  | `src/web/storage/docScrollCache.ts` | 进程内 LRU（最多 10 篇），刷新/重启即丢；`DocumentEditor` / `SheetEditor` |

### 异步卸载保护（可复用）

- **关键词**：`mountedRef` `expectedDocIdRef` `unmount guard`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/App.tsx` | openDocument 竞态守卫 |
- **记录**：[`../bug-fixes/async-unmount-guard-pattern-2026-05-11.md`](../bug-fixes/async-unmount-guard-pattern-2026-05-11.md)、[`open-document-race-condition-2026-05-10.md`](../bug-fixes/open-document-race-condition-2026-05-10.md)

### i18n / 设置

- **关键词**：`i18n` `SettingsPage` `localStorage` `mdocs.` `MCP` `McpServersPanel` `Memorix` `PluginMarketplacePanel` `插件市场` `PipelineOrchestrator` `流水线编排`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/i18n/` | `en.ts` / `zh.ts` |
  | `src/web/app/SettingsPage.tsx` | 设置页 |
  | `src/web/app/McpServersPanel.tsx` | MCP 服务器（独立 Tab，通用配置） |
  | `src/web/app/PluginMarketplacePanel.tsx` | 插件市场（已安装/可安装/新建 + 详情） |
  | `src/web/app/plugins/PipelineOrchestrator.tsx` | 可视化步骤 + Probe + YAML 双视图 |
  | `src/web/app/plugins/PipelineInstallRunner.tsx` | 按步安装执行窗 |
  | `src/web/app/plugins/AiPipelinePanel.tsx` | 内嵌 AI 草稿 |
  | `src/web/app/plugins/pluginMeta.ts` | 展示 helper |
  | `src/web/app/plugins/plugins.css` | 插件市场/编排器样式 |
  | `src/web/app/pipeline/pipelineAst.ts` | YAML ⇄ AST（可视化/YAML 共用） |
- **需求**：[`../requirements/agent-mcp-client/`](../requirements/agent-mcp-client/)、[`../requirements/plugin-marketplace/`](../requirements/plugin-marketplace/)、[`../requirements/plugin-pipeline/设计契约-编排器UI-v2.md`](../requirements/plugin-pipeline/设计契约-编排器UI-v2.md)

### 知识图谱（分层展示）

- **关键词**：`GraphPage` `contains` `globalDepth` `展开一级` `可见子图`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/GraphPage.tsx` | `GraphPage` |
  | `src/web/app/graph-layered-view.ts` | `buildContainsHierarchy` / `computeVisibleIds` |
- **需求**：[`../requirements/knowledge-graph/设计契约-layered-view.md`](../requirements/knowledge-graph/设计契约-layered-view.md)

### 知识图谱（工具栏 / 手机端收纳）

- **关键词**：`graph-toolbar` `层级控制` `视图` `退出图谱` `graph-mobile-actions` `三点菜单` `graph-desktop-actions`
- **结论**：左「标题+退出图谱(红实心)」，右「层级控制/视图/配置AI/重新生成」；手机端右侧全收进 ⋯ 竖排卡片。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/GraphPage.tsx` | `showDepthMenu` / `showViewMenu` / `showMobileActions` / `mobileActionsRef` |
  | `src/web/app/GraphPage.tsx` | `setToolbarDepth` / `onClose` |
  | `src/web/app/GraphPage.css` | `.graph-toolbar-left` / `.graph-toolbar-right` / `.graph-desktop-actions` / `.graph-mobile-toggle-wrap` / `.graph-mobile-actions` / `.graph-btn-danger` / `.graph-dropdown*` |
- **注意**：`.graph-desktop-actions` 与 `.graph-mobile-toggle-wrap` **成对显隐**（基础样式给桌面默认，`max-width:768px` 内互换）；只在单侧写规则会导致两端同时显示。
- **已删除**：`.graph-title` / `.graph-actions` / `.graph-toggle` / `.graph-depth-btns` / `.graph-btn-active` / `.graph-btn-close`
  （`.graph-title-text` 是**在用**的标题 span，别与已删的 `.graph-title` 混淆）
- **需求**：[`../requirements/knowledge-graph/设计契约.md`](../requirements/knowledge-graph/设计契约.md)

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

### 智能助手按块提案（DiffHunk）

- **关键词**：`md_format_lexical` `get_document_lexical_lines` `set_document_lexical_lines` `update_slot` `insert_after_slot` `remove_slot` `batch_update_slots` `overwrite_all` `lexical_lines_set` `diff_slot_op` `MdocsDiffPlugin` `ReactDiffPlugin` `updateSlot` `insertAfterSlot` `removeSlot` `overwriteAll` `assertCanPublish` `Accept` `Reject` `nodesEqual` `plainTextOf` `computeLexicalDiffRows`
- **结论**：帮写不动；normal 助手试点；提案不写盘；单槽走 `diff_slot_op` → Lobe slot API；多段连续不相交区间走 `batch_update_slots`（span 替换合成 MD → 一次 `overwriteAll`）；多门牌/旧协议走 `lexical_lines_set` → `proposalToMarkdown` → `overwriteAll`。`overwriteAll` 双源 JSON（编辑器 toJSON vs MD 再解析）用 canonicalize + 同类型纯文本 equal，避免假 Diff；同 hunk 红绿贴紧、异 hunk 留距。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/shared/batchSlotRanges.ts` | `validateBatchSlotRanges` `applyBatchSlotRangesToBlocks` |
  | `src/server/agent/Agent/tools-lexical-lines.ts` | `update_slot` `insert_after_slot` `remove_slot` `batch_update_slots` `overwrite_all` |
  | `src/web/app/DocumentEditor.tsx` | `MdocsDiffPlugin` `applyAgentDiffRef` `assertCanPublish` |
  | `src/web/app/lexical-lines/MdocsDiffPlugin.tsx` | 底部 Diff dock（写入短暂显示 / 悬停浮现） |
  | `src/web/app/lexical-lines/agentDiff.ts` | `ApplyAgentDiffOp` |
  | `src/web/app/lexical-lines/batchSlotRangesApply.ts` | `batchRangesToProposedMarkdown` |
  | `src/web/app/lexical-lines/proposalToMarkdown.ts` | `proposalToMarkdown` |
  | `src/web/app/App.tsx` | `handleLexicalLinesSet` `handleDiffSlotOp` |
  | `src/web/app/playground/PlaygroundEditor.tsx` | Diff 试玩按钮 |
  | `my-lobe-editor/src/renderer/diff/compute.ts` | `computeLexicalDiffRows` `nodesEqual` |
  | `my-lobe-editor/src/plugins/diff/api.ts` | `overwriteAll` |
  | `my-lobe-editor/src/plugins/diff/react/style.ts` | `diffHunkTheme` |
- **决策 / 修复**：[`../decisions/015-overwrite-all-diff-equality.md`](../decisions/015-overwrite-all-diff-equality.md) · [`../bug-fixes/overwrite-all-false-diff-hunks-2026-10-28.md`](../bug-fixes/overwrite-all-false-diff-hunks-2026-10-28.md)
- **需求**：[`../requirements/agent-lexical-lines-diff/`](../requirements/agent-lexical-lines-diff/)

### Agent 选择卡吸底

- **关键词**：`choice_card` `skill_form_card` `interaction-dock` `等待你选择`
- **结论**：`status=open` 的选择卡 / Skill 表单提到输入框上方 `.mdocs-agent-interaction-dock`；出卡时 `forceScrollToBottom`；时间线只留「已置顶」提示。超时 120s。
- **定位**：`src/web/app/AgentChatPanel.tsx` · `collectOpenInteractions` / `forceScrollToBottom`

### Agent PC 贴左

- **关键词**：`agentDocked` `mdocs-agent-dock` `mdocs-tree-rail` `agentTreeRailOpen` `贴左` `浮窗` `挤占目录`
- **结论**：仅 PC；贴左时左列助手、中间正文、右侧 `.mdocs-tree-rail` 纯目录；浮窗时目录回左完整侧栏；右缘拖宽；贴左开文不关面板。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/App.tsx` | `agentDockLayout` `renderSidebarDocumentTree` |
  | `src/web/app/AgentFab.tsx` | `loadAgentDocked` / `clampAgentDockWidth` |
  | `src/web/app/AgentChatPanel.tsx` | `docked` / `onToggleDock` |
  | `src/web/app/App.css` | `.mdocs-tree-rail` |
- **需求**：[`../requirements/agent-dock-left/`](../requirements/agent-dock-left/)

### 冲突 Merge（inline）

- **关键词**：`MergeView` `MergeInlinePane` `接收` `拒绝` `全部用我的` `三路 diff` `AI 合并` `合并说明`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/MergeView.tsx` | `MergeView` `runAiMerge` |
  | `src/web/app/merge/MergeInlinePane.tsx` | `MergeInlinePane` |
  | `src/web/app/merge/merge-plan.ts` | `buildThreeWayMergePlan` |
  | `src/web/app/merge/merge-marked-text.ts` | `serializeMergeMarkedText` |
  | `src/shared/file-type-policy.ts` | `canAiMerge` |
- **需求**：[`../requirements/merge-inline-ui/`](../requirements/merge-inline-ui/) · [`../requirements/ai-merge/`](../requirements/ai-merge/) · merge-message 见 [`../requirements/publish-commit-message/`](../requirements/publish-commit-message/)

### UI 视觉体系（选中态 / 层级 / 控件声量）

- **关键词**：`视觉` `选中态` `指示条` `z-index` `弹框被遮` `ghost` `分段控制器` `空白状态`
- **结论**：选中用浅灰底+绿指示条（不用色块边框）；侧边栏 `#fafafa` / 内容区 `#fff`；**弹框 `z-index: 200`**（原 40，被手机侧边栏抽屉 50 遮住）；次要按钮用 `ghost`。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/App.css` | `.mdocs-tree-row.active` / `.mdocs-sidebar` / `.mdocs-main` / `.mdocs-dialog-backdrop` / `.mdocs-welcome-icon` |
  | `src/web/app/DocChrome.tsx` | 收藏 / 评论按钮 `className="ghost ..."` |
  | `src/web/app/App.tsx` | `.mdocs-welcome` 空白状态 + `Code2` |
  | `src/web/styles/global.css` | `:root` 色板（本需求**不改**）、`button.primary/.secondary/.ghost/.danger` |
- **层级序**（低→高）：工具栏 30 → 手机 nav scrim 45 → **侧边栏抽屉 50** → 文档信息下拉 100 → **弹框 backdrop 200** → agent 面板 201 → AI 帮写 1200 → Mermaid 12000
- **需求**：[`../requirements/ui-visual-system/设计契约.md`](../requirements/ui-visual-system/设计契约.md)

### 登录 / 注册弹框

- **关键词**：`VisitorRegisterDialog` `登录优先` `没有账号` `已有账号` `needsRegister` `注册两步`
- **结论**：**默认登录**；底部「没有账号？点击注册」；注册两步内含「已有账号？点击登录」可回。已无 Tab。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/VisitorRegisterDialog.tsx` | `page: "login" \| "register" \| "register-password"` / `switchToLogin` / `switchToRegister` / `loginMode` |
  | `src/web/app/App.tsx` | `phase === "needsRegister"`（唯一挂载点）/ `handleRegister` |
- **注意**：`handleRegister` 末尾 `setPhase("ready")` 会卸载弹框，故 `submitRegister` 尾部"切回登录+预填"**不可达**（注册即登录）。
- **需求**：[`../requirements/login-register-dialog/设计契约.md`](../requirements/login-register-dialog/设计契约.md)

### 附件上传（类型政策）

- **关键词**：`upload` `isAllowedAssetUpload` `unsupported file type` `.bin` `link-to-img` `附件`
- **结论**：**不限制文件类型**（恒 `true`）；无扩展名存 `.bin`；单文件上限 `MDOCS_MAX_UPLOAD_BYTES`（默认 100MiB）× 24；下载侧 `Content-Type` 走白名单，未登记一律 `application/octet-stream`，故放开上传≠可执行内联。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/routes/assets.routes.ts` | `isAllowedAssetUpload`（恒 true）/ `createUploader` / `CONTENT_TYPE_BY_EXT` / `serveAssetFile` |
  | `src/web/app/DocumentEditor.tsx` | `ReactFilePlugin.handleUpload` → `uploadAssetApi` |
  | `src/web/services/endpoints.ts` | `uploadAssetApi` |
- **决策**：[`../decisions/013-asset-upload-no-type-restriction.md`](../decisions/013-asset-upload-no-type-restriction.md)（取代 `bug-fixes/asset-upload-unsupported-file-type-2026-07-31.md` 的白名单思路）

### Android WebView 壳

- **关键词**：`apk` `WebView` `SetupActivity` `server url` `systemGestureExclusionRects` `edge swipe`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `android/` | Gradle 工程（与 pnpm 打包隔离） |
  | `android/app/.../Prefs.kt` | `Prefs` `normalizeServerUrl` |
  | `android/app/.../MainActivity.kt` | `MainActivity` `updateSystemGestureExclusion` |
  | `src/web/app/hooks/useEdgeSwipeOpen.ts` | Web 侧开/关抽屉手势 |
- **决策**：[`../decisions/014-mobile-edge-swipe-vs-system-back.md`](../decisions/014-mobile-edge-swipe-vs-system-back.md)（系统返回抢边；汉堡为可靠入口）
- **需求**：[`../requirements/android-webview-shell/`](../requirements/android-webview-shell/)

### 桌面 WebView 壳

- **关键词**：`tauri` `desktop` `WKWebView` `WebView2` `server url`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `desktop/` | Tauri 2 工程（与 pnpm 打包隔离） |
  | `desktop/src-tauri/src/url_util.rs` | `normalize_server_url` `clipboard_doc_target` |
  | `desktop/src-tauri/src/lib.rs` | `run` |
- **需求**：[`../requirements/desktop-webview-shell/`](../requirements/desktop-webview-shell/)

