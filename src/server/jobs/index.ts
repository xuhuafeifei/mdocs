import { startJobWatchdog } from "./watchdog.js";

let bootstrapped = false;

/** 进程启动时挂上 Job 调度（触发器）；后续 scanner / executor 在此扩展。 */
export function bootstrapJobs(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  startJobWatchdog();
}

export { jobBus, JOBS_TICK, type JobsTickPayload } from "./events.js";
export { startJobWatchdog, stopJobWatchdog, isJobWatchdogStarted } from "./watchdog.js";
