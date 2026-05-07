/**
 * Markdown → Lexical 转换单元测试。
 */
import { describe, expect, it } from "vitest";
import { markdownToLexicalJson } from "./markdown-to-lexical.js";

const TEXT_BOLD = 1;
const TEXT_ITALIC = 2;
const TEXT_CODE = 16;

/**
 * Lexical SerializedEditorState：JSON 顶层**只有键 `root`**（值为 `type: "root"` 的根节点）。
 * `markdownToLexicalJson()` 序列化的就是此形状。
 */
type SerializedLexicalFromMarkdown = {
  root: { type: "root"; children: unknown[] } & Record<string, unknown>;
};

/** 等价于 `JSON.parse(markdownToLexicalJson(md))`，得到 `{ root }` */
function parseSerializedLexical(markdown: string): SerializedLexicalFromMarkdown {
  return JSON.parse(markdownToLexicalJson(markdown)) as SerializedLexicalFromMarkdown;
}

function tableCellPlainText(cell: {
  children?: { type?: string; text?: string }[];
}): string {
  return (
    cell.children
      ?.filter((n) => n.type === "text")
      .map((n) => n.text ?? "")
      .join("") ?? ""
  );
}

type LexTablerow = {
  type: string;
  children: Array<{
    type: string;
    children?: { type?: string; text?: string }[];
  }>;
};

describe("markdownToLexicalJson", () => {
  it("输出带 root 的 SerializedEditorState 外形", () => {
    const doc = parseSerializedLexical("");
    expect(Object.keys(doc)).toEqual(["root"]);
    expect(doc.root.type).toBe("root");
    expect(Array.isArray(doc.root.children)).toBe(true);
    expect(doc.root.children).toEqual([]);
  });

  it("标题：depth → h1…h6", () => {
    const { root } = parseSerializedLexical("## Sub");
    expect(root.children).toHaveLength(1);
    const h = root.children[0] as {
      type: string;
      tag: string;
      children: { text: string }[];
    };
    expect(h.type).toBe("heading");
    expect(h.tag).toBe("h2");
    expect(h.children[0]!.text).toBe("Sub");
  });

  it("段落内粗体、斜体（format 位）", () => {
    const { root } = parseSerializedLexical("a **bold** and *italic*.");
    const p = root.children[0] as {
      type: string;
      children: { type: string; text: string; format: number }[];
    };
    expect(p.type).toBe("paragraph");
    const fmts = p.children.map((c) => c.format);
    expect(fmts).toContain(TEXT_BOLD);
    expect(fmts).toContain(TEXT_ITALIC);
    const bold = p.children.find((c) => c.text === "bold");
    expect(bold).toBeDefined();
    expect((bold!.format ?? 0) & TEXT_BOLD).toBe(TEXT_BOLD);
    const italic = p.children.find((c) => c.text === "italic");
    expect(italic).toBeDefined();
    expect((italic!.format ?? 0) & TEXT_ITALIC).toBe(TEXT_ITALIC);
  });

  it("行内代码：format 含 TEXT_CODE", () => {
    const { root } = parseSerializedLexical("use `x` here");
    const p = root.children[0] as {
      children: { text: string; format: number }[];
    };
    const code = p.children.find((c) => c.text === "x");
    expect(code).toBeDefined();
    expect((code!.format ?? 0) & TEXT_CODE).toBe(TEXT_CODE);
  });

  it("删除线：strikethrough 位", () => {
    const { root } = parseSerializedLexical("~~gone~~");
    const p = root.children[0] as {
      children: { text: string; format: number }[];
    };
    const t = p.children.find((c) => c.text === "gone");
    expect(t).toBeDefined();
    expect(((t!.format ?? 0) & 4) === 4).toBe(true);
  });

  it("链接：link 节点 + url", () => {
    const { root } = parseSerializedLexical("[Lobe Editor](https://editor.lobehub.com)");
    const p = root.children[0] as {
      children: { type: string; url?: string; children?: { text: string }[] }[];
    };
    const link = p.children.find((c) => c.type === "link");
    expect(link?.url).toBe("https://editor.lobehub.com");
    expect(link?.children?.[0]?.text).toBe("Lobe Editor");
  });

  it(" fenced 代码块：type code + language", () => {
    const { root } = parseSerializedLexical(
      "```typescript\nimport { Editor } from '@lobehub/editor';\n```",
    );
    const block = root.children[0] as {
      type: string;
      language: string | null;
      children: { type: string; text: string }[];
    };
    expect(block.type).toBe("code");
    expect(block.language).toBe("typescript");
    expect(block.children[0]!.text).toContain("@lobehub/editor");
  });

  it("blockquote：quote 内含 paragraph", () => {
    const { root } = parseSerializedLexical("> quote line");
    const q = root.children[0] as {
      type: string;
      children: { type: string; children: { text: string }[] }[];
    };
    expect(q.type).toBe("quote");
    expect(q.children[0]!.type).toBe("paragraph");
    expect(q.children[0]!.children[0]!.text).toBe("quote line");
  });

  it("无序列表：bullet list + listitem + paragraph", () => {
    const { root } = parseSerializedLexical("- one\n- two");
    const list = root.children[0] as {
      type: string;
      listType: string;
      children: { type: string; children: unknown[] }[];
    };
    expect(list.type).toBe("list");
    expect(list.listType).toBe("bullet");
    expect(list.children).toHaveLength(2);
    expect(list.children[0]!.type).toBe("listitem");
  });

  it("有序列表：listType number + start", () => {
    const { root } = parseSerializedLexical("3. third");
    const list = root.children[0] as { listType: string; start: number };
    expect(list.listType).toBe("number");
    expect(list.start).toBe(3);
  });

  it("horizontal rule", () => {
    const { root } = parseSerializedLexical("---");
    expect((root.children[0] as { type: string }).type).toBe("horizontalrule");
  });

  it("GFM 表格：table / tablerow / tablecell", () => {
    const { root } = parseSerializedLexical("|a|b|\n|---|---|");
    const table = root.children[0] as {
      type: string;
      colWidths: number[];
      children: { type: string }[];
    };
    expect(table.type).toBe("table");
    expect(table.colWidths).toEqual([412, 412]);
    expect(table.children[0]!.type).toBe("tablerow");
  });

  it("GFM 大表格：太阳系行星 Markdown（4 列、9 行、colWidths=floor(825/4)）", () => {
    const md = `| 行星名称 | 类型 | 平均直径（公里） | 主要特点 |
| :--- | :---: | ---: | :--- |
| 水星 | 岩石行星 | 4,879 | 温差最大，昼夜间约600℃ |
| 金星 | 岩石行星 | 12,104 | 自东向西逆向自转 |
| 地球 | 岩石行星 | 12,742 | 目前已知唯一存在生命的星球 |
| 火星 | 岩石行星 | 6,779 | 拥有太阳系最高的火山——奥林匹斯山 |
| 木星 | 气态巨行星 | 139,820 | 质量是其他七大行星总和的2.5倍 |
| 土星 | 气态巨行星 | 116,460 | 拥有美丽且宽大的光环系统 |
| 天王星 | 冰巨星 | 50,724 | 侧躺着绕太阳公转 |
| 海王星 | 冰巨星 | 49,244 | 风暴速度惊人，可达2100公里/小时 |
`;
    const doc = parseSerializedLexical(md);
    expect(Object.keys(doc)).toEqual(["root"]);
    // 调试：`pnpm vitest run ... markdown-to-lexical` 可看完整 SerializedEditorState（顶层键仅 `root`）
    console.log("[markdown planet table] SerializedEditorState:\n", JSON.stringify(doc, null, 2));
    const { root } = doc;
    expect(root.children).toHaveLength(1);
    const table = root.children[0] as {
      type: string;
      colWidths: number[];
      children: LexTablerow[];
    };
    expect(table.type).toBe("table");
    expect(table.colWidths).toEqual([206, 206, 206, 206]);
    expect(table.children).toHaveLength(9);
    for (const row of table.children) {
      expect(row.type).toBe("tablerow");
      expect(row.children).toHaveLength(4);
    }
    const header = table.children[0]!;
    expect(tableCellPlainText(header.children[0]!)).toBe("行星名称");
    expect(tableCellPlainText(header.children[1]!)).toBe("类型");
    const mercury = table.children[1]!;
    expect(tableCellPlainText(mercury.children[0]!)).toBe("水星");
    expect(tableCellPlainText(mercury.children[1]!)).toBe("岩石行星");
    expect(tableCellPlainText(mercury.children[2]!)).toBe("4,879");
    expect(tableCellPlainText(mercury.children[3]!)).toBe(
      "温差最大，昼夜间约600℃",
    );
    const neptune = table.children[8]!;
    expect(tableCellPlainText(neptune.children[0]!)).toBe("海王星");
    expect(tableCellPlainText(neptune.children[3]!)).toContain("2100公里");
  });

  it("Lobe playground 风格片段：结构快照（含标题、引用、粗斜体、列表、链接、代码块）", () => {
    const md = `# Welcome to the Lobe Editor Demo!
> In case you were wondering what the black box at the bottom is – it's the debug view, showing the current state of the editor. You can disable it by pressing on the settings control in the bottom-left of your screen and toggling the debug view setting.

The playground is a demo environment built with \`@lobehub/editor\`. Try typing in **some text** with *different formats*.
- Visit the [Lobe Editor website](https://editor.lobehub.com) for documentation and more information.
- Check out the code on our [GitHub repository](https://github.com/lobehub/lobe-editor).
- Playground code [Playground code](https://github.com/lobehub/lobe-editor/blob/master/src/react/Editor/demos/index.tsx) can be found here.
- Join our [Discover Server](https://discord.gg/AYFPHvv2jT) and chat with the team.

Lastly, we're constantly adding cool new features to this playground. So make sure you check back here when you next get a chance 🙂.
\`\`\`typescript
import { Editor } from '@lobehub/editor';
\`\`\``;

    const { root } = parseSerializedLexical(md);
    expect(root.children.map((n) => (n as { type: string }).type)).toEqual([
      "heading",
      "quote",
      "paragraph",
      "list",
      "paragraph",
      "code",
    ]);
    expect((root.children[0] as { tag: string }).tag).toBe("h1");
    const p = root.children[2] as {
      children: { format: number; text: string }[];
    };
    expect(
      p.children.some(
        (c) => c.text === "some text" && (c.format & TEXT_BOLD) !== 0,
      ),
    ).toBe(true);
    expect(
      p.children.some(
        (c) => c.text === "different formats" && (c.format & TEXT_ITALIC) !== 0,
      ),
    ).toBe(true);
    const list = root.children[3] as { children: unknown[] };
    expect(list.children.length).toBeGreaterThanOrEqual(2);
    const code = root.children[5] as {
      language: string;
      children: { text: string }[];
    };
    expect(code.language).toBe("typescript");
    expect(code.children[0]!.text).toContain("@lobehub/editor");
    expect(markdownToLexicalJson(md)).toMatchSnapshot();
  });
});
