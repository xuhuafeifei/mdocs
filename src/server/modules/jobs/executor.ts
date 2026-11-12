import { useLogger } from "../../infra/logger/logger";
import { runJobAgent } from "./agent/run-job-agent";
import type { JobFileConfig } from "./job-file";
import {
  appendJobRunningData,
  finishJobRun,
  hasActiveJobRun,
  insertJobRun,
  JOB_STATUS,
  type JobTrigger,
} from "./running-repo";

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
export function enqueueJobExecution(
  params: ExecuteJobParams,
): { enqueued: boolean } {
  if (hasActiveJobRun(params.jobId)) {
    log.info(
      "enqueue skip jobId=%s trigger=%s reason=already_active",
      params.jobId,
      params.trigger,
    );
    return { enqueued: false };
  }
  log.info(
    "enqueue ok jobId=%s trigger=%s owner=%s cron=%s",
    params.jobId,
    params.trigger,
    params.ownerVisitorId,
    params.config.cron || "(none)",
  );
  void runExecuteJob(params);
  return { enqueued: true };
}

async function runExecuteJob(params: ExecuteJobParams): Promise<void> {
  const { jobId, ownerVisitorId, config, trigger } = params;

  if (hasActiveJobRun(jobId)) {
    log.info("execute skip jobId=%s reason=already_active_race", jobId);
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

  const tag = `jobId=${jobId} runId=${jobRunningId}`;
  log.info("%s running trigger=%s timeoutMs=%d", tag, trigger, JOB_RUN_TIMEOUT_MS);

  const ac = new AbortController();
  inflight.set(jobRunningId, ac);
  const timer = setTimeout(() => {
    log.warn("%s timeout → abort", tag);
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
          log.info(
            "%s append_data n=%d sample=%s",
            tag,
            points.length,
            points
              .slice(0, 3)
              .map((p) => `${p.x}=${p.y}`)
              .join("; "),
          );
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
      log.warn("%s status=failed reason=timeout_or_cancelled", tag);
      return;
    }

    if (!result.ok) {
      const reason = result.errorMessage ?? "agent failed";
      finishJobRun({
        jobRunningId,
        status: JOB_STATUS.failed,
        failedReason: reason,
      });
      log.warn("%s status=failed reason=%s", tag, reason);
      return;
    }

    finishJobRun({ jobRunningId, status: JOB_STATUS.done });
    log.info("%s status=done", tag);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    finishJobRun({
      jobRunningId,
      status: JOB_STATUS.failed,
      failedReason: ac.signal.aborted ? "timeout or cancelled" : msg,
    });
    log.error(
      "%s status=failed exception=%s",
      tag,
      ac.signal.aborted ? "timeout_or_cancelled" : msg,
    );
  } finally {
    clearTimeout(timer);
    inflight.delete(jobRunningId);
  }
}

/** 取消正在跑的运行（手动终止）。 */
export function cancelJobRun(jobRunningId: number): boolean {
  const ac = inflight.get(jobRunningId);
  if (!ac) {
    log.info("cancel miss runId=%s (not inflight)", jobRunningId);
    return false;
  }
  log.info("cancel abort runId=%s", jobRunningId);
  ac.abort();
  return true;
}
