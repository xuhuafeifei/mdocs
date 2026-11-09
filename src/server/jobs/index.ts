import { startJobWatchdog } from "./watchdog.js";
import { startJobScanner } from "./scanner.js";

let bootstrapped = false;

/** 进程启动：触发器 + scanner 订阅 tick。 */
export function bootstrapJobs(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  startJobScanner();
  startJobWatchdog();
}

export { jobBus, JOBS_TICK, type JobsTickPayload } from "./events.js";
export { startJobWatchdog, stopJobWatchdog, isJobWatchdogStarted } from "./watchdog.js";
export { startJobScanner, stopJobScanner, scanDueJobs } from "./scanner.js";
export { enqueueJobExecution, cancelJobRun, JOB_RUN_TIMEOUT_MS } from "./executor.js";
export { runJobAgent } from "./agent/run-job-agent.js";
export {
  getJobFile,
  saveJobConfig,
  saveMonitorConfig,
} from "./job-config.service.js";
export {
  getJobRuns,
  getJobData,
  manualRunJob,
  cancelJobRunForDocument,
  JOB_STATUS,
} from "./job-run.service.js";
export type {
  JobAgentContext,
  JobAgentRunParams,
  JobAgentRunResult,
} from "./agent/types.js";
