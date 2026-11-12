/**
 * 按 jobId（documentId）串行化对 `.job` 文件的读改写，避免配置接口并发互盖。
 * 进程内 Promise 链；不跨进程。
 */
const tails = new Map<string, Promise<unknown>>();

export function withJobFileLock<T>(
  jobId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const prev = tails.get(jobId) ?? Promise.resolve();
  const run = prev.then(
    () => fn(),
    () => fn(),
  );
  tails.set(
    jobId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}
