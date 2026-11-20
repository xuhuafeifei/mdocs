import type { JobRunningData, JobRunningDetail } from "../entity/job-running.entity.js";

/** 读 Job 时附在正文里的产出点（驼峰，不是 HTTP 列表）。 */
export function toJobRuntimePoint(row: JobRunningData): {
  id: number;
  x: string;
  y: number;
  jobRunningId: number;
  createdAt: string;
} {
  return {
    id: row.id ?? 0,
    x: row.x,
    y: row.y,
    jobRunningId: row.job_running_id,
    createdAt: row.created_at,
  };
}

/** 读 Job 时附在正文里的运行流水（驼峰，不是 HTTP 列表）。 */
export function toJobRuntimeRun(row: JobRunningDetail): {
  id: number;
  status: number;
  trigger: string;
  startTime: string;
  endTime: string | null;
  failedReason: string | null;
} {
  return {
    id: row.id ?? 0,
    status: row.status,
    trigger: row.trigger,
    startTime: row.start_time,
    endTime: row.end_time,
    failedReason: row.failed_reason,
  };
}
