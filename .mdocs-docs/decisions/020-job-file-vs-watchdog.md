# 020 — Job 文件与后台调度分开，Agent 只放在 agent/

- **状态**：accepted（2026-11-12）。本次只定职责，不搬代码。
- **上下文**：文件类型有 `md`、`sheet`、`html`、`job`。`job` 是落盘的一种文档。`src/server/jobs/` 实际还在跑定时任务，并在 `src/server/jobs/agent/` 里启动 Agent。创建文档时 `document.service` 又去调 jobs 准备 Job 文件内容。名字都叫 jobs，文件管理和后台调度缠在一起。
- **决策**：
  - 落盘的 Job 文件与 `md` / `html` / `sheet` 一样，归文档模块。类型能力仍走 `src/shared/file-type-policy.ts`。
  - 后台调度以后单独成模块，暂名 watch-dog。它负责到点拉起任务，不负责 Job 文件的创建、路径和权限。
  - 对话里的 Agent 和 watch-dog 拉起的 Agent 都放在 `modules/agent/`。watch-dog 只调用 agent 的运行入口，不在自己目录里再写一套 Agent。
  - 简单 Agent 和复杂 Agent 的内部分法以后再定。
- **后果**：
  - 接下来的目录搬迁不要把 `src/server/jobs/` 整个当成「Job 文件模块」，也不要把它嵌进 `documents`。
  - 现有依赖环（`documents` → `jobs`，`jobs` 启动 agent，agent 工具再调用 `documents`）留到 watch-dog 那次再拆。
- **落点**：
  | 位置 | 说明 |
  |------|------|
  | `src/shared/file-type-policy.ts` | `job` 与其它文件类型的能力表 |
  | `src/server/documents/document.service.ts` | 创建 Job 文件时调用 jobs |
  | `src/server/jobs/` | 今天的调度与运行 |
  | `src/server/jobs/agent/` | 调度器自己启动的 Agent，以后并入 `modules/agent/` |
  | `src/server/agent/Agent/` | 对话 Agent |
