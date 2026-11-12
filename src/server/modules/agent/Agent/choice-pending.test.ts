import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cancelVisitorChoices,
  expireUserChoice,
  resolveUserChoice,
  waitForUserChoice,
} from "./choice-pending.js";

describe("choice-pending", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with selected choice string", async () => {
    const { requestId, promise } = waitForUserChoice({
      visitorId: "v1",
      timeoutMs: 60_000,
    });
    const settled = promise.then((r) => r);
    resolveUserChoice("v1", requestId, "  打开帮写  ");
    await expect(settled).resolves.toEqual({
      status: "selected",
      choice: "打开帮写",
    });
  });

  it("times out", async () => {
    const { promise } = waitForUserChoice({
      visitorId: "v1",
      timeoutMs: 15_000,
    });
    const settled = promise.then((r) => r);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(settled).resolves.toEqual({ status: "timeout" });
  });

  it("expireUserChoice from frontend", async () => {
    const { requestId, promise } = waitForUserChoice({
      visitorId: "v1",
      timeoutMs: 60_000,
    });
    const settled = promise.then((r) => r);
    expireUserChoice("v1", requestId);
    await expect(settled).resolves.toEqual({ status: "timeout" });
  });

  it("cancelVisitorChoices cancels pending", async () => {
    const { promise } = waitForUserChoice({
      visitorId: "v1",
      timeoutMs: 60_000,
    });
    const settled = promise.then((r) => r);
    cancelVisitorChoices("v1");
    await expect(settled).resolves.toEqual({ status: "cancelled" });
  });

  it("rejects empty choice", () => {
    const { requestId } = waitForUserChoice({
      visitorId: "v1",
      timeoutMs: 60_000,
    });
    expect(() => resolveUserChoice("v1", requestId, "  ")).toThrow("choice_empty");
    cancelVisitorChoices("v1");
  });
});
