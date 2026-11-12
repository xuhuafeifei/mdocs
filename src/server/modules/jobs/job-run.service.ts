import { DocumentError } from "../../access/access-control";
import { getDb } from "../../infra/db/connection";
import { findDocumentById } from "../../infra/db/repositories/document.repo";
import { FILE_TYPE } from "../../../shared/file-types";
import { readDocument } from "../../infra/storage/file-store";
import { parseJobFileContent } from "./job-file";
import {
  cancelJobRun as abortInflightRun,
  enqueueJobExecution,
} from "./executor";
import {
  clearJobRunningData,
  deleteJobRunningDataByIds,
  findJobRunById,
  hasActiveJobRun,
  JOB_STATUS,
  listJobRunningData,
  listJobRuns,
  markJobRunFailedIfActive,
  type JobRunningDataRow,
  type JobRunningDetailRow,
} from "./running-repo";

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

const JOB_READ_POINTS_LIMIT = 500;
const JOB_READ_RUNS_LIMIT = 30;

/** 读 Job 时附带运行时快照（不写回 .job）。 */
export function getJobRuntimeSnapshot(documentId: string): {
  points: Array<{
    id: number;
    x: string;
    y: number;
    jobRunningId: number;
    createdAt: string;
  }>;
  runs: Array<{
    id: number;
    status: number;
    trigger: string;
    startTime: string;
    endTime: string | null;
    failedReason: string | null;
  }>;
  pointsTruncated: boolean;
  runsTruncated: boolean;
} {
  loadJobRow(documentId);
  const pointRows = listJobRunningData(documentId, JOB_READ_POINTS_LIMIT + 1);
  const runRows = listJobRuns(documentId, JOB_READ_RUNS_LIMIT + 1);
  const pointsTruncated = pointRows.length > JOB_READ_POINTS_LIMIT;
  const runsTruncated = runRows.length > JOB_READ_RUNS_LIMIT;
  const points = (pointsTruncated
    ? pointRows.slice(-JOB_READ_POINTS_LIMIT)
    : pointRows
  ).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    jobRunningId: p.job_running_id,
    createdAt: p.created_at,
  }));
  const runs = (runsTruncated ? runRows.slice(0, JOB_READ_RUNS_LIMIT) : runRows).map(
    (r) => ({
      id: r.id,
      status: r.status,
      trigger: r.trigger,
      startTime: r.start_time,
      endTime: r.end_time,
      failedReason: r.failed_reason,
    }),
  );
  return { points, runs, pointsTruncated, runsTruncated };
}

/**
 * 把 Job 配置 JSON + 运行时数据打成一份只读 content（给 get_document / Agent）。
 * 写回仍应只用 JobConfig / MonitorConfig；本函数产物勿当磁盘真源。
 */
export function wrapJobContentWithRuntime(
  documentId: string,
  fileContent: string,
): string {
  let base: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(fileContent) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      base = parsed as Record<string, unknown>;
    } else {
      base = { JobFileRaw: fileContent };
    }
  } catch {
    base = { JobFileRaw: fileContent };
  }
  const runtime = getJobRuntimeSnapshot(documentId);
  return `${JSON.stringify(
    {
      ...base,
      JobRunningData: runtime.points,
      JobRuns: runtime.runs,
      ...(runtime.pointsTruncated || runtime.runsTruncated
        ? {
            JobRuntimeMeta: {
              pointsTruncated: runtime.pointsTruncated,
              runsTruncated: runtime.runsTruncated,
              pointsLimit: JOB_READ_POINTS_LIMIT,
              runsLimit: JOB_READ_RUNS_LIMIT,
            },
          }
        : {}),
    },
    null,
    2,
  )}\n`;
}

/** 人工删除产出点：传 ids，或 all=true 清空。不开放给 Agent。 */
export function deleteJobData(params: {
  documentId: string;
  ids?: number[];
  all?: boolean;
}): { deleted: number } {
  loadJobRow(params.documentId);
  if (params.all) {
    return { deleted: clearJobRunningData(params.documentId) };
  }
  const ids = (params.ids ?? []).filter((id) => Number.isFinite(id));
  if (ids.length === 0) {
    throw new DocumentError("BAD_REQUEST", "请指定要删除的数据点", 400);
  }
  return {
    deleted: deleteJobRunningDataByIds({ jobId: params.documentId, ids }),
  };
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
