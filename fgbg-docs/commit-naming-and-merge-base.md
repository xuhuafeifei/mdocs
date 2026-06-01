# 提交图命名与 merge-base

本文是 mdocs 文档版本 DAG 的**唯一命名规范**。代码、API、IndexedDB 草稿字段均以此为准。

## 四个 commit 角色

| 名称 | 含义 | 何时存在 |
|------|------|----------|
| **`localBaseCommitId`** | 本地开编分叉点：用户**首次产生未发布编辑**时服务端 head，之后不变 | 有草稿时写在 `DraftRecord` |
| **`remoteCommitId`** | 服务端**当前** head（`documents.head_commit_id`） | 每次 `GET /documents/:id`、sync-status 轮询 |
| **`localCommitId`** | 本地支的 commit 节点（merge 发布里的 `r_local`） | 仅 **merge 发布成功** 后写入 `document_commits` |
| **`mergeBaseCommitId`** | **`localCommitId` 与 `remoteCommitId` 在 DAG 上的最近公共祖先（LCA）** | 算法算出；行级三路 diff 的祖先正文应用此 id |

### 不要混用的旧名（已废弃）

| 旧名 | 新名 |
|------|------|
| `baseCommitId` | `localBaseCommitId` |
| `expectedHeadCommitId` | `remoteCommitId` |

`headCommitId`（文档摘要上的字段）仍表示**当前服务端 head**，与 `remoteCommitId` 同值，保留是因 HTTP 资源上的通用说法；**merge / 草稿 / version 载荷里统一用 `remoteCommitId`**。

## 概念关系

### 正常：远端在分叉点之后线性前进

```text
localBaseCommitId ──→ … ──→ remoteCommitId
        └── 本地草稿改动（尚未成为 localCommitId）
```

此时通常 **`mergeBaseCommitId === localBaseCommitId`**。

### 历史回退（reset）：远端 head 回到更早节点

```text
mergeBaseCommitId ──→ … ──→ localBaseCommitId
        └── remoteCommitId（当前 head，在更早位置）
```

此时 **`mergeBaseCommitId === remoteCommitId`**，**不等于** `localBaseCommitId`。

merge 发布要求 `localBaseCommitId` 是 `remoteCommitId` 的祖先（`assertMergeFork`）。回退场景下不满足，**服务端拒绝 merge 发布**；UI 不得用 `localBaseCommitId` 冒充三路 diff 的祖先。

### merge 发布完成后的图

```text
localBaseCommitId
 ├── … ──→ remoteCommitId（合并前远端 tip）
 └── localCommitId（r_local，父 = localBaseCommitId）
        \      /
         mergeCommitId（新 head，双父 = remoteCommitId + localCommitId）
```

## API 与存储字段

### `PUT /api/documents/:id` — `version`

```ts
interface PublishVersionContext {
  /** 开编分叉点；线性发布与 merge 发布均使用 */
  localBaseCommitId?: string;
  merge?: {
    /** 打开 merge / 409 时记录的远端 tip，须仍等于当前 head */
    remoteCommitId: string;
    /** 合并前本地支正文（Lexical JSON），用于落库 r_local */
    localSnapshotContent?: string;
  };
}
```

merge 发布时 **`localBaseCommitId` 必填**。

### merge 发布响应职责

- 当 `version.merge` 存在时，`PUT /api/documents/:id` 仅返回 **204 No Content**（表示 merge 发布成功）。
- merge 后的文档详情（含权限派生字段）由前端随后 `GET /api/documents/:id` 获取。
- 这样可保持职责边界清晰：写接口负责“是否写成功”，读接口负责“资源最终视图”。

### `GET /api/documents/:id/sync-status?localBaseCommitId=…`

用客户端持有的分叉点与当前 `headCommitId`（即 `remoteCommitId`）比较，返回 `up_to_date` / `behind` / `ahead`。

### IndexedDB `DraftRecord`

- `localBaseCommitId`：首次创建草稿时写入，自动保存不覆盖。
- `conflict.localBaseCommitId` / `conflict.remoteCommitId`：进入冲突 / merge 流程时冻结。

### 服务端工具函数

- `findMergeBaseCommitId(db, commitA, commitB)`：求两节点的 LCA（含「一方是另一方祖先」）。
- `assertMergeFork(db, localBaseCommitId, remoteCommitId)`：merge 发布前校验分叉合法。

## 行级 merge UI（规划）

三份 Markdown 正文建议：

| 变量 | 来源 commit |
|------|-------------|
| ancestorMd | **`mergeBaseCommitId`** 对应正文 |
| oursMd | 当前草稿最新 |
| theirsMd | **`remoteCommitId`** 当前正文 |

`localBaseCommitId` 仅用于展示「从哪版开始改」及 `r_local` 的父边，**默认不作为**三路 diff 的 ancestor。

## 实现备注

- 当前**无**按 commit id 读取正文的公开 API；开编时可在草稿增加 `localBaseSnapshotContent` 以降低 merge UI 开发量（仅覆盖「线性落后」；reset 须检测后禁用自动 diff）。
- `mergeBaseCommitId` 由服务端根据 DAG 计算；浏览器仅有 id 时无法在 reset 场景下自行推导。

## 相关文档

- [草稿副本模型](./draft-copy-model-and-preview-plan.md)
