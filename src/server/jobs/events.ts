import { EventEmitter } from "node:events";

/** Job 调度进程内总线（仅本进程；不跨进程）。 */
export const jobBus = new EventEmitter();

/** 每秒心跳；scanner 订阅此事件。 */
export const JOBS_TICK = "jobs:tick" as const;

export type JobsTickPayload = {
  /** tick 发出时的 Unix 毫秒时间戳 */
  at: number;
};
