import { startJobWatchdog } from "./watchdog";
import { startJobScanner } from "./scanner";

let bootstrapped = false;

/** 进程启动：触发器 + scanner 订阅 tick。 */
export function bootstrapJobs(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  startJobScanner();
  startJobWatchdog();
}

export { jobBus, JOBS_TICK, type JobsTickPayload } from "./events";
export { startJobWatchdog, stopJobWatchdog, isJobWatchdogStarted } from "./watchdog";
export { startJobScanner, stopJobScanner, scanDueJobs } from "./scanner";
export { enqueueJobExecution, cancelJobRun, JOB_RUN_TIMEOUT_MS } from "./executor";
export { runJobAgent } from "./agent/run-job-agent";
export {
  getJobFile,
  saveJobConfig,
  saveMonitorConfig,
} from "./job-config.service";
export {
  getJobRuns,
  getJobData,
  getJobRuntimeSnapshot,
  wrapJobContentWithRuntime,
  manualRunJob,
  cancelJobRunForDocument,
  JOB_STATUS,
} from "./job-run.service";
export type {
  JobAgentContext,
  JobAgentRunParams,
  JobAgentRunResult,
} from "./agent/types";
