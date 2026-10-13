import { describe, expect, it } from "vitest";
import { getNowTool } from "./tools-time.js";

describe("getNowTool", () => {
  it("returns iso, epochMs, timeZone, weekday, local", async () => {
    const tool = getNowTool();
    expect(tool.name).toBe("get_now");
    const before = Date.now();
    const result = await tool.execute("t1", {});
    const after = Date.now();
    const details = result.details as {
      iso: string;
      epochMs: number;
      timeZone: string;
      weekday: string;
      local: string;
    };
    expect(details.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(details.epochMs).toBeGreaterThanOrEqual(before);
    expect(details.epochMs).toBeLessThanOrEqual(after);
    expect(details.timeZone.length).toBeGreaterThan(0);
    expect(details.weekday.length).toBeGreaterThan(0);
    expect(details.local).toContain(details.weekday);
    expect(result.content[0]?.type).toBe("text");
  });
});
