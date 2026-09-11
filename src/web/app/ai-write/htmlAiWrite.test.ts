import { describe, expect, it } from "vitest";
import { aiWriteResultToHtml, htmlToAiWriteSeed } from "./htmlAiWrite";

describe("htmlAiWrite", () => {
  it("seed and writeback are raw html", () => {
    expect(htmlToAiWriteSeed("  <p>hi</p>\n")).toBe("<p>hi</p>");
    expect(aiWriteResultToHtml("  <div>x</div>  ")).toBe("<div>x</div>");
  });
});
