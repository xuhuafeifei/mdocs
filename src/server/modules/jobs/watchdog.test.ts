import { afterEach, describe, expect, it, vi } from "vitest";
import { jobBus, JOBS_TICK } from "./events.js";
import { isJobWatchdogStarted, startJobWatchdog, stopJobWatchdog } from "./watchdog.js";

describe("job watchdog", () => {
  afterEach(() => {
    stopJobWatchdog();
    jobBus.removeAllListeners(JOBS_TICK);
  });

  it("emits jobs:tick on interval", async () => {
    vi.useFakeTimers();
    const received: number[] = [];
    jobBus.on(JOBS_TICK, (p: { at: number }) => {
      received.push(p.at);
    });

    startJobWatchdog(1000);
    expect(isJobWatchdogStarted()).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(received.length).toBe(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(received.length).toBe(3);

    // 幂等：不会双重 interval
    startJobWatchdog(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(received.length).toBe(4);

    vi.useRealTimers();
  });
});
