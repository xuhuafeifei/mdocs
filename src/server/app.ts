/**
 * 进程级引导：创建运行时目录、初始化数据库、挂后台任务。
 * HTTP 装配（json / cookie / 静态 / Nest）见 nest/attach。
 */
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "./infra/config/index.js";
import { getDb } from "./infra/db/connection.js";
import { bootstrapAgentRuns } from "./modules/agent/Agent/run-manager.js";
import { bootstrapJobs } from "./modules/jobs/index.js";
import { startIndexTimer } from "./modules/search/document-index-manager.js";
import { ensureLocalEmbeddingModel } from "./modules/search/embedding-model.js";
import { ensureSystemMemesBackground } from "./modules/memes/store.js";
import { ensureSystemPipelinesSeeded } from "./modules/plugins/pipeline/catalog.js";
import { ensureGlobalSoulShell } from "./modules/soul/ensure-shells.js";

export function bootstrapRuntime(): void {
  ensureRuntimeDirs();
  getDb();
  // 启动 FTS5 全文索引定时重建
  startIndexTimer();
  // 本地 embedding 模型：后台确保文件并 load，不阻塞 listen
  ensureLocalEmbeddingModel();
  // 系统表情包：空库则后台 npm 同步，不阻塞 listen
  ensureSystemMemesBackground();
  // 进程重启后：未完成的 Agent run 标为 interrupted
  bootstrapAgentRuns();
  // Job 调度：秒级 tick 总线（scanner / executor 后续挂接）
  bootstrapJobs();
}

/** 确保运行时所需的各目录已存在，按 0o700 权限递归创建。 */
function ensureRuntimeDirs(): void {
  const cfg = getConfig();
  for (const dir of [
    cfg.dataDir,
    cfg.filesDir,
    cfg.docsDir,
    cfg.assetsDir,
    cfg.agentAttachmentsDir,
    path.join(cfg.agentAttachmentsDir, "objects"),
    cfg.logsDir,
    path.join(cfg.dataDir, "soul"),
    path.join(cfg.dataDir, "plugins-home"),
    path.join(cfg.dataDir, "plugins-catalog"),
  ]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  ensureGlobalSoulShell();
  ensureSystemPipelinesSeeded();
}
