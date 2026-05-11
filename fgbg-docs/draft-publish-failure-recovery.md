# 草稿发布失败恢复机制

> 本文回答：草稿自动发布失败时的错误处理、用户手动恢复流程。

## 背景

用户关闭自动发布一段时间后重新打开，或文档被删除后 IndexedDB 中仍有草稿，auto-publish 扫描时会尝试 `PUT /api/documents/:id` 返回 404。此前 catch 只 `console.log`，导致每 10 秒循环报错。

## 解决方案

### 1. 草稿发布失败标记（IndexedDB）

**文件**：`src/web/storage/drafts.ts`

- `DraftRecord` 新增字段：
  - `publishError?: string` — 失败原因（如 `"DOC_NOT_FOUND"`）
  - `publishErrorAt?: number` — 失败时间戳
- `markDraftPublishError(docId, error)` — 标记草稿为发布失败
- `clearDraftPublishError(docId)` — 清除失败标记
- `listAllDrafts({ skipFailed })` — auto-publish 用 `skipFailed: true` 跳过已标记失败的草稿

### 2. 自动发布捕获 404

**文件**：`src/web/app/hooks/useAutoPublish.ts`、`src/web/app/App.tsx`

- `useAutoPublish` 扫描时用 `listAllDrafts({ skipFailed: true })`
- `publishDraftFromList` catch 404 时调用 `markDraftPublishError`，Toast 提示用户，之后不再重复扫描

### 3. 草稿列表页展示失败状态 + 另存为新文档

**文件**：`src/web/app/DraftListPage.tsx`

- 失败草稿显示红色错误提示（时间 + 失败原因）
- 失败草稿的按钮从"发布"变为"另存为新文档"
- 点击后打开 `RecoveryDialog`，成功后清除 IndexedDB 草稿并通知父组件刷新树

### 4. 草稿恢复弹窗

**文件**：`src/web/app/RecoveryDialog.tsx`（新组件）

- 复用 `DomainSelect`（已有组件）选域
- 复用 `DocumentTree`（已有组件）选父目录（只读，点击选中）
- 文件名输入框预填草稿名
- 提交时调用 `createDocumentApi`（POST）作为全新文档创建
- 成功后关闭弹窗，父组件清除草稿 + 刷新树

### 5. 错误消息透传

**文件**：`src/web/app/utils.ts`

- `translateError` 对 `ApiRequestError` 直接返回后端消息，不再用 `ERROR_CODE_MAP` 通用翻译覆盖（后端消息已包含详细信息如"目录下有 X 篇文档不属于你"）

### 6. 样式

**文件**：`src/web/app/App.css`

- `.mdocs-drawer-item-failed` — 失败草稿淡红背景
- `.mdocs-drawer-item-error` — 红色错误文字
- `.mdocs-recovery-dialog` / `.mdocs-recovery-tree` — 恢复弹窗样式

### 7. i18n

**文件**：`src/web/i18n/types.ts`、`locales/zh.ts`、`locales/en.ts`

| Key | zh | en |
|-----|----|----|
| `draftPublishFailedNotice` | 草稿「{name}」发布失败：文档不存在 | Draft "{name}" publish failed: document not found |
| `recoverDraft` | 另存为新文档 | Save As New Document |
| `recoverDraftDesc` | 将「{name}」的草稿内容保存为一篇全新文档 | Save the draft of "{name}" as a brand new document |
| `recoverTargetFolder` | 目标目录 | Target Folder |

## 流程图

```
auto-publish 扫描草稿
  → PUT /api/documents/:id
    → 200 OK → 删除草稿，发布完成
    → 404 Not Found → markDraftPublishError → Toast 提示 → 后续扫描跳过
  → 用户打开草稿列表页 → 失败草稿显示"另存为新文档"
    → 点击 → RecoveryDialog（选域 + 选目录 + 填文件名）
      → POST /api/documents → 成功 → 清除草稿 + 刷新树
```

## 涉及文件清单

| 文件 | 改动 |
|------|------|
| `src/web/storage/drafts.ts` | IndexedDB 新增 publishError 字段 + 标记/清除函数 + skipFailed 选项 |
| `src/web/app/hooks/useAutoPublish.ts` | listAllDrafts({ skipFailed: true }) |
| `src/web/app/App.tsx` | publishDraftFromList 捕获 404 标记草稿 + SettingsPage 透传 onRecoverDraft |
| `src/web/app/utils.ts` | translateError 直接返回后端消息 |
| `src/web/app/DraftListPage.tsx` | 失败草稿展示 + RecoveryDialog 集成 |
| `src/web/app/RecoveryDialog.tsx` | **新组件**：域选择 + 目录树 + 文件名输入 → POST 新文档 |
| `src/web/app/SettingsPage.tsx` | 透传 onRecoverDraft |
| `src/web/app/App.css` | 失败草稿样式 + 恢复弹窗样式 |
| `src/web/i18n/types.ts` | 新增 4 个 TranslationKey |
| `src/web/i18n/locales/zh.ts` | 中文翻译 |
| `src/web/i18n/locales/en.ts` | 英文翻译 |
