# map — frontend

人读长文：[`../archive/frontend-structure.md`](../archive/frontend-structure.md)

### App shell / 路由

- **关键词**：`App` `DocumentTree` `DocumentEditor` `react-router`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/main.tsx` | 挂载 |
  | `src/web/app/App.tsx` | 主壳 / `openDocument` |
  | `src/web/app/DocumentTree.tsx` | 文档树（拟增 DnD move） |
  | `src/web/app/DocumentEditor.tsx` | 编辑器容器 |
- **需求**：同域拖拽移动见 [`../requirements/document-move/`](../requirements/document-move/)（已同意）

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
  | `src/web/storage/drafts.ts` | `saveDraft` / `getDraft` |

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
