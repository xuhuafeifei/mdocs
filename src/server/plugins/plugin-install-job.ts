/**
 * 插件安装在服务端后台跑。日志写入 dataDir/task-logs（与图谱任务同一套 JSONL），
 * 页面轮询 job.logs 显示。
 */
import path from "node:path";
import { getConfig } from "../config/index.js";
import { TaskLogStore } from "../task-queue/log-store.js";
import type { LogEntry } from "../task-queue/types.js";
import { getCatalogEntry } from "./plugin-catalog.js";
import {
  installPlugin,
  type PluginInstallPhase,
} from "./plugins-store.js";

type JobState = {
  pluginId: string;
  phase: PluginInstallPhase | "done" | "error";
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type PluginInstallJob = JobState & {
  logs: LogEntry[];
};

const jobs = new Map<string, JobState>();
let logStore: TaskLogStore | null = null;

function logsFor(): TaskLogStore {
  if (!logStore) {
    logStore = new TaskLogStore(path.join(getConfig().dataDir, "task-logs"));
  }
  return logStore;
}

function logId(pluginId: string): string {
  return `plugin-${pluginId}`;
}

function readLogs(pluginId: string): LogEntry[] {
  return logsFor().readTail(logId(pluginId), 200);
}

function withLogs(job: JobState): PluginInstallJob {
  return { ...job, logs: readLogs(job.pluginId) };
}

export function getPluginInstallJob(pluginId: string): PluginInstallJob | null {
  const job = jobs.get(pluginId);
  return job ? withLogs(job) : null;
}

export function resetPluginInstallJobsForTests(): void {
  jobs.clear();
}

export function startPluginInstall(
  pluginId: string,
  opts: { headers?: Record<string, string> } = {},
): PluginInstallJob {
  if (!getCatalogEntry(pluginId)) throw new Error("plugin not found");
  const current = jobs.get(pluginId);
  if (current && !current.finishedAt) return withLogs(current);

  const job: JobState = {
    pluginId,
    phase: "npm",
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  logsFor().reset(logId(pluginId));
  logsFor().append(logId(pluginId), "plugin.phase", { phase: "npm" }, "info");
  jobs.set(pluginId, job);
  void runJob(job, opts);
  return withLogs(job);
}

async function runJob(
  job: JobState,
  opts: { headers?: Record<string, string> },
): Promise<void> {
  const store = logsFor();
  const id = logId(job.pluginId);
  try {
    await installPlugin(job.pluginId, opts, {
      onPhase: (phase) => {
        if (!job.finishedAt) job.phase = phase;
        store.append(id, "plugin.phase", { phase }, "info");
      },
      onOutput: (stream, line) => {
        store.append(id, "plugin.output", { line }, stream === "stderr" ? "warn" : "info");
      },
    });
    store.append(id, "plugin.done", { line: "安装成功" }, "info");
    job.phase = "done";
    job.finishedAt = new Date().toISOString();
  } catch (err) {
    job.phase = "error";
    job.error = err instanceof Error ? err.message : String(err);
    store.append(id, "plugin.error", { line: job.error }, "error");
    job.finishedAt = new Date().toISOString();
  }
}
