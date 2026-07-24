# 前端结构

> 本文回答：mdocs 前端如何组织、核心组件职责、路由、状态管理、与后端的交互方式。

## 技术栈

| 层 | 技术 |
|----|------|
| 构建工具 | Vite |
| 框架 | React 19 + TypeScript |
| 路由 | `react-router-dom` (BrowserRouter) |
| UI 库 | `@lobehub/ui` + Ant Design (`antd` / `antd-style`) |
| 动画 | `motion` (Framer Motion) |
| 编辑器 | `@lobehub/editor`（基于 Lexical） |
| 图标 | `lucide-react` |
| 国际化 | 自定义 I18nProvider |

## 入口与路由

- **挂载点**：`src/web/main.tsx`
- **路由定义**：`src/web/app/Router.tsx`
- **根组件**：`src/web/app/App.tsx`

### 路由结构

```
/                    ← 主应用：DocumentTree + DocumentEditor
/domains             ← 域管理面板（DomainManagementPanel）
/settings            ← 设置页（SettingsPage）
/drafts              ← 草稿列表（DraftListPage）
```

> 注：具体路由定义以 `Router.tsx` 为准。

## 核心组件

| 组件 | 文件 | 职责 |
|------|------|------|
| `App` | `src/web/app/App.tsx` | 全局布局：侧边栏树 + 主编辑区 + 工具栏 |
| `DocumentTree` | `src/web/app/DocumentTree.tsx` | 左侧文档树：展示/折叠/选中/右键菜单 |
| `DocumentEditor` | `src/web/app/DocumentEditor.tsx` | 右侧编辑器：基于 LobeHub Editor（Lexical） |
| `Toolbar` | `src/web/app/Toolbar.tsx` | 顶部工具栏：保存、权限设置、域切换等 |
| `DomainManagementPanel` | `src/web/app/DomainManagementPanel.tsx` | 域管理：创建/重命名/删除域、成员管理 |
| `MemberTemplatesPanel` | `src/web/app/MemberTemplatesPanel.tsx` | 成员模板管理 |
| `VisitorPickerModal` | `src/web/app/VisitorPickerModal.tsx` | 访客选择弹窗（邀请/添加成员） |
| `VisitorRegisterDialog` | `src/web/app/VisitorRegisterDialog.tsx` | 首次访问的昵称输入弹窗 |
| `ConflictNotice` | `src/web/app/ConflictNotice.tsx` | 保存冲突提示 |
| `MergeView` | `src/web/app/MergeView.tsx` | 409 / diverged 时行级 merge（CodeMirror 三栏） |
| `ConflictModal` | `src/web/app/ConflictModal.tsx` | 冲突入口弹窗 |
| `ConfirmDialog` | `src/web/app/ConfirmDialog.tsx` | 通用确认弹窗（标题、消息、取消/确认按钮、busy 状态） |
| `MessageDialog` | `src/web/app/MessageDialog.tsx` | 通用消息弹窗（标题、消息、「知道了」按钮） |

## 状态管理

- **无全局状态库**：使用 React 原生 `useState` / `useReducer` + Context。
- **关键状态**（`App.tsx`）：
  - `activeDocMeta`：当前打开文档的服务端 meta（`ActiveDocumentMeta`，不含正文），见 [active-doc-meta-and-draft-model.md](./active-doc-meta-and-draft-model.md)
  - `editorContent` + `contentRevision`：正文载入编辑器；`contentRevision` 在 pull/publish 后递增以触发 `setDocument`（非 commitId）
  - `editorDraftExists`：是否有未发布 IndexedDB 草稿（有草稿时不做 sync-status 轮询）
  - 文档树、域、访客等同屏状态
- **串行队列**：`documentTaskQueue.ts` — 按 `documentId` 串行 auto save / publish
- **编辑器**：`DocumentEditor` 接收 `meta` + `initialContent`，内部 Lexical 状态；auto save 见 `hooks/useAutoSave.ts`

## API 交互

### 客户端封装

- **底层**：`src/web/services/client.ts`
  - 封装 `fetch`，统一注入 `x-visitor-token`。
  - 统一处理 `{ data, error }` 响应格式。
  - 定义 `ApiRequestError`（含 `status`, `code`, `message`）。
- **业务层**：`src/web/services/endpoints.ts`
  - 按领域导出函数：`registerVisitorApi`, `fetchTreeApi`, `createDocumentApi`, `uploadAssetApi` 等。
  - 类型从 `src/shared/types/` 导入。

### 特殊：文件上传

- `uploadAssetApi` 不使用 `client.ts` 的封装，直接使用 `fetch` + `FormData`。
- 原因：`FormData` 不能带 `Content-Type: application/json`。
- 手动读取 `localStorage` 中的 token 并设置 `x-visitor-token` header。

## 编辑器细节

- 基于 `@lobehub/editor`（Lexical 封装）。
- 支持 Markdown 渲染和编辑。
- Meta2d 图表： fenced `` ```meta2 `` 块内嵌 JSON，通过 Meta2d + canvas2svg 渲染为 SVG。
- 图表编辑：双击或工具栏插入，弹窗修改后通过 `window.vditorInstance?.setValue()` 回写。

## 样式

- **全局样式**：`src/web/styles/global.css`
- **组件级样式**：部分组件使用 `.css` 文件（如 `App.css`, `domain.css`），与组件同名。
- **主题**：通过 `@lobehub/ui` 的 `ThemeProvider` 管理。

## 构建产物

- `pnpm build:web` → `dist/web/`
- 生产环境由 Express `express.static(cfg.webDistDir)` 托管。
