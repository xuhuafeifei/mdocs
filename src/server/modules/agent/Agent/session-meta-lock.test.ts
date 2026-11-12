import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  atomicWriteJson,
  createSerialExecutor,
  withSessionMetaLock,
} from "./session-meta-lock.js";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("session-meta-lock", () => {
  it("createSerialExecutor runs tasks strictly in order", async () => {
    const ex = createSerialExecutor();
    const order: number[] = [];
    await Promise.all([
      ex.execute(async () => {
        await new Promise((r) => setTimeout(r, 20));
        order.push(1);
      }),
      ex.execute(async () => {
        order.push(2);
      }),
      ex.execute(async () => {
        order.push(3);
      }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("withSessionMetaLock serializes read-modify-write (no lost update)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-meta-lock-"));
    tmpDirs.push(dir);
    const metaPath = path.join(dir, "session.json");
    await atomicWriteJson(metaPath, { n: 0 });

    await Promise.all(
      Array.from({ length: 20 }, () =>
        withSessionMetaLock(metaPath, async () => {
          const cur = JSON.parse(await fs.promises.readFile(metaPath, "utf8")) as { n: number };
          await new Promise((r) => setTimeout(r, 2));
          await atomicWriteJson(metaPath, { n: cur.n + 1 });
        }),
      ),
    );

    const final = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { n: number };
    expect(final.n).toBe(20);
  });
});
