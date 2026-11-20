/**
 * job_running_detail / job_running_data 表实体（蛇形，与 SQL 列对齐）。
 * 未落库时 id 为 null，insert 返回主键。
 */

/** 表 job_running_detail */
export interface JobRunningDetail {
  id: number | null;
  job_id: string;
  status: number;
  start_time: string;
  end_time: string | null;
  failed_reason: string | null;
  trigger: string;
}

/** 表 job_running_data */
export interface JobRunningData {
  id: number | null;
  job_id: string;
  job_running_id: number;
  x: string;
  y: number;
  created_at: string;
}
