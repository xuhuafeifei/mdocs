/**
 * 任务队列核心类型定义。
 */

/* ── 调度协作接口（任务视角） ── */

export interface TaskScheduler {
  /** 询问调度器：我该让出了吗？
   *  满足两个条件返回 true：
   *  1. 队列长度 > concurrency（有人在排队）
   *  2. 当前任务已连续运行超过 timeSliceMs
   */
  shouldYield(): boolean;

  /** 主动让出时间片。
   *  任务移到队尾，返回 pending Promise。
   *  等任务重新排到前 concurrency 位置时，Promise resolve。
   */
  yield(): Promise<void>;
}

/* ── 通用事件上下文（框架内部用） ── */

export type LogLevel = 'info' | 'warn' | 'error';

export interface TaskContext {
  readonly taskId: string;
  readonly scheduler: TaskScheduler;
  emit(event: string, data?: any, level?: LogLevel): void;
}

/* ── 日志行 ── */

export interface LogEntry {
  ts: string;       // ISO 时间戳
  event: string;    // 事件名，点分层级
  data?: any;       // 事件数据
  level: LogLevel;  // 日志级别
}

/* ── 任务状态（调度器视角） ── */

export type TaskState =
  | 'queued'     // 还没开始过，在队列里等
  | 'running'    // 正在执行
  | 'suspended'  // yield 挂起了，还在队列里
  | 'completed'  // 正常完成
  | 'failed';    // 失败了

export interface BackgroundTask<P = any> {
  id: string;
  type: string;
  payload: P;
  state: TaskState;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  lastRunAt?: number;  // 最近一次开始/恢复运行的时间

  // 运行时
  run?: (payload: P, ctx: TaskContext) => Promise<void>;
  resume?: () => void;  // yield 挂起后恢复的回调
}

/* ── 任务定义（注册时用） ── */

export interface TaskDefinition<P> {
  /** 根据 payload 生成任务 ID（同时也是去重键） */
  makeId: (payload: P) => string;
  /** 任务执行函数 */
  run: (payload: P, ctx: TaskContext) => Promise<void>;
}

/* ── 对外 API 返回类型 ── */

export interface EnqueueResult {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  position: number;   // 0 = 正在跑
  deduped: boolean;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stale' | 'not_found';

export interface TaskStatusResult {
  id: string;
  type: string;
  status: TaskStatus;
  position: number;
  progress?: { current: number; total: number };
  logs: LogEntry[];
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}
