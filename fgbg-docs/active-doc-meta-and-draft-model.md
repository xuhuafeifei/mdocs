# 打开文档、草稿与 activeDocMeta 心智模型

> 本文回答：前端如何划分「当前篇 meta」「正文副本」「发布乐观锁」的职责；`activeDoc` 应演进为何种形态；打开 / 发布 / pull 的数据从哪来。

**状态**：目标模型（重构对齐用）。与 `draft-copy-model-and-preview-plan.md` 冲突时，**以本文为准**。

**相关文档**：[commit 命名与 merge-base](./commit-naming-and-merge-base.md)、[草稿副本实施清单](./draft-copy-model-and-preview-plan.md)、[前端结构](./frontend-structure.md)、[API 参考](./api-reference.md)。

---

## 1. 三层数据

| 层 | 含义 | 存放位置 | 何时更新 |
|----|------|----------|----------|
| **当前篇** | 正在编辑哪篇文章 | URL `documentId` | 路由导航 |
| **activeDocMeta** | 该篇**服务端元信息**（上次 GET 的缓存，供 UI 共享） | React（`App`） | **仅**打开、pull、publish 成功后 **GET** |
| **正文副本** | Lexical JSON、开编 commit、展示名（编辑中） | 有编辑 → **IndexedDB 草稿**；无草稿 → **编辑器内存**（来自 GET） | auto save / 打开加载 |

**目录树 `tree[]`**：`GET /api/tree`，域内结构索引；高亮当前篇用 URL 的 `documentId`，不是 `activeDocMeta` 对象。

---

## 2. activeDocMeta 的职责

### 2.1 是什么

- 当前打开文档的 **UI 共享层**：多个壳组件（工具栏、权限、删除、邀请、信息面板、Merge 标题等）共用一份 meta，避免重复请求。
- 内容来自 **服务端 GET** 的 `DocumentDetail` 中 **除正文外的字段**（实现上可专用类型，不含 `content`）。

### 2.2 建议包含

`documentId`、`domainId`、`relativePath`、`permission`、`ownerVisitorId`、`invitedEdit`、`headCommitId`、`displayName`、`createdAt`、`updatedAt` 等。

### 2.3 不包含

- 可编辑正文（Lexical JSON）
- `draft.conflict`、开编正文快照（如 `localBaseSnapshotContent`，目标态可删除）
- 业务过程态（不应在 meta 里维护「当前草稿正文」）

### 2.4 与业务逻辑的关系

- **不**把 meta 当作正文或草稿的存储。
- **可以**在 meta 中缓存 **`headCommitId`**（服务端上次 GET 结果）：无草稿时发布乐观锁用；有草稿时发布用 **`draft.localBaseCommitId`**，不用 meta 里的 head 当锁基准。
- 业务数据：**正文 / 开编 commit** → 草稿 + 编辑器；**服务端权威** → `GET` / `PUT`；meta 只是 GET 结果在 UI 层的投影。

### 2.5 命名

目标态将现有 `App` 中的 `activeDoc`（`DocumentDetail` 全量）拆为 **`activeDocMeta`**，避免与「整篇文章含正文」混淆。

---

## 3. 打开文档

```text
GET /api/documents/:id → 写入 activeDocMeta（始终执行）

存在未发布草稿？
  是 → 编辑器 ← draft.content / draft.displayName（本地与远端正文互斥，不 merge 进 meta）
  否 → 编辑器 ← GET 返回的正文
```

- **本地 vs 服务端正文**：互斥加载，禁止「先 GET 再把草稿 content 写入 activeDoc.content」的双写。
- **meta**：始终来自本次 GET（权限、当前 head 等）；草稿内首次抄写的 meta 字段不反向覆盖 activeDocMeta 的权限/head（草稿仅保留开编 commit 等副本字段）。

**入口代码（待对齐）**：`src/web/app/App.tsx` → `openDocument`。

---

## 4. IndexedDB 草稿

### 4.1 角色

未发布编辑的 **业务副本**：本地持久化 + auto save；服务端动作（发布、权限、删除、merge）由 API 裁决。

### 4.2 首次创建（第一次 auto save）

- 从当时 **`activeDocMeta`**（已 GET）**一次性**写入：`localBaseCommitId`（= 当时 `headCommitId`）、`relativePath`、`permission`、`ownerVisitorId`、`domainId` 等。
- 写入正文、展示名。

### 4.3 后续 auto save

- **仅**更新：`content`、`displayName`、`updatedAt`（及必要状态位）。
- **不再**从 `activeDocMeta` 向草稿灌任何字段。

### 4.4 存储位置

`src/web/storage/drafts.ts`（`DraftRecord`）。冲突见 `draft-version.ts` 中 `conflict` / `conflictStatus`。

---

## 5. 发布

### 5.1 发布内容

始终来自 **编辑器当前序列化结果**（编辑器打开时从 draft 或 GET 加载）。不从 `activeDocMeta` 取正文。

### 5.2 乐观锁 commitId

| 情况 | `version.localBaseCommitId` |
|------|------------------------------|
| 有未发布草稿 | `draft.localBaseCommitId` |
| 无草稿 | `activeDocMeta.headCommitId`（来自打开/pull/publish 后 GET，非 UI 虚构） |

服务端校验见 `assertNoVersionConflict`（`src/server/documents/document.service.ts`）。

### 5.3 成功后（手动 / 自动发布统一）

```text
deleteDraft(documentId)
GET /api/documents/:id → setActiveDocMeta
若当前正在编辑本篇 → 编辑器 ← GET 正文（已无草稿）
```

- **无草稿也可以发布**（例如打开后未触发 auto save、或直接改完即点发布）：内容在编辑器，commit 用 meta 中的 head。
- **无修改**：可禁用发布按钮（`!dirty && !draft`），不必作为 API 错误。

### 5.4 Merge 发布

仍走 `version.merge`；成功后同样删草稿 + GET 更新 meta。Merge UI 数据流见 [commit-naming-and-merge-base.md](./commit-naming-and-merge-base.md)。

---

## 6. Pull

- **无未发布草稿**时：GET → 更新 `activeDocMeta` + 编辑器载入服务端正文。
- **有草稿**时：不覆盖式 pull 正文（本地副本优先）；meta 是否刷新由产品决定，默认仍可在打开时 GET meta 用于权限展示。

---

## 7. 并发与 auto publish（建议）

- 按 `documentId` **串行队列**（save / publish 入队），避免 publish 飞行中 auto save 导致草稿 `localBaseCommitId` 滞后。
- publish 任务**执行时**再 `getDraft`，不锁死入队时的快照。
- **不做** save 合并（coalesce）、**不做** 409 正文一致时的自动自愈（除非另开 ADR）。

**已知问题**：当前 `publishDraftFromList` 未在成功后更新 meta / 未强制删草稿，会导致 solo 场景误报 `VERSION_CONFLICT`；对齐时应按 §5.3 收尾。

---

## 8. Merge 界面（只读对齐）

| 区域 | 数据来源 |
|------|----------|
| 左（local） | `draft.conflict.localSnapshotContent`（进冲突时冻结的草稿正文，非 commit 节点） |
| 右（remote） | 打开 Merge 时 `GET` 当前文档 `content` |
| 中（结果） | 三路/两方 diff；祖先正文优先 `GET merge-context` |

本地编辑期**没有** `localCommitId`；merge 发布成功后服务端才写入 `r_local` 等节点。命名见 [commit-naming-and-merge-base.md](./commit-naming-and-merge-base.md)。

---

## 9. 目标态 vs 当前实现（差距摘要）

| 项 | 目标态 | 当前实现（约） |
|----|--------|----------------|
| 打开正文 | 草稿 **或** GET，互斥 | GET 后常把草稿写入 `activeDoc.content` |
| 共享状态 | `activeDocMeta` 无 `content` | `activeDoc` = 完整 `DocumentDetail` |
| 发布后 | 删草稿 + GET 更新 meta | auto publish 可能不更新 head、条件删草稿 |
| 开编基准 | 仅首次写入草稿 | 草稿内 frozen，但 auto publish 后易与服务端 head 脱节 |
| `syncLocalBaseCommitId` | 删除 | 仍存在，与 `activeDoc` / 草稿并行 |
| 事件总线 | 不需要，显式 `refreshDocMeta` | 无 |

重构时以 §1–§7 为验收标准。

---

## 10. 一句话

- **activeDocMeta** = 当前篇 **服务端 meta 的 UI 缓存**（GET 刷新）。
- **正文与开编 commit** = **草稿 + 编辑器**；无草稿时用 **GET 正文 + meta.head** 发布。
- **publish 成功后** = **删草稿 + 再 GET**，客户端与服务端对齐。
