import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function sha256Hex(data: Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function objectPath(objectsDir: string, sha256: string): string {
  return path.join(objectsDir, sha256);
}

/** 内容寻址写入；已存在则跳过。 */
export async function putObject(
  objectsDir: string,
  data: Uint8Array,
): Promise<string> {
  await fs.promises.mkdir(objectsDir, { recursive: true, mode: 0o700 });
  const sha = sha256Hex(data);
  const dest = objectPath(objectsDir, sha);
  try {
    await fs.promises.access(dest);
    return sha;
  } catch {
    /* not exists */
  }
  const tmp = path.join(
    objectsDir,
    `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  await fs.promises.writeFile(tmp, data, { mode: 0o600 });
  try {
    await fs.promises.rename(tmp, dest);
  } catch (err) {
    await fs.promises.unlink(tmp).catch(() => undefined);
    // 竞态：另一写者已落盘
    try {
      await fs.promises.access(dest);
      return sha;
    } catch {
      throw err;
    }
  }
  return sha;
}

export async function readObject(
  objectsDir: string,
  sha256: string,
): Promise<Uint8Array> {
  const buf = await fs.promises.readFile(objectPath(objectsDir, sha256));
  return new Uint8Array(buf);
}
