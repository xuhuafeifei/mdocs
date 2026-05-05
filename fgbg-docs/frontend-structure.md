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

## 状态管理

- **无全局状态库**：使用 React 原生 `useState` / `useReducer` + Context。
- **关键状态**：
  - 当前访客：`src/web/app/hooks/useVisitor.ts`
  - 当前域/文档树：`src/web/app/hooks/useTree.ts` 或 `App.tsx` 内状态
  - 编辑器内容：`DocumentEditor.tsx` 内部管理，通过回调同步到父组件

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
