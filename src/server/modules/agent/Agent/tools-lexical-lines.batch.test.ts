import { describe, expect, it } from "vitest";
import { batchUpdateSlotsTool } from "./tools-lexical-lines.js";

describe("batch_update_slots tool", () => {
  const tool = batchUpdateSlotsTool({
    visitorId: "v1",
    uiDocumentId: "doc-open",
    onEvent: () => {},
  });

  it("queues sorted non-overlapping ranges", async () => {
    const result = await tool.execute(
      "id",
      {
        ranges: [
          { start: 10, end: 12, markdown: "b" },
          { start: 3, end: 5, markdown: "a\n\nx" },
        ],
      } as never,
      undefined as never,
      undefined as never,
    );
    const details = (result as { details?: Record<string, unknown> }).details;
    expect(details?.op).toBe("batch_update_slots");
    expect(details?.documentId).toBe("doc-open");
    expect(details?.ranges).toEqual([
      { start: 3, end: 5, markdown: "a\n\nx" },
      { start: 10, end: 12, markdown: "b" },
    ]);
  });

  it("rejects overlapping ranges", async () => {
    await expect(
      tool.execute(
        "id",
        {
          ranges: [
            { start: 3, end: 8, markdown: "a" },
            { start: 8, end: 10, markdown: "b" },
          ],
        } as never,
        undefined as never,
        undefined as never,
      ),
    ).rejects.toThrow(/overlap/);
  });
});
