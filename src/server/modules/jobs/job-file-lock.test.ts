import { describe, expect, it } from "vitest";
import { withJobFileLock } from "./job-file-lock.js";

describe("withJobFileLock", () => {
  it("runs same jobId serially", async () => {
    const order: number[] = [];
    const a = withJobFileLock("j1", async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 30));
      order.push(2);
      return "a";
    });
    const b = withJobFileLock("j1", async () => {
      order.push(3);
      return "b";
    });
    await expect(Promise.all([a, b])).resolves.toEqual(["a", "b"]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("allows different jobIds in parallel", async () => {
    let released = false;
    const slow = withJobFileLock("j-a", async () => {
      await new Promise((r) => setTimeout(r, 40));
      released = true;
      return 1;
    });
    const fast = withJobFileLock("j-b", async () => {
      expect(released).toBe(false);
      return 2;
    });
    await expect(Promise.all([slow, fast])).resolves.toEqual([1, 2]);
  });
});
