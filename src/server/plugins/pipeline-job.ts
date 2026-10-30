/**
 * 流水线安装 / 卸载后台任务：内存态 + 步骤级事件；页面轮询。
 */
import { randomUUID } from "node:crypto";
import type { PluginPipeline, PipelineStep } from "./pipeline/types.js";
import {
  resolveUninstallSteps,
  runPipeline,
  type PipelineProbeResult,
  type PipelineStepStatus,
} from "./pipeline/executor.js";
import { PIPELINE_STEP_DEFINITIONS } from "./pipeline/step-definitions.js";

export type PipelineJobAction = "install" | "uninstall";

export type PipelineJobStep = {
  index: number;
  type: string;
  label: string;
  status: PipelineStepStatus;
  detail?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type PipelineJobLog = {
  ts: string;
  level: "info" | "warn" | "error";
  line: string;
  stepIndex?: number;
};

export type PipelineJob = {
  id: string;
  pipelineId: string;
  pipelineName: string;
  scope: "system" | "tenant";
  action: PipelineJobAction;
  status: "running" | "done" | "error";
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  steps: PipelineJobStep[];
  probe: { results: PipelineProbeResult[]; passed: boolean } | null;
  logs: PipelineJobLog[];
};

const jobs = new Map<string, PipelineJob>();

function keyOf(
  visitorId: string,
  pipelineId: string,
  action: PipelineJobAction,
): string {
  return `${visitorId}:${pipelineId}:${action}`;
}

function labelForStep(step: PipelineStep): string {
  const def = PIPELINE_STEP_DEFINITIONS.find((d) => d.type === step.type);
  return def?.label ?? step.type;
}

export function resetPipelineJobsForTests(): void {
  jobs.clear();
}

export function getPipelineJob(
  visitorId: string,
  pipelineId: string,
  action: PipelineJobAction,
): PipelineJob | null {
  return jobs.get(keyOf(visitorId, pipelineId, action)) ?? null;
}

export function getLatestPipelineJob(
  visitorId: string,
  pipelineId: string,
): PipelineJob | null {
  const install = getPipelineJob(visitorId, pipelineId, "install");
  const uninstall = getPipelineJob(visitorId, pipelineId, "uninstall");
  if (!install) return uninstall;
  if (!uninstall) return install;
  return uninstall.startedAt > install.startedAt ? uninstall : install;
}

function appendLog(job: PipelineJob, log: PipelineJobLog): void {
  job.logs.push(log);
  if (job.logs.length > 600) job.logs.splice(0, job.logs.length - 600);
}

export function startPipelineJob(params: {
  pipeline: PluginPipeline;
  scope: "system" | "tenant";
  action: PipelineJobAction;
  visitorId: string;
}): PipelineJob {
  const { pipeline, scope, action, visitorId } = params;
  const key = keyOf(visitorId, pipeline.id, action);
  const current = jobs.get(key);
  if (current && current.status === "running") return current;
  // StrictMode / 双击：刚成功的同一动作直接复用，别把卸载/安装跑第二遍。
  if (
    current &&
    current.status === "done" &&
    current.finishedAt &&
    Date.now() - new Date(current.finishedAt).getTime() < 1500
  ) {
    return current;
  }

  const steps = (action === "install"
    ? pipeline.steps
    : resolveUninstallSteps(pipeline)
  ).map(
    (step, index): PipelineJobStep => ({
      index,
      type: step.type,
      label: labelForStep(step),
      status: "pending",
    }),
  );
  const job: PipelineJob = {
    id: randomUUID(),
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    scope,
    action,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    steps,
    probe: null,
    logs: [],
  };
  jobs.set(key, job);
  appendLog(job, {
    ts: new Date().toISOString(),
    level: "info",
    line: action === "install" ? "开始安装" : "开始卸载",
  });

  void (async () => {
    try {
      await runPipeline({
        pipeline,
        action,
        visitorId,
        onEvent: (event) => {
          const now = new Date().toISOString();
          if (event.type === "probe") {
            job.probe = { results: event.results, passed: event.passed };
            appendLog(job, {
              ts: now,
              level: event.passed ? "info" : "info",
              line: event.passed
                ? "安装检测全部通过（可跳过下载类步骤）"
                : "安装检测未全部通过，按首次安装执行",
            });
            return;
          }
          if (event.type === "step") {
            const step = job.steps[event.index];
            if (!step) return;
            step.status = event.status;
            if (event.detail) step.detail = event.detail;
            if (event.error) step.error = event.error;
            if (event.status === "running") step.startedAt = now;
            if (
              event.status === "done" ||
              event.status === "skipped" ||
              event.status === "error"
            ) {
              step.finishedAt = now;
            }
            return;
          }
          if (event.type === "log") {
            appendLog(job, {
              ts: now,
              level: event.level,
              line: event.line,
              ...(event.stepIndex != null ? { stepIndex: event.stepIndex } : {}),
            });
            return;
          }
          if (event.type === "done") {
            appendLog(job, {
              ts: now,
              level: "info",
              line: action === "install" ? "安装成功" : "卸载完成",
            });
            return;
          }
          if (event.type === "error") {
            appendLog(job, {
              ts: now,
              level: "error",
              line: event.error,
            });
          }
        },
      });
      job.status = "done";
      job.finishedAt = new Date().toISOString();
      for (const step of job.steps) {
        if (step.status === "pending") {
          step.status = "skipped";
          step.detail = "未执行";
          step.finishedAt = job.finishedAt;
        }
      }
    } catch (err) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : String(err);
      job.finishedAt = new Date().toISOString();
    }
  })();

  return job;
}
