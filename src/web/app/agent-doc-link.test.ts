import { describe, expect, it } from "vitest";
import { documentIdFromAgentHref } from "./agent-doc-link";

const id = "580e0778-4284-446f-b84f-a62f817942c9";

describe("documentIdFromAgentHref", () => {
  it("识别应用内文档链接", () => {
    expect(documentIdFromAgentHref(`#/doc/${id}`)).toBe(id);
    expect(documentIdFromAgentHref(`http://127.0.0.1:5173/#/doc/${id}`)).toBe(id);
  });

  it("外链不当成文档", () => {
    expect(documentIdFromAgentHref("https://example.com/notes")).toBeNull();
    expect(documentIdFromAgentHref(undefined)).toBeNull();
  });
});
