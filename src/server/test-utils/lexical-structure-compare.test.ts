/**
 * 结构对比器自检（与业务代码无关）。
 */
import { describe, expect, it } from "vitest";
import {
  compareLexicalStructure,
  extractCodeSource,
} from "./lexical-structure-compare.js";

describe("compareLexicalStructure", () => {
  it("完全一致时无差异", () => {
    const doc = {
      root: {
        type: "root",
        direction: "ltr",
        format: "",
        indent: 0,
        version: 1,
        children: [
          {
            type: "heading",
            tag: "h1",
            direction: "ltr",
            format: "",
            indent: 0,
            version: 1,
            children: [
              {
                type: "text",
                text: "Hi",
                version: 1,
                format: 0,
                detail: 0,
                mode: "normal",
                style: "",
              },
            ],
          },
        ],
      },
    };
    expect(compareLexicalStructure(doc, doc)).toEqual([]);
  });

  it("text 内容不同则报告", () => {
    const a = {
      root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: "x" }] }] },
    };
    const b = {
      root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: "y" }] }] },
    };
    expect(compareLexicalStructure(a, b).some((s) => s.includes(".text"))).toBe(true);
  });

  it("子节点个数不同则报告", () => {
    const a = {
      root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: "a" }] }] },
    };
    const b = {
      root: {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "a" },
              { type: "text", text: "b" },
            ],
          },
        ],
      },
    };
    expect(compareLexicalStructure(a, b).some((s) => s.includes("children.length"))).toBe(true);
  });

  it("code：golden 用 code 字段、actual 用 children text 时只比源码", () => {
    const golden = {
      root: {
        type: "root",
        children: [{ type: "code", code: "console.log(1);", language: "js", version: 1 }],
      },
    };
    const actual = {
      root: {
        type: "root",
        children: [
          {
            type: "code",
            language: "js",
            children: [{ type: "text", text: "console.log(1);" }],
          },
        ],
      },
    };
    expect(compareLexicalStructure(golden, actual)).toEqual([]);
    const codeNode = (golden as { root: { children: Record<string, unknown>[] } }).root.children[0]!;
    expect(extractCodeSource(codeNode)).toBe("console.log(1);");
  });
});
