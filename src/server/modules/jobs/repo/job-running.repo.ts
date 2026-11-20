/**
 * job_running_detail / job_running_data 表访问。SQL 只活在本文件。
 * DB 默认内部 getDb()；可选末参 `db?` 仅单测注入。
 */
import type Database from "better-sqlite3";
import { resolveDb } from "../../../infra/db/resolve-db.js";
import type { JobRunningData, JobRunningDetail } from "../entity/job-running.entity.js";

export type { JobRunningData, JobRunningDetail } from "../entity/job-running.entity.js";

export const JOB_STATUS = {
  prepare: 0,
  running: 10,
  done: 20,
  failed: 30,
} as const;

export type JobTrigger = "cron" | "manual";

const DETAIL_COLUMNS = `id, job_id, status, start_time, end_time, failed_reason, trigger`;
const DATA_COLUMNS = `id, job_id, job_running_id, x, y, created_at`;

export function hasActiveJobRun(jobId: string, db?: Database.Database): boolean {
  const row = resolveDb(db)
    .prepare<[string], { c: number }>(
      `SELECT COUNT(*) AS c FROM job_running_detail
       WHERE job_id = ? AND status IN (${JOB_STATUS.prepare}, ${JOB_STATUS.running})`,
    )
    .get(jobId);
  return (row?.c ?? 0) > 0;
}

export function hasJobRunStartedBetween(
  jobId: string,
  secStart: string,
  secEnd: string,
  db?: Database.Database,
): boolean {
  const row = resolveDb(db)
    .prepare<[string, string, string], { c: number }>(
      `SELECT COUNT(*) AS c FROM job_running_detail
       WHERE job_id = ? AND start_time >= ? AND start_time < ?`,
    )
    .get(jobId, secStart, secEnd);
  return (row?.c ?? 0) > 0;
}

/** 插入运行流水；忽略 input.id（应为 null），返回新主键。 */
export function insertJobRunningDetail(
  input: JobRunningDetail,
  db?: Database.Database,
): number {
  const result = resolveDb(db)
    .prepare(
      `INSERT INTO job_running_detail
         (job_id, status, start_time, end_time, failed_reason, trigger)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.job_id,
      input.status,
      input.start_time,
      input.end_time,
      input.failed_reason,
      input.trigger,
    );
  return Number(result.lastInsertRowid);
}

export function finishJobRunningDetail(
  id: number,
  status: number,
  endTime: string,
  failedReason: string | null,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `UPDATE job_running_detail
       SET status = ?, end_time = ?, failed_reason = ?
       WHERE id = ?`,
    )
    .run(status, endTime, failedReason, id);
}

export function markJobRunningDetailFailedIfActive(
  id: number,
  endTime: string,
  failedReason: string,
  db?: Database.Database,
): void {
  resolveDb(db)
    .prepare(
      `UPDATE job_running_detail
       SET status = ?, end_time = ?, failed_reason = ?
       WHERE id = ? AND status IN (${JOB_STATUS.prepare}, ${JOB_STATUS.running})`,
    )
    .run(JOB_STATUS.failed, endTime, failedReason, id);
}

/** 插入一个产出点；忽略 input.id（应为 null），返回新主键。 */
export function insertJobRunningData(
  input: JobRunningData,
  db?: Database.Database,
): number {
  const result = resolveDb(db)
    .prepare(
      `INSERT INTO job_running_data (job_id, job_running_id, x, y, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.job_id,
      input.job_running_id,
      input.x,
      input.y,
      input.created_at,
    );
  return Number(result.lastInsertRowid);
}

export function deleteJobRunningDataByJobId(jobId: string, db?: Database.Database): void {
  resolveDb(db).prepare(`DELETE FROM job_running_data WHERE job_id = ?`).run(jobId);
}

export function deleteJobRunningDetailByJobId(jobId: string, db?: Database.Database): void {
  resolveDb(db).prepare(`DELETE FROM job_running_detail WHERE job_id = ?`).run(jobId);
}

export function deleteJobRunningDataByIds(
  jobId: string,
  ids: number[],
  db?: Database.Database,
): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(", ");
  const result = resolveDb(db)
    .prepare(
      `DELETE FROM job_running_data
       WHERE job_id = ? AND id IN (${placeholders})`,
    )
    .run(jobId, ...ids);
  return Number(result.changes ?? 0);
}

export function clearJobRunningData(jobId: string, db?: Database.Database): number {
  const result = resolveDb(db)
    .prepare(`DELETE FROM job_running_data WHERE job_id = ?`)
    .run(jobId);
  return Number(result.changes ?? 0);
}

export function listJobRunningDetails(
  jobId: string,
  limit = 50,
  db?: Database.Database,
): JobRunningDetail[] {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  return resolveDb(db)
    .prepare<[string, number], JobRunningDetail>(
      `SELECT ${DETAIL_COLUMNS}
       FROM job_running_detail
       WHERE job_id = ?
       ORDER BY start_time DESC
       LIMIT ?`,
    )
    .all(jobId, safeLimit);
}

export function listJobRunningData(
  jobId: string,
  limit = 5000,
  db?: Database.Database,
): JobRunningData[] {
  const safeLimit = Math.min(Math.max(limit, 1), 20000);
  return resolveDb(db)
    .prepare<[string, number], JobRunningData>(
      `SELECT ${DATA_COLUMNS}
       FROM job_running_data
       WHERE job_id = ?
       ORDER BY id ASC
       LIMIT ?`,
    )
    .all(jobId, safeLimit);
}

export function findJobRunningDetailById(
  id: number,
  db?: Database.Database,
): JobRunningDetail | undefined {
  return resolveDb(db)
    .prepare<number, JobRunningDetail>(
      `SELECT ${DETAIL_COLUMNS} FROM job_running_detail WHERE id = ?`,
    )
    .get(id);
}
