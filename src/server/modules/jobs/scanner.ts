import { getDb } from "../../infra/db/connection";
import { readDocument } from "../../infra/storage/file-store";
import { FILE_TYPE } from "../../../shared/file-types";
import { useLogger } from "../../infra/logger/logger";
import { isCronDueAt } from "./cron";
import { jobBus, JOBS_TICK, type JobsTickPayload } from "./events";
import { parseJobFileContent } from "./job-file";
import { enqueueJobExecution } from "./executor";
import { hasActiveJobRun, hasJobRunInSecond } from "./running-repo";

const log = useLogger("jobs.scanner");

type JobDocRow = {
  document_id: string;
  domain_id: string;
  relative_path: string;
  owner_visitor_id: string;
};

let listening = false;

export function startJobScanner(): void {
  if (listening) return;
  listening = true;
  jobBus.on(JOBS_TICK, onTick);
  log.info("job scanner listening on %s", JOBS_TICK);
}

export function stopJobScanner(): void {
  if (!listening) return;
  jobBus.off(JOBS_TICK, onTick);
  listening = false;
}

function onTick(payload: JobsTickPayload): void {
  try {
    scanDueJobs(payload.at);
  } catch (err) {
    log.error(
      "scan failed: %s",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** 扫描全部 job 文档；到点则异步丢给 executor（不 await）。 */
export function scanDueJobs(atMs: number): void {
  const db = getDb();
  const rows = db
    .prepare<string, JobDocRow>(
      `SELECT document_id, domain_id, relative_path, owner_visitor_id
       FROM documents WHERE file_type = ?`,
    )
    .all(FILE_TYPE.JOB);

  for (const row of rows) {
    try {
      considerJob(row, atMs);
    } catch (err) {
      log.warn(
        "jobId=%s scan error: %s",
        row.document_id,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

function considerJob(row: JobDocRow, atMs: number): void {
  const { content } = readDocument(row.domain_id, row.relative_path);
  const doc = parseJobFileContent(content);
  const cfg = doc.JobConfig;
  if (!cfg.cron) return;
  if (cfg.jobType !== "agent") return;
  if (!isCronDueAt(cfg.cron, atMs)) return;
  if (hasJobRunInSecond(row.document_id, atMs)) return;
  if (hasActiveJobRun(row.document_id)) return;

  log.info(
    "cron due jobId=%s cron=%s → enqueue",
    row.document_id,
    cfg.cron,
  );
  enqueueJobExecution({
    jobId: row.document_id,
    domainId: row.domain_id,
    ownerVisitorId: row.owner_visitor_id,
    config: {
      ...cfg,
      jobId: row.document_id,
    },
    trigger: "cron",
  });
}
