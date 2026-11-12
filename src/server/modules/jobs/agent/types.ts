/** 一次 Job 运行注入给 Agent 的上下文（可扩展字段，勿破坏已有键）。 */
export type JobAgentContext = {
  jobId: string;
  jobRunningId: number;
  tableSchema: { x: string; y: string };
  /** 文档 owner；用于取模型配置 / DeepSeek web */
  visitorId: string;
  /**
   * 写入产出点。一期由 executor 绑到 SQLite；
   * 未接库前也可注入内存实现便于单测。
   */
  appendData: (points: Array<{ x: string; y: number }>) => void | Promise<void>;
};

export type JobAgentRunParams = {
  ctx: JobAgentContext;
  /** 用户配置的任务提示词 */
  prompt: string;
  signal?: AbortSignal;
};

export type JobAgentRunResult = {
  ok: boolean;
  errorMessage?: string;
};
