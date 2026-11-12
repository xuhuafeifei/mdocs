# 021 — server 按 infra / modules 拆，调用只允许从上往下

- **状态**：accepted（2026-11-12）。本次只定目录和调用方向，不搬代码。
- **上下文**：`src/server/` 同时按技术层（`routes/`、`db/`）和业务目录切开，调用互相指。曾经把权限和鉴权放进基建，理由是很多模块都要用。也曾保留一个 `identity` 模块，把访客、令牌和中间件捆在一起。
- **决策**：
  - 顶层分成 `infra` 和 `modules`。`modules` 可以依赖 `infra`。`infra` 不依赖任何业务模块，也不写业务规则。
  - 不设 `utils`，不设 `modules/common`。被多处使用不是进 `infra` 的理由。
  - 不设 `identity`。注册、登录、恢复码、改密码、按令牌查出访客归 `modules/visitor`。令牌哈希和 CLI token 放在这个模块里，不单开 `token`。鉴权中间件也放在这里，它不是独立业务。
  - `access` 与 `documents` 平级。它只接收已经查好的文档行、空间类型、成员和邀请，不调用别的业务模块。
  - 记录类模块内部分成 controller、service、repo。本模块的 SQL 写在自己的 repo。`infra/db` 只提供连接、事务和表结构迁移。
  - `agent` 内部保持函数管道，不套这三层。对话 Agent 和以后调度器拉起的 Agent 都在 `modules/agent/`。
  - 业务模块之间单向、无环。允许的调用：

```text
infra
  db / storage / logger / http / task-queue

visitor ──→ domains
access

documents ──→ domains
documents ──→ access
search ──→ access
documents ──→ search          只为通知索引。search 不能再调用 documents

agent ──→ documents、search、access、domains、visitor
plugins、mcp、memes           agent 可以调用它们；它们不调用 agent

watch-dog（以后）──→ agent    不碰文档文件，也不被 documents 调用
```

  - `src/server/jobs/` 先留在原地。Job 文件与调度的拆分见 ADR 020。
- **后果**：
  - 搬目录时按上面的树挪，不把 `access` 或鉴权放进 `infra`。
  - 现有 `documents` → `jobs`、`documents` 里的建议说明去调 `agent`，与这张图相反，留到拆 watch-dog 时再解开。
- **目录**：

```text
src/server/
  cli/
  infra/
    config/
    db/
    storage/
    logger/
    http/
    task-queue/
  modules/
    visitor/
    access/
    domains/
    documents/
    search/
    agent/
    plugins/
    mcp/
    memes/
```

- **落点**：
  | 位置 | 说明 |
  |------|------|
  | `src/server/identity/` | 今天的访客、令牌、中间件，以后并入 `modules/visitor` |
  | `src/server/access/access-control.ts` | `canReadDocument` / `canEditDocument` |
  | `src/server/documents/document.service.ts` | 现有绕圈：调用 jobs、agent、search |
  | `.mdocs-docs/decisions/020-job-file-vs-watchdog.md` | Job 文件与 watch-dog 的职责，本次不搬 |
