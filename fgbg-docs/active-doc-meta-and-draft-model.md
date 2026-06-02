# 打开文档、草稿与 activeDocMeta 心智模型

> 本文回答：前端如何划分「当前篇 meta」「正文副本」「发布乐观锁」的职责；实现入口与数据从哪来。

**状态**：已与 `src/web/app` 实现对齐（2026-06）。

**相关文档**：[commit 命名与 merge-base](./commit-naming-and-merge-base.md)、[草稿副本实施清单](./draft-copy-model-and-preview-plan.md)、[前端结构](./frontend-structure.md)、[API 参考](./api-reference.md)。

---

## 1. 三层数据

| 层 | 含义 | 存放位置 | 何时更新 |
|----|------|----------|----------|
| **当前篇** | 正在编辑哪篇文章 | URL `documentId` | 路由导航 |
| **activeDocMeta** | 该篇**服务端元信息**（上次 GET 的缓存，供 UI 共享） | React（`App`） | 打开、pull、publish 成功后 **GET** |
| **正文副本** | Lexical JSON、开编 commit、展示名（编辑中） | 有编辑 → **IndexedDB 草稿**；无草稿 → **编辑器**（来自 GET） | auto save / 打开加载 |

**目录树 `tree[]`**：`GET /api/tree`；侧栏高亮用 URL 的 `documentId`。

---

## 2. activeDocMeta 的职责

### 2.1 是什么

- 当前打开文档的 **UI 共享层**（权限、路径、owner、标题展示、`headCommitId` 等）。
- 类型：`ActiveDocumentMeta`（`DocumentDetail` 去掉 `content` / `contentHash`），见 `src/shared/types/document.ts`。
- 转换：`documentDetailToMeta()`（`src/web/app/documentMeta.ts`）。

### 2.2 不包含

- 可编辑正文（由 `editorContent` state + 编辑器承载，不写入 meta）。
- 冲突快照（`draft.conflict`，见 `draft-version.ts`）。

### 2.3 与业务逻辑

- 发布正文：编辑器序列化，不经 meta。
- 发布 commit：有草稿 → `draft.localBaseCommitId`；无草稿 → `activeDocMeta.headCommitId`。
- 有未发布草稿时 **不** 做 sync-status 后台轮询（避免开编基准与 head 比较产生噪声）。

---

## 3. 打开文档

```text
GET → activeDocMeta

有未发布草稿？
  是 → loadEditorFromDraft（正文/标题来自 IndexedDB）
  否 → loadEditorFromServer（正文来自 GET）
```

**入口**：`App.openDocument`（`src/web/app/App.tsx`）。

---

## 4. IndexedDB 草稿

| 时机 | 行为 |
|------|------|
| 首次 auto save | 从 `activeDocMeta` 一次性写入 `localBaseCommitId`、path、permission 等 + 正文 |
| 后续 auto save | 仅 `content`、`displayName`、`updatedAt` |

**存储**：`src/web/storage/drafts.ts`。

---

## 5. 发布

### 5.1 成功后（手动 / 自动统一）

`finalizeAfterPublish`（`App.tsx`）：

```text
deleteDraft
GET → setActiveDocMeta
若仍打开本篇 → loadEditorFromServer（editorContent + contentRevision++）
```

`contentRevision` 是前端计数器，仅用于触发 `editor.setDocument` **原地换字**；与 commitId 无关。编辑器 `key` 仅用 `documentId`，避免发布后整页 remount 闪烁。

### 5.2 乐观锁

见 [commit-naming-and-merge-base.md](./commit-naming-and-merge-base.md)。发布走 `getDocumentTaskQueue(documentId)` 串行，与 auto save 同队列。

---

## 6. Pull

无未发布草稿：`executePullRemote` → GET → 更新 meta + `loadEditorFromServer`。

有草稿：不覆盖式 pull 正文。

---

## 7. Merge UI（摘要）

| 区域 | 数据 |
|------|------|
| 左 | `draft.conflict.localSnapshotContent`（进冲突时冻结） |
| 右 | 打开时 `GET` 当前正文 |
| 祖先 | `GET .../merge-context`（LCA 正文） |

详见 [commit-naming-and-merge-base.md](./commit-naming-and-merge-base.md)。

---

## 8. 关键文件

| 文件 | 职责 |
|------|------|
| `App.tsx` | `activeDocMeta`、`editorContent`、`contentRevision`、`openDocument`、`finalizeAfterPublish` |
| `DocumentEditor.tsx` | `meta` + `initialContent` + `contentRevision` |
| `documentTaskQueue.ts` | 每文档 save/publish 串行 |
| `documentMeta.ts` | `DocumentDetail` → `ActiveDocumentMeta` |
| `drafts.ts` | IndexedDB 草稿 |
| `useDocumentVersion.ts` | 无草稿时 sync-status 轮询 |

---

## 9. 一句话

- **activeDocMeta** = 当前篇服务端 meta 的 UI 缓存。
- **正文与开编 commit** = 草稿 + 编辑器；无草稿用 GET 正文 + meta.head 发布。
- **publish 成功后** = 删草稿 + 再 GET，对齐服务端。
