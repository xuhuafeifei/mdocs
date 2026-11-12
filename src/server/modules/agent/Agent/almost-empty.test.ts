import { describe, expect, it } from "vitest";
import { isAlmostEmptyDocumentText } from "./almost-empty.js";

describe("isAlmostEmptyDocumentText", () => {
  it("empty / whitespace", () => {
    expect(isAlmostEmptyDocumentText("")).toBe(true);
    expect(isAlmostEmptyDocumentText("  \n\t  ")).toBe(true);
  });

  it("single title line", () => {
    expect(isAlmostEmptyDocumentText("# 周报")).toBe(true);
    expect(isAlmostEmptyDocumentText("周报")).toBe(true);
  });

  it("title plus blank lines only", () => {
    expect(isAlmostEmptyDocumentText("# 周报\n\n\n")).toBe(true);
  });

  it("has real body", () => {
    expect(isAlmostEmptyDocumentText("# 周报\n\n今天做了三件事。")).toBe(false);
    expect(isAlmostEmptyDocumentText("第一段\n第二段")).toBe(false);
  });
});
