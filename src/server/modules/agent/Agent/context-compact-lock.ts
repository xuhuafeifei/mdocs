/**
 * 单 session 压缩锁：`{sessionId}.jsonl.compact.lock`
 * 与 session.json meta 锁分离，避免 LLM 耗时期间堵死其它会话。
 */
import fs from "node:fs";
import path from "node:path";

export class SessionCompactingError extends Error {
  readonly code = "SESSION_COMPACTING";
  constructor(public readonly sessionId: string) {
    super("SESSION_COMPACTING");
    this.name = "SessionCompactingError";
  }
}

export function compactLockPathForJsonl(jsonlPath: string): string {
  return `${jsonlPath}.compact.lock`;
}

export function isSessionCompacting(jsonlPath: string): boolean {
  try {
    fs.accessSync(compactLockPathForJsonl(jsonlPath), fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function acquireCompactLock(
  jsonlPath: string,
  sessionId: string,
): Promise<() => Promise<void>> {
  const lockPath = compactLockPathForJsonl(jsonlPath);
  await fs.promises.mkdir(path.dirname(jsonlPath), { recursive: true });
  if (isSessionCompacting(jsonlPath)) {
    throw new SessionCompactingError(sessionId);
  }
  try {
    const fh = await fs.promises.open(lockPath, "wx");
    await fh.writeFile(
      JSON.stringify({ pid: process.pid, at: new Date().toISOString() }),
      "utf8",
    );
    await fh.close();
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code?: string }).code
        : "";
    if (code === "EEXIST") throw new SessionCompactingError(sessionId);
    throw err;
  }
  return async () => {
    await fs.promises.unlink(lockPath).catch(() => undefined);
  };
}

export function assertNotCompacting(jsonlPath: string, sessionId: string): void {
  if (isSessionCompacting(jsonlPath)) {
    throw new SessionCompactingError(sessionId);
  }
}
