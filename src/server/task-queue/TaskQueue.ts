/**
 * 协作式任务队列。
 *
 * 模型：单队列 + 并发数。前 concurrency 个任务活跃（在跑 / 该被跑），后面的排队。
 * 任务可主动 yield()，移到队尾挂起，等排到前面再恢复。
 */
import type {
  BackgroundTask,
  EnqueueResult,
  TaskContext,
  TaskDefinition,
  TaskScheduler,
  TaskStatus,
  TaskStatusResult,
} from './types.js';
import { TaskLogStore } from './log-store.js';

export interface TaskQueueOptions {
  concurrency?: number;
  timeSliceMs?: number;
  logDir: string;
}

export class TaskQueue {
  private readonly taskTypes = new Map<string, TaskDefinition<any>>();
  private queue: BackgroundTask[] = [];
  private readonly concurrency: number;
  private readonly timeSliceMs: number;
  private readonly logStore: TaskLogStore;
  private scheduling = false;  // 防止 schedule 重入

  constructor(options: TaskQueueOptions) {
    this.concurrency = options.concurrency ?? 2;
    this.timeSliceMs = options.timeSliceMs ?? 30_000;
    this.logStore = new TaskLogStore(options.logDir);
  }

  /* ── 注册任务类型 ── */

  registerTask<P>(type: string, def: TaskDefinition<P>): void {
    this.taskTypes.set(type, def);
  }

  /* ── 入队 ── */

  enqueue(type: string, payload: any): EnqueueResult {
    const def = this.taskTypes.get(type);
    if (!def) {
      throw new Error(`未知任务类型：${type}`);
    }

    const taskId = def.makeId(payload);

    // 检查是否已有未完成的同 ID 任务（去重）
    const existing = this.queue.find(
      (t) => t.id === taskId && t.state !== 'completed' && t.state !== 'failed',
    );
    if (existing) {
      return {
        taskId,
        status: this.getPublicStatus(existing),
        position: this.getPosition(existing),
        deduped: true,
      };
    }

    // 移除旧的 completed/failed 任务（重新生成，覆盖）
    this.queue = this.queue.filter((t) => t.id !== taskId);

    // 创建新任务
    const task: BackgroundTask = {
      id: taskId,
      type,
      payload,
      state: 'queued',
      createdAt: Date.now(),
    };
    this.queue.push(task);

    // 重置日志文件（重新开始写）
    this.logStore.reset(taskId);

    // 触发调度
    this.schedule();

    return {
      taskId,
      status: this.getPublicStatus(task),
      position: this.getPosition(task),
      deduped: false,
    };
  }

  /* ── 查询任务状态 ── */

  getTask(taskId: string): TaskStatusResult {
    const task = this.queue.find((t) => t.id === taskId);

    // 从日志推断进度
    const logs = this.logStore.readTail(taskId, 50);
    const progress = this.extractProgress(logs);
    const lastLog = logs[logs.length - 1];

    // 任务在队列中
    if (task) {
      return {
        id: task.id,
        type: task.type,
        status: this.getPublicStatus(task),
        position: this.getPosition(task),
        progress,
        logs,
        error: task.error,
        createdAt: new Date(task.createdAt).toISOString(),
        startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : undefined,
        finishedAt: task.finishedAt ? new Date(task.finishedAt).toISOString() : undefined,
      };
    }

    // 任务不在队列中（可能重启了，或已完成很久了）
    const mtime = this.logStore.getMtime(taskId);

    // 日志都没有 → not_found
    if (!mtime) {
      return {
        id: taskId,
        type: '',
        status: 'not_found',
        position: -1,
        logs: [],
        createdAt: '',
      };
    }

    // 从最后一条日志判断状态
    let status: TaskStatus = 'stale';
    let error: string | undefined;

    if (lastLog?.event === 'task.completed') {
      status = 'completed';
    } else if (lastLog?.event === 'task.failed') {
      status = 'failed';
      error = lastLog.data?.error;
    } else if (Date.now() - mtime > 5 * 60 * 1000) {
      // 超过 5 分钟没更新 → stale
      status = 'stale';
    } else {
      // 5 分钟内有更新，但队列里没了 → 大概率刚重启，也算 stale
      status = 'stale';
    }

    return {
      id: taskId,
      type: '',
      status,
      position: -1,
      progress,
      logs,
      error,
      createdAt: '',
      startedAt: '',
      finishedAt: lastLog ? lastLog.ts : undefined,
    };
  }

  /* ── 调度核心 ── */

  private schedule(): void {
    // 防重入：同步代码中多次调用 schedule，只执行一次
    if (this.scheduling) return;
    this.scheduling = true;

    // 用 setImmediate 让当前同步代码先跑完，再统一调度
    setImmediate(() => {
      this.scheduling = false;
      this.doSchedule();
    });
  }

  private doSchedule(): void {
    // 1. 先清理已完成/失败的任务
    this.queue = this.queue.filter(
      (t) => t.state !== 'completed' && t.state !== 'failed',
    );

    // 2. 确保前 concurrency 个位置上的任务都在跑
    for (let i = 0; i < this.concurrency && i < this.queue.length; i++) {
      const task = this.queue[i];
      if (!task) continue;

      if (task.state === 'queued') {
        // 还没开始过 → 启动
        this.startTask(task);
      } else if (task.state === 'suspended') {
        // yield 挂起了 → 恢复
        this.resumeTask(task);
      }
      // running 不用管，它自己在跑
    }
  }

  /* ── 启动 / 恢复任务 ── */

  private startTask(task: BackgroundTask): void {
    const def = this.taskTypes.get(task.type);
    if (!def) return;

    task.state = 'running';
    task.startedAt = task.startedAt ?? Date.now();
    task.lastRunAt = Date.now();

    const ctx = this.createContext(task);
    task.run = def.run;

    def.run(task.payload, ctx)
      .then(() => {
        task.state = 'completed';
        task.finishedAt = Date.now();
        this.logStore.append(task.id, 'task.completed');
        this.schedule();
      })
      .catch((err: Error) => {
        task.state = 'failed';
        task.error = err.message;
        task.finishedAt = Date.now();
        // 写一条失败日志
        this.logStore.append(task.id, 'task.failed', { error: err.message }, 'error');
        this.schedule();
      });
  }

  private resumeTask(task: BackgroundTask): void {
    if (task.state !== 'suspended' || !task.resume) return;

    task.state = 'running';
    task.lastRunAt = Date.now();

    const resume = task.resume;
    task.resume = undefined;
    resume();
  }

  /* ── 创建上下文 ── */

  private createContext(task: BackgroundTask): TaskContext {
    const scheduler = this.createScheduler(task);

    return {
      taskId: task.id,
      scheduler,
      emit: (event, data, level) => {
        this.logStore.append(task.id, event, data, level);
      },
    };
  }

  private createScheduler(task: BackgroundTask): TaskScheduler {
    return {
      shouldYield: (): boolean => {
        // 没人排队 → 没必要让
        if (this.queue.length <= this.concurrency) return false;
        // 时间片还没到 → 不让
        if (!task.lastRunAt || Date.now() - task.lastRunAt < this.timeSliceMs) return false;
        return true;
      },

      yield: (): Promise<void> => {
        return new Promise<void>((resolve) => {
          // 存 resume 回调
          task.resume = resolve;
          task.state = 'suspended';

          // 写一条 yielded 日志
          this.logStore.append(task.id, 'task.yielded', { reason: 'time-slice' });

          // 从当前位置移除，塞到队尾
          this.queue = this.queue.filter((t) => t.id !== task.id);
          this.queue.push(task);

          // 触发调度（前面空位会被顶上）
          this.schedule();
        });
      },
    };
  }

  /* ── 辅助方法 ── */

  private getPublicStatus(task: BackgroundTask | undefined): 'pending' | 'running' | 'completed' | 'failed' {
    if (!task) return 'pending';
    if (task.state === 'completed') return 'completed';
    if (task.state === 'failed') return 'failed';

    const index = this.queue.indexOf(task);
    if (index < this.concurrency) return 'running';
    return 'pending';
  }

  private getPosition(task: BackgroundTask | undefined): number {
    if (!task) return -1;
    const index = this.queue.indexOf(task);
    if (index < this.concurrency) return 0; // 0 表示正在跑
    return index - this.concurrency + 1; // 排队位置：1 = 下一个就轮到
  }

  private extractProgress(logs: any[]): { current: number; total: number } | undefined {
    // 从日志里找最后一条 task.progress
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].event === 'task.progress' && logs[i].data) {
        return { current: logs[i].data.current, total: logs[i].data.total };
      }
    }
    return undefined;
  }
}
