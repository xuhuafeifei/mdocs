import { describe, expect, it } from "vitest";
import {
  ensureJobFileContent,
  parseJobFileContent,
  serializeJobFile,
  defaultJobFileDocument,
} from "./job-file.js";

describe("job-file", () => {
  it("ensure empty → default with jobId", () => {
    const raw = ensureJobFileContent("", "doc-1");
    const doc = parseJobFileContent(raw);
    expect(doc.JobConfig.jobId).toBe("doc-1");
    expect(doc.JobConfig.jobType).toBe("agent");
    expect(doc.MonitorConfig).toEqual([]);
  });

  it("round-trip serialize", () => {
    const doc = defaultJobFileDocument("id");
    doc.JobConfig.cron = "0 0 9 * * *";
    const again = parseJobFileContent(serializeJobFile(doc));
    expect(again.JobConfig.cron).toBe("0 0 9 * * *");
  });
});
