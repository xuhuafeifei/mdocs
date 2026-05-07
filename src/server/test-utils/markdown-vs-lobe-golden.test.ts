/**
 * Lobe Lexical golden（fixtures）与 markdown→Lexical 的差异清单；仅测试用。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { markdownToLexicalJson } from "../documents/markdown-to-lexical.js";
import { compareLexicalStructure } from "./lexical-structure-compare.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOBE_GOLDEN = JSON.parse(
  readFileSync(join(__dirname, "fixtures/lobe-playground.lexical-golden.json"), "utf8"),
) as unknown;

/** 与 golden fixture 对应的 Markdown（playground 正文） */
export const PLAYGROUND_MARKDOWN = `# Welcome to the Lobe Editor Demo!
> In case the black box at the bottom is – it's the debug view, showing the current state of the editor. You can disable it by pressing on the settings control in the bottom-left of your screen and toggling the debug view setting.

The playground is a demo environment built with \`@lobehub/editor\`. Try typing in **some text** with *different formats*.
- Visit the [Lobe Editor website](https://editor.lobehub.com) for documentation and more information.
- Check out the code on our [GitHub repository](https://github.com/lobehub/lobe-editor).
- Playground code [Playground code](https://github.com/lobehub/lobe-editor/blob/master/src/react/Editor/demos/index.tsx) can be found here.
- Join our [Discover Server](https://discord.gg/AYFPHvv2jT) and chat with the team.

Lastly, we're constantly adding cool new features to this playground. So make sure you check back here when you next get a chance 🙂.

\`\`\`typescript
import { Editor } from '@lobehub/editor';
\`\`\`
`;

describe("Markdown 解析结果 vs Lobe Lexical golden 结构", () => {
  it("结构差异清单（子节点个数、type、text 严格对齐；code 仅比源码）", () => {
    const actual = JSON.parse(markdownToLexicalJson(PLAYGROUND_MARKDOWN)) as unknown;
    const diff = compareLexicalStructure(LOBE_GOLDEN, actual);
    expect(diff.join("\n")).toMatchSnapshot();
  });
});
