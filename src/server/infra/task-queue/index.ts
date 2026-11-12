/**
 * 任务队列单例。
 *
 * 全局只有一个 TaskQueue 实例，所有任务类型共享同一个并发池。
 */
import path from 'node:path';
import os from 'node:os';
import { TaskQueue } from './TaskQueue.js';

const dataDir = process.env.MDOCS_DATA_DIR || path.join(os.homedir(), '.mdocs');
const logDir = path.join(dataDir, 'task-logs');

export const taskQueue = new TaskQueue({
  concurrency: 2,
  timeSliceMs: 30_000,
  logDir,
});

export { TaskQueue } from './TaskQueue.js';
export * from './types.js';
