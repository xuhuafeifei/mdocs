/**
 * session.json 路径级阻塞队列（对齐 agent-demo createSerialExecutor）+ 跨进程文件锁 + 原子写。
 *
 * 同一 metaPath 上：A.execute(读改写) 整段结束后 B 才能开始读，从根上消掉「读后被他人覆写」。
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

type Task<T> = () => Promise<T>;

/** 与 agent-demo `watch-dog/serial-sql.ts` 同构：Promise 链阻塞队列。 */
export function createSerialExecutor() {
  let chain: Promise<unknown> = Promise.resolve();

  const execute = <T>(task: Task<T>): Promise<T> => {
    const result = chain.then(task);
    chain = result.catch(() => undefined);
    return result;
  };

  return { execute };
}

const executorsByMetaPath = new Map<string, ReturnType<typeof createSerialExecutor>>();

function executorFor(metaPath: string) {
  let ex = executorsByMetaPath.get(metaPath);
  if (!ex) {
    ex = createSerialExecutor();
    executorsByMetaPath.set(metaPath, ex);
  }
  return ex;
}

async function acquireLockFile(lockPath: string, attempts = 80): Promise<fs.promises.FileHandle> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fs.promises.open(lockPath, "wx");
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : "";
      if (code !== "EEXIST") throw err;
      await new Promise((r) => setTimeout(r, 15 + (i % 5) * 10));
    }
  }
  throw new Error(`session meta lock timeout: ${lockPath}`);
}

/**
 * 在 metaPath 的串行队列里跑 fn；队内再抢 session.json.lock（多进程）。
 * 所有会改 session 目录状态的操作应走这里（含 jsonl append + meta）。
 */
export async function withSessionMetaLock<T>(metaPath: string, fn: () => Promise<T>): Promise<T> {
  return executorFor(metaPath).execute(async () => {
    const lockPath = `${metaPath}.lock`;
    await fs.promises.mkdir(path.dirname(metaPath), { recursive: true });
    const fh = await acquireLockFile(lockPath);
    try {
      return await fn();
    } finally {
      await fh.close().catch(() => undefined);
      await fs.promises.unlink(lockPath).catch(() => undefined);
    }
  });
}

/** 先写临时文件再 rename，避免读到半截 JSON。 */
export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp.${process.pid}.${randomUUID()}`;
  const body = JSON.stringify(value, null, 2);
  try {
    await fs.promises.writeFile(tmp, body, "utf8");
    await fs.promises.rename(tmp, filePath);
  } finally {
    await fs.promises.unlink(tmp).catch(() => undefined);
  }
}
