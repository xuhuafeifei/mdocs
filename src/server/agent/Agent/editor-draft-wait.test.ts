import { describe, expect, it } from "vitest";
import {
  cancelVisitorEditorDrafts,
  resolveEditorDraft,
  waitForEditorDraft,
} from "./editor-draft-wait.js";

describe("editor-draft-wait", () => {
  it("resolves ok payload", async () => {
    const { requestId, promise } = waitForEditorDraft({
      visitorId: "v1",
      documentId: "d1",
      timeoutMs: 5000,
    });
    const payload = {
      status: "ok" as const,
      documentId: "d1",
      content: "# hi",
      contentFormat: "markdown" as const,
      source: "editor" as const,
      localBaseCommitId: "c1",
    };
    expect(resolveEditorDraft("v1", requestId, payload)).toEqual(payload);
    await expect(promise).resolves.toEqual(payload);
  });

  it("rejects wrong visitor / mismatch document", () => {
    const { requestId } = waitForEditorDraft({
      visitorId: "v1",
      documentId: "d1",
      timeoutMs: 5000,
    });
    expect(() =>
      resolveEditorDraft("other", requestId, {
        status: "unavailable",
        reason: "x",
      }),
    ).toThrow(/forbidden/);
    expect(() =>
      resolveEditorDraft("v1", requestId, {
        status: "ok",
        documentId: "other",
        content: "x",
        contentFormat: "markdown",
        source: "editor",
      }),
    ).toThrow(/mismatch/);
    cancelVisitorEditorDrafts("v1");
  });

  it("cancelVisitorEditorDrafts cancels wait", async () => {
    const { promise } = waitForEditorDraft({
      visitorId: "v1",
      documentId: "d1",
      timeoutMs: 5000,
    });
    cancelVisitorEditorDrafts("v1");
    await expect(promise).resolves.toEqual({ status: "cancelled" });
  });
});
