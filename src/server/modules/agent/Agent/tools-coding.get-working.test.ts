import { describe, it, expect } from "vitest";
import { getWorkingDocumentTool } from "./tools-coding.js";

async function runGetWorking(params: Record<string, unknown> = {}) {
  const tool = getWorkingDocumentTool({
    visitorId: "v1",
    onEvent: () => {},
    coding: {
      documentId: "doc-1",
      workingMarkdown: "# working\nhello",
      baseMarkdown: "# base\nold",
    },
  });
  return tool.execute("call-1", params as never, undefined as never, undefined as never);
}

describe("get_working_document", () => {
  it("returns both base and working by default", async () => {
    const result = await runGetWorking();
    const details = result.details as {
      documentId: string;
      workingMarkdown: string;
      baseMarkdown: string;
      source: string;
    };
    expect(details.documentId).toBe("doc-1");
    expect(details.source).toBe("request_body");
    expect(details.workingMarkdown).toContain("working");
    expect(details.baseMarkdown).toContain("base");
  });

  it("can return only working", async () => {
    const result = await runGetWorking({ which: "working" });
    const details = result.details as Record<string, unknown>;
    expect(details.workingMarkdown).toBeDefined();
    expect(details.baseMarkdown).toBeUndefined();
  });
});
