import { useLogger } from "../../infra/logger/logger";
import { jobBus, JOBS_TICK, type JobsTickPayload } from "./events";

const log = useLogger("jobs.watchdog");

const DEFAULT_INTERVAL_MS = 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

/**
 * 启动 Job 触发器：按固定间隔向 jobBus 发出 {@link JOBS_TICK}。
 * 幂等；重复调用不会叠多个 interval。
 */
export function startJobWatchdog(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  if (started) return;
  started = true;

  const tick = (): void => {
    const payload: JobsTickPayload = { at: Date.now() };
    jobBus.emit(JOBS_TICK, payload);
  };

  timer = setInterval(tick, intervalMs);
  // 不阻止进程退出
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  log.info("job watchdog started (interval=%dms)", intervalMs);
}

/** 停止触发器（测试或关闭用）。 */
export function stopJobWatchdog(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
  log.info("job watchdog stopped");
}

export function isJobWatchdogStarted(): boolean {
  return started;
}
