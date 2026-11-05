import { describe, expect, it, vi } from "vitest";
import { jobAppendDataTool } from "./tools-job-data.js";

describe("job_append_data", () => {
  it("validates and forwards points", async () => {
    const appendData = vi.fn(async () => undefined);
    const tool = jobAppendDataTool({
      jobId: "doc-1",
      jobRunningId: 7,
      visitorId: "v1",
      tableSchema: { x: "时间", y: "价格" },
      appendData,
    });

    const result = await tool.execute!("call-1", {
      points: [{ x: "2026-11-05", y: 12.5 }],
    });

    expect(appendData).toHaveBeenCalledWith([{ x: "2026-11-05", y: 12.5 }]);
    expect(result.details).toMatchObject({
      jobId: "doc-1",
      jobRunningId: 7,
      appended: 1,
    });
  });

  it("rejects non-finite y", async () => {
    const tool = jobAppendDataTool({
      jobId: "doc-1",
      jobRunningId: 7,
      visitorId: "v1",
      tableSchema: { x: "t", y: "p" },
      appendData: async () => undefined,
    });

    await expect(
      tool.execute!("c", { points: [{ x: "a", y: Number.NaN }] }),
    ).rejects.toThrow(/finite/);
  });
});
