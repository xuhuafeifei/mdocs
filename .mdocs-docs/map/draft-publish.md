# map — draft / publish / commit

人读长文：[`../archive/active-doc-meta-and-draft-model.md`](../archive/active-doc-meta-and-draft-model.md)、[`commit-naming-and-merge-base.md`](../archive/commit-naming-and-merge-base.md)  
需求：[`../requirements/auto-save-draft/`](../requirements/auto-save-draft/)、[`draft-copy-preview/`](../requirements/draft-copy-preview/)、[`draft-publish-recovery/`](../requirements/draft-publish-recovery/)

### activeDocMeta

- **关键词**：`activeDocMeta` `ActiveDocMeta` `打开文档`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/shared/types/document.ts` | `ActiveDocMeta` 等类型 |
  | `src/web/app/App.tsx` | 打开 / 发布状态 |

### 本地草稿

- **关键词**：`saveDraft` `IndexedDB` `useAutoSave`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/web/storage/drafts.ts` | 草稿 CRUD |
  | `src/web/app/hooks/useAutoSave.ts` | 防抖保存 |
  | `src/web/app/hooks/useAutoPublish.ts` | 自动发布 |
  | `src/web/app/hooks/usePublishGuard.ts` | 发布冲突 |

### Commit / merge-base

- **关键词**：`commit` `merge-base` `fork` `commit-graph`
- **定位**：
  | 路径 | 符号 |
  |------|------|
  | `src/server/documents/commit-graph.ts` | commit 图 / 命名 |
