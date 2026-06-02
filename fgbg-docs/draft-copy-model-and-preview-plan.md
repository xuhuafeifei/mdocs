# 草稿副本模型与轻量预览方案（实施清单）

> **心智模型以 [`active-doc-meta-and-draft-model.md`](./active-doc-meta-and-draft-model.md) 为准**；本文为实施清单与历史讨论，冲突时服从该文。

> 目标：把“未发布草稿”收敛为清晰的一套模型，降低 Sync / Pull / Merge 的心智复杂度，并补一个低成本预览入口。

## 一、已对齐的产品规则

### 1) 草稿的角色（本地能力）

- 草稿只负责：本地持久化 + 自动保存。
- 草稿存在时，用户可在本地自由编辑这份副本（working copy）。
- 任何会影响服务端的动作（发布、改权限、删除、邀请、合并）都由后端最终裁决。

### 2) 有草稿与无草稿两种模式

- **无草稿**：以服务端为唯一真相，可做 Pull，同步判断也看服务端当前版本。
- **有草稿**：以本地副本为编辑真相；这期先不做后台 Sync 轮询增强，避免复杂度继续上升。

### 3) 草稿创建与更新时机

- **首次编辑时**才创建草稿（不是打开文档时）。
- 首次落盘为**全量副本**（正文 + 所有 meta + commit 信息）。
- 后续自动保存只更新内容相关字段（正文/标题/更新时间），不改“开编基准”。

### 4) 权限策略

- 前端草稿里的权限字段只用于 UI 表现（例如按钮可见性提示）。
- 实际写操作以服务端接口结果为准（403/409/404 等）。
- 不要求“发布前必须再 GET 一次权限”。

### 5) Pull 策略

- Pull 只更新“没有被编辑（无草稿）”的文章。
- 有草稿时不走覆盖式 Pull。

---

## 二、核心模型（建议）

## DraftRecord（副本语义）

草稿是一份“开编时服务端文档的本地分支副本”，建议包含：

- `documentId`
- `content`
- `displayName`
- `updatedAt`
- `published`
- `localBaseCommitId`（开编分叉点，首次创建写入，后续不改；命名见 [commit-naming-and-merge-base.md](./commit-naming-and-merge-base.md)）
- `headCommitIdAtOpen`（记录打开时远端 head，便于诊断）
- `relativePath`
- `domainId`
- `permission`
- `ownerVisitorId`
- 现有冲突字段：`conflictStatus` / `conflict`
- 现有失败字段：`publishError` / `publishErrorAt`

说明：

- 本文里把 `localBaseCommitId` 视为“副本分叉点”，不是 `remoteCommitId`（当前服务端 head）。
- 内存态 `syncLocalBaseCommitId` 用于 sync-status 轮询：有草稿时用草稿的 `localBaseCommitId`，无草稿时用打开文档时的 head。

---

## 三、交互流程（按本期目标）

### A. 首次编辑

1. 用户打开文档（仅展示，不立刻建草稿）。
2. 用户第一次产生 dirty 内容。
3. 写入全量草稿副本（含 meta + `localBaseCommitId`）。

### B. 自动保存

- 仅更新：`content`、`displayName`、`updatedAt`（和必要状态位）。
- 不改：`localBaseCommitId`、`relativePath`、`domainId`、`permission`、`ownerVisitorId`。

### C. 发布

- 直接用草稿副本发起发布。
- 后端成功：删除草稿（回到“无草稿模式”）。
- 后端失败：保留草稿，并按错误类型更新失败/冲突状态。

### D. Pull

- 若无草稿：GET 最新文档并更新当前编辑区。
- 若有草稿：不做覆盖式 Pull（本期不增强为自动 merge）。

---

## 四、未发布草稿轻量预览（本次新增想法）

需求：在“未发布草稿列表”中点击草稿，弹一个轻量编辑框，使用 Lobe Editor，但不显示左侧 tree。

### 目标

- 让用户在不离开设置页的情况下快速查看/编辑某份草稿。
- 降低“草稿不可见、只能发布/删除”的操作成本。

### UI 方案（最小实现）

- 新增 `DraftQuickEditorModal`（组件名可调整）：
  - 全屏或大尺寸弹层。
  - 顶部显示草稿名 + 更新时间 + 关闭按钮。
  - 主体嵌入 `@lobehub/editor`。
  - 底部按钮：`保存草稿`、`发布`、`关闭`。
- 不包含：
  - 左侧树
  - 域切换
  - 复杂评论区

### 行为

- 从 `DraftListPage` 点击草稿行打开该 modal。
- 编辑时调用草稿保存接口（只改内容相关字段）。
- 发布按钮复用现有发布回调（成功后关闭 modal，并从列表移除）。

### 失败兜底

- 发布失败时保留草稿并提示（沿用现有 `publishError` 标记机制）。

---

## 五、建议改动点（代码落地清单）

> 以下是“开始 coding”时的任务切片，先不要求本次全部一次完成。

### Phase 1：数据模型收敛（草稿副本）

1. `src/web/storage/drafts.ts`
  - 收敛 `DraftRecord` 字段：确定“全量首落盘 + 内容增量更新”的边界。
  - 提供两个明确入口：
    - `createDraftSnapshotOnFirstEdit(...)`
    - `updateDraftContentOnly(...)`
2. `src/web/app/hooks/useAutoSave.ts`
  - 首次 dirty 走 `createDraftSnapshotOnFirstEdit`。
  - 后续走 `updateDraftContentOnly`。
3. `src/web/app/DocumentEditor.tsx`
  - 手动保存草稿同样走内容增量更新，不改分叉点字段。

### Phase 2：Sync/Pull 简化

1. `src/web/app/App.tsx`
  - 有草稿时禁用/短路覆盖式 Pull。
  - 无草稿时才允许 Pull。
2. `src/web/app/hooks/useDocumentVersion.ts`
  - 本期有草稿可先减少/停用后台 sync 轮询（按实际 UI 需求做最小变更）。

### Phase 3：草稿轻量预览弹层

1. 新建 `src/web/app/DraftQuickEditorModal.tsx`。
2. `src/web/app/DraftListPage.tsx`
  - 列表项点击打开 quick editor。
3. `src/web/app/SettingsPage.tsx`
  - 托管弹层开关，和草稿列表联动。

### Phase 4：文案与说明

1. i18n keys（`en.ts` / `zh.ts` / `types.ts`）补齐：
  - 草稿预览入口、保存提示、发布提示等。
2. `fgbg-docs` 更新：
  - `auto-save-draft.md`
  - 本文（作为决策记录）

---

## 六、一个明确的取舍（避免再次发散）

本期先不做：

- 有草稿时的复杂实时 Sync 判定与自动冲突提示增强。
- “打开文档时即创建草稿”的预先快照。
- 本地维护完整 DAG（保持服务端裁决，前端只保留副本与冲突快照）。

先把“副本模型 + 轻量可见可改”做稳，再谈 Sync 强化。