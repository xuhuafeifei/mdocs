import { describe, it, expect } from "vitest";
import { CODING_BLANK_DOC_KEY, docScopeKey } from "./session-manager.js";

describe("docScopeKey", () => {
  it("maps blank to stable key", () => {
    expect(docScopeKey(null)).toBe(CODING_BLANK_DOC_KEY);
    expect(docScopeKey(undefined)).toBe(CODING_BLANK_DOC_KEY);
    expect(docScopeKey("")).toBe(CODING_BLANK_DOC_KEY);
    expect(docScopeKey("  ")).toBe(CODING_BLANK_DOC_KEY);
  });

  it("keeps document id", () => {
    expect(docScopeKey("doc-a")).toBe("doc-a");
    expect(docScopeKey("  doc-a  ")).toBe("doc-a");
  });
});
