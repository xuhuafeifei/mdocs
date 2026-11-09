import type Database from "better-sqlite3";
import { getDb } from "../db/connection.js";

export const JOB_STATUS = {
  prepare: 0,
  running: 10,
  done: 20,
  failed: 30,
} as const;

export type JobTrigger = "cron" | "manual";

export function hasActiveJobRun(jobId: string, db: Database.Database = getDb()): boolean {
  const row = db
    .prepare<{ jobId: string }, { c: number }>(
      `SELECT COUNT(*) AS c FROM job_running_detail
       WHERE job_id = @jobId AND status IN (${JOB_STATUS.prepare}, ${JOB_STATUS.running})`,
    )
    .get({ jobId });
  return (row?.c ?? 0) > 0;
}

/** 该 job 在 [secStart, secEnd) 是否已有 detail（防同秒重复入队）。 */
export function hasJobRunInSecond(
  jobId: string,
  atMs: number,
  db: Database.Database = getDb(),
): boolean {
  const secStart = new Date(Math.floor(atMs / 1000) * 1000).toISOString();
  const secEnd = new Date(Math.floor(atMs / 1000) * 1000 + 1000).toISOString();
  const row = db
    .prepare<
      { jobId: string; secStart: string; secEnd: string },
      { c: number }
    >(
      `SELECT COUNT(*) AS c FROM job_running_detail
       WHERE job_id = @jobId AND start_time >= @secStart AND start_time < @secEnd`,
    )
    .get({ jobId, secStart, secEnd });
  return (row?.c ?? 0) > 0;
}

export function insertJobRun(params: {
  jobId: string;
  trigger: JobTrigger;
  startTime?: string;
  db?: Database.Database;
}): number {
  const db = params.db ?? getDb();
  const startTime = params.startTime ?? new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO job_running_detail (job_id, status, start_time, trigger)
       VALUES (@jobId, @status, @startTime, @trigger)`,
    )
    .run({
      jobId: params.jobId,
      status: JOB_STATUS.running,
      startTime,
      trigger: params.trigger,
    });
  return Number(result.lastInsertRowid);
}

export function finishJobRun(params: {
  jobRunningId: number;
  status: typeof JOB_STATUS.done | typeof JOB_STATUS.failed;
  failedReason?: string | null;
  db?: Database.Database;
}): void {
  const db = params.db ?? getDb();
  db.prepare(
    `UPDATE job_running_detail
     SET status = @status, end_time = @endTime, failed_reason = @failedReason
     WHERE id = @id`,
  ).run({
    id: params.jobRunningId,
    status: params.status,
    endTime: new Date().toISOString(),
    failedReason: params.failedReason ?? null,
  });
}

export function appendJobRunningData(params: {
  jobId: string;
  jobRunningId: number;
  points: Array<{ x: string; y: number }>;
  db?: Database.Database;
}): void {
  if (params.points.length === 0) return;
  const db = params.db ?? getDb();
  const createdAt = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO job_running_data (job_id, job_running_id, x, y, created_at)
     VALUES (@jobId, @jobRunningId, @x, @y, @createdAt)`,
  );
  const tx = db.transaction(() => {
    for (const p of params.points) {
      stmt.run({
        jobId: params.jobId,
        jobRunningId: params.jobRunningId,
        x: p.x,
        y: p.y,
        createdAt,
      });
    }
  });
  tx();
}

export function deleteJobRuntimeByJobId(
  jobId: string,
  db: Database.Database = getDb(),
): void {
  db.prepare(`DELETE FROM job_running_data WHERE job_id = ?`).run(jobId);
  db.prepare(`DELETE FROM job_running_detail WHERE job_id = ?`).run(jobId);
}

export type JobRunningDetailRow = {
  id: number;
  job_id: string;
  status: number;
  start_time: string;
  end_time: string | null;
  failed_reason: string | null;
  trigger: string;
};

export type JobRunningDataRow = {
  id: number;
  job_id: string;
  job_running_id: number;
  x: string;
  y: number;
  created_at: string;
};

export function listJobRuns(
  jobId: string,
  limit = 50,
  db: Database.Database = getDb(),
): JobRunningDetailRow[] {
  return db
    .prepare(
      `SELECT id, job_id, status, start_time, end_time, failed_reason, trigger
       FROM job_running_detail
       WHERE job_id = ?
       ORDER BY start_time DESC
       LIMIT ?`,
    )
    .all(jobId, Math.min(Math.max(limit, 1), 200)) as JobRunningDetailRow[];
}

export function listJobRunningData(
  jobId: string,
  limit = 5000,
  db: Database.Database = getDb(),
): JobRunningDataRow[] {
  return db
    .prepare(
      `SELECT id, job_id, job_running_id, x, y, created_at
       FROM job_running_data
       WHERE job_id = ?
       ORDER BY id ASC
       LIMIT ?`,
    )
    .all(jobId, Math.min(Math.max(limit, 1), 20000)) as JobRunningDataRow[];
}

export function findJobRunById(
  jobRunningId: number,
  db: Database.Database = getDb(),
): JobRunningDetailRow | undefined {
  return db
    .prepare(
      `SELECT id, job_id, status, start_time, end_time, failed_reason, trigger
       FROM job_running_detail WHERE id = ?`,
    )
    .get(jobRunningId) as JobRunningDetailRow | undefined;
}

export function markJobRunFailedIfActive(
  jobRunningId: number,
  reason: string,
  db: Database.Database = getDb(),
): void {
  db.prepare(
    `UPDATE job_running_detail
     SET status = @status, end_time = @endTime, failed_reason = @reason
     WHERE id = @id AND status IN (${JOB_STATUS.prepare}, ${JOB_STATUS.running})`,
  ).run({
    id: jobRunningId,
    status: JOB_STATUS.failed,
    endTime: new Date().toISOString(),
    reason,
  });
}
