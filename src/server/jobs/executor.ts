import { useLogger } from "../logger/logger.js";
import { runJobAgent } from "./agent/run-job-agent.js";
import type { JobFileConfig } from "./job-file.js";
import {
  appendJobRunningData,
  finishJobRun,
  hasActiveJobRun,
  insertJobRun,
  JOB_STATUS,
  type JobTrigger,
} from "./running-repo.js";

const log = useLogger("jobs.executor");

export const JOB_RUN_TIMEOUT_MS = 5 * 60 * 1000;

export type ExecuteJobParams = {
  jobId: string;
  domainId: string;
  ownerVisitorId: string;
  config: JobFileConfig;
  trigger: JobTrigger;
};

const inflight = new Map<number, AbortController>();

/**
 * 异步执行一次 Job：插流水 → Agent → 更新流水。
 * 调用方勿 await 堵塞 scanner；本函数内部 catch。
 */
export function enqueueJobExecution(params: ExecuteJobParams): void {
  void runExecuteJob(params);
}

async function runExecuteJob(params: ExecuteJobParams): Promise<void> {
  const { jobId, ownerVisitorId, config, trigger } = params;

  if (hasActiveJobRun(jobId)) {
    log.debug("skip jobId=%s: already active", jobId);
    return;
  }

  let jobRunningId: number;
  try {
    jobRunningId = insertJobRun({ jobId, trigger });
  } catch (err) {
    log.error(
      "insert run failed jobId=%s: %s",
      jobId,
      err instanceof Error ? err.message : String(err),
    );
    return;
  }

  const ac = new AbortController();
  inflight.set(jobRunningId, ac);
  const timer = setTimeout(() => {
    ac.abort();
  }, JOB_RUN_TIMEOUT_MS);

  try {
    const result = await runJobAgent({
      ctx: {
        jobId,
        jobRunningId,
        visitorId: ownerVisitorId,
        tableSchema: config.tableSchema,
        appendData: async (points) => {
          if (ac.signal.aborted) {
            throw new Error("job run aborted; reject append");
          }
          appendJobRunningData({ jobId, jobRunningId, points });
        },
      },
      prompt: config.prompt,
      signal: ac.signal,
    });

    if (ac.signal.aborted) {
      finishJobRun({
        jobRunningId,
        status: JOB_STATUS.failed,
        failedReason: "timeout or cancelled",
      });
      return;
    }

    if (!result.ok) {
      finishJobRun({
        jobRunningId,
        status: JOB_STATUS.failed,
        failedReason: result.errorMessage ?? "agent failed",
      });
      return;
    }

    finishJobRun({ jobRunningId, status: JOB_STATUS.done });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    finishJobRun({
      jobRunningId,
      status: JOB_STATUS.failed,
      failedReason: ac.signal.aborted ? "timeout or cancelled" : msg,
    });
  } finally {
    clearTimeout(timer);
    inflight.delete(jobRunningId);
  }
}

/** 取消正在跑的运行（手动终止）。 */
export function cancelJobRun(jobRunningId: number): boolean {
  const ac = inflight.get(jobRunningId);
  if (!ac) return false;
  ac.abort();
  return true;
}
