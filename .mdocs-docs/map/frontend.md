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

### 冲突 Merge（inline）

- **关键词**：`MergeView` `MergeInlinePane` `接收` `拒绝` `全部用我的` `三路 diff`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/app/MergeView.tsx` | `MergeView` |
  | `src/web/app/merge/MergeInlinePane.tsx` | `MergeInlinePane` |
  | `src/web/app/merge/merge-plan.ts` | `buildThreeWayMergePlan` |
- **需求**：[`../requirements/merge-inline-ui/`](../requirements/merge-inline-ui/)

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
- **结论**：**不限制文件类型**（恒 `true`）；无扩展名存 `.bin`；55MB × 24；下载侧 `Content-Type` 走白名单，未登记一律 `application/octet-stream`，故放开上传≠可执行内联。
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/routes/assets.routes.ts` | `isAllowedAssetUpload`（恒 true）/ `createUploader` / `CONTENT_TYPE_BY_EXT` / `serveAssetFile` |
  | `src/web/app/DocumentEditor.tsx` | `ReactFilePlugin.handleUpload` → `uploadAssetApi` |
  | `src/web/services/endpoints.ts` | `uploadAssetApi` |
- **决策**：[`../decisions/013-asset-upload-no-type-restriction.md`](../decisions/013-asset-upload-no-type-restriction.md)（取代 `bug-fixes/asset-upload-unsupported-file-type-2026-07-31.md` 的白名单思路）

### Android WebView 壳

- **关键词**：`apk` `WebView` `SetupActivity` `server url`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `android/` | Gradle 工程（与 pnpm 打包隔离） |
  | `android/app/.../Prefs.kt` | `Prefs` `normalizeServerUrl` |
  | `android/app/.../MainActivity.kt` | `MainActivity` |
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

