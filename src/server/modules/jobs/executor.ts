import { useLogger } from "../../infra/logger/logger";
import { runInTransaction } from "../../infra/db/transaction.js";
import { runJobAgent } from "./agent/run-job-agent";
import type { JobFileConfig } from "./job-file";
import {
  finishJobRunningDetail,
  hasActiveJobRun,
  insertJobRunningData,
  insertJobRunningDetail,
  JOB_STATUS,
  type JobTrigger,
} from "./repo/job-running.repo.js";

const log = useLogger("jobs.executor");

function finishRun(
  jobRunningId: number,
  status: typeof JOB_STATUS.done | typeof JOB_STATUS.failed,
  failedReason: string | null,
): void {
  finishJobRunningDetail(jobRunningId, status, new Date().toISOString(), failedReason);
}

function appendJobPoints(
  jobId: string,
  jobRunningId: number,
  points: Array<{ x: string; y: number }>,
): void {
  if (points.length === 0) return;
  const createdAt = new Date().toISOString();
  runInTransaction(() => {
    for (const point of points) {
      insertJobRunningData({
        id: null,
        job_id: jobId,
        job_running_id: jobRunningId,
        x: point.x,
        y: point.y,
        created_at: createdAt,
      });
    }
  });
}

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
    jobRunningId = insertJobRunningDetail({
      id: null,
      job_id: jobId,
      status: JOB_STATUS.running,
      start_time: new Date().toISOString(),
      end_time: null,
      failed_reason: null,
      trigger,
    });
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
          appendJobPoints(jobId, jobRunningId, points);
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
      finishRun(jobRunningId, JOB_STATUS.failed, "timeout or cancelled");
      log.warn("%s status=failed reason=timeout_or_cancelled", tag);
      return;
    }

    if (!result.ok) {
      const reason = result.errorMessage ?? "agent failed";
      finishRun(jobRunningId, JOB_STATUS.failed, reason);
      log.warn("%s status=failed reason=%s", tag, reason);
      return;
    }

    finishRun(jobRunningId, JOB_STATUS.done, null);
    log.info("%s status=done", tag);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    finishRun(
      jobRunningId,
      JOB_STATUS.failed,
      ac.signal.aborted ? "timeout or cancelled" : msg,
    );
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
