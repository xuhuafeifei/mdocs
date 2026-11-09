import { DocumentError } from "../access/access-control.js";
import { getDb } from "../db/connection.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { FILE_TYPE } from "../../shared/file-types.js";
import { readDocument } from "../storage/file-store.js";
import { parseJobFileContent } from "./job-file.js";
import {
  cancelJobRun as abortInflightRun,
  enqueueJobExecution,
} from "./executor.js";
import {
  findJobRunById,
  hasActiveJobRun,
  JOB_STATUS,
  listJobRunningData,
  listJobRuns,
  markJobRunFailedIfActive,
  type JobRunningDataRow,
  type JobRunningDetailRow,
} from "./running-repo.js";

function loadJobRow(documentId: string) {
  const row = findDocumentById(getDb(), documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  if (row.file_type !== FILE_TYPE.JOB) {
    throw new DocumentError("BAD_REQUEST", "文档不是 Job 类型", 400);
  }
  return row;
}

export function getJobRuns(documentId: string, limit?: number): JobRunningDetailRow[] {
  loadJobRow(documentId);
  return listJobRuns(documentId, limit);
}

export function getJobData(documentId: string, limit?: number): JobRunningDataRow[] {
  loadJobRow(documentId);
  return listJobRunningData(documentId, limit);
}

export function manualRunJob(documentId: string): { accepted: true } {
  const row = loadJobRow(documentId);
  if (hasActiveJobRun(documentId)) {
    throw new DocumentError("CONFLICT", "任务正在运行中", 409);
  }
  const { content } = readDocument(row.domain_id, row.relative_path);
  const doc = parseJobFileContent(content);
  const cfg = doc.JobConfig;
  if (cfg.jobType !== "agent") {
    throw new DocumentError("BAD_REQUEST", "不支持的 jobType", 400);
  }
  if (!cfg.prompt?.trim()) {
    throw new DocumentError("BAD_REQUEST", "请先配置 prompt", 400);
  }

  const result = enqueueJobExecution({
    jobId: row.document_id,
    domainId: row.domain_id,
    ownerVisitorId: row.owner_visitor_id,
    config: { ...cfg, jobId: row.document_id },
    trigger: "manual",
  });
  if (!result.enqueued) {
    throw new DocumentError("CONFLICT", "任务正在运行中", 409);
  }
  return { accepted: true };
}

export function cancelJobRunForDocument(params: {
  documentId: string;
  jobRunningId: number;
}): { cancelled: boolean } {
  loadJobRow(params.documentId);
  const run = findJobRunById(params.jobRunningId);
  if (!run || run.job_id !== params.documentId) {
    throw new DocumentError("NOT_FOUND", "运行记录不存在", 404);
  }
  if (
    run.status !== JOB_STATUS.prepare &&
    run.status !== JOB_STATUS.running
  ) {
    return { cancelled: false };
  }
  const aborted = abortInflightRun(params.jobRunningId);
  markJobRunFailedIfActive(params.jobRunningId, "user cancelled");
  return { cancelled: aborted || true };
}

export { JOB_STATUS };
