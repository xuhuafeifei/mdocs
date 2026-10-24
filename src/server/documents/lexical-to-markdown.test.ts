import { describe, it, expect } from "vitest";
import { markdownToLexicalJson } from "./markdown-to-lexical.js";
import { lexicalJsonToMarkdown } from "./lexical-to-markdown.js";

describe("lexicalJsonToMarkdown", () => {
  it("round-trips basic markdown structure", () => {
    const src = [
      "# Title",
      "",
      "Hello **bold** and *italic*.",
      "",
      "- a",
      "- b",
      "",
      "```js",
      "const x = 1;",
      "```",
      "",
    ].join("\n");
    const lexical = markdownToLexicalJson(src);
    const back = lexicalJsonToMarkdown(lexical);
    expect(back).toContain("# Title");
    expect(back).toContain("**bold**");
    expect(back).toMatch(/\*italic\*/);
    expect(back).toContain("- a");
    expect(back).toContain("```js");
    expect(back).toContain("const x = 1;");
  });

  it("returns non-json as-is", () => {
    expect(lexicalJsonToMarkdown("plain")).toBe("plain");
  });

  it("preserves link", () => {
    const lexical = markdownToLexicalJson("[mdocs](https://example.com)");
    const back = lexicalJsonToMarkdown(lexical);
    expect(back).toContain("[mdocs](https://example.com)");
  });

  it("preserves empty blockquote line (lone >)", () => {
    const src = [
      "师姐笑嘻嘻地转过头",
      "",
      ">",
      "",
      "我差点把早饭吐出来",
      "",
    ].join("\n");
    const lexical = markdownToLexicalJson(src);
    const parsed = JSON.parse(lexical) as {
      root: { children: Array<{ type: string; children?: unknown[] }> };
    };
    const quote = parsed.root.children.find((c) => c.type === "quote");
    expect(quote).toBeTruthy();
    // 须有空 paragraph，避免 Lexical 丢掉无子 quote
    expect(Array.isArray(quote?.children) && quote!.children!.length > 0).toBe(true);

    const back = lexicalJsonToMarkdown(lexical);
    expect(back).toMatch(/^>$/m);

    // replace 场景：改别处不应吃掉空引用
    const replaced = back.replace("师姐笑嘻嘻地转过头", "师姐回头");
    const back2 = lexicalJsonToMarkdown(markdownToLexicalJson(replaced));
    expect(back2).toMatch(/^>$/m);
    expect(back2).toContain("师姐回头");
  });

  it("listitem with bare text children (no paragraph) keeps content", () => {
    // 复现 Part2：Lobe 存盘常见 listitem → text*，无 paragraph 包裹
    const lex = JSON.stringify({
      root: {
        type: "root",
        children: [
          {
            type: "heading",
            tag: "h3",
            children: [
              { type: "text", text: "第十九幕", format: 1, mode: "normal", style: "", detail: 0, version: 1 },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            version: 1,
          },
          {
            type: "list",
            listType: "bullet",
            tag: "ul",
            start: 1,
            children: [
              {
                type: "listitem",
                value: 1,
                children: [
                  { type: "text", text: "地点", format: 1, mode: "normal", style: "", detail: 0, version: 1 },
                  { type: "text", text: "：客厅。", format: 0, mode: "normal", style: "", detail: 0, version: 1 },
                ],
                direction: "ltr",
                format: "",
                indent: 0,
                version: 1,
              },
              {
                type: "listitem",
                value: 2,
                children: [
                  { type: "text", text: "事件", format: 1, mode: "normal", style: "", detail: 0, version: 1 },
                  { type: "text", text: " ：", format: 0, mode: "normal", style: "", detail: 0, version: 1 },
                  {
                    type: "list",
                    listType: "number",
                    tag: "ol",
                    start: 1,
                    children: [
                      {
                        type: "listitem",
                        value: 1,
                        children: [
                          { type: "text", text: "折返发现", format: 1, mode: "normal", style: "", detail: 0, version: 1 },
                          {
                            type: "text",
                            text: "：北雁折返。",
                            format: 0,
                            mode: "normal",
                            style: "",
                            detail: 0,
                            version: 1,
                          },
                        ],
                        direction: "ltr",
                        format: "",
                        indent: 1,
                        version: 1,
                      },
                    ],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    version: 1,
                  },
                ],
                direction: "ltr",
                format: "",
                indent: 0,
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        version: 1,
      },
    });
    const md = lexicalJsonToMarkdown(lex);
    expect(md).toContain("地点");
    expect(md).toContain("客厅");
    expect(md).toContain("折返发现");
    expect(md).toContain("北雁折返");
    expect(md).not.toMatch(/^-\s*$/m);
  });

  it("exports quote with empty children as >", () => {
    const lex = JSON.stringify({
      root: {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "A", format: 0, mode: "normal", style: "", detail: 0, version: 1 }],
            direction: "ltr",
            format: "",
            indent: 0,
            version: 1,
          },
          { type: "quote", children: [], direction: "ltr", format: "", indent: 0, version: 1 },
          {
            type: "paragraph",
            children: [{ type: "text", text: "B", format: 0, mode: "normal", style: "", detail: 0, version: 1 }],
            direction: "ltr",
            format: "",
            indent: 0,
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        version: 1,
      },
    });
    expect(lexicalJsonToMarkdown(lex)).toMatch(/\n>\n/);
  });
});
