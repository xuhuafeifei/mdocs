import { describe, expect, it } from "vitest";
import type { SerializedEditorState } from "lexical";
import { sanitizeLexicalForRendererCompare } from "./sanitizeLexicalForRendererCompare";

function state(children: unknown[]): SerializedEditorState {
  return {
    root: {
      children,
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  } as unknown as SerializedEditorState;
}

describe("sanitizeLexicalForRendererCompare", () => {
  it("keeps safe paragraph blocks", () => {
    const input = state([
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "hello",
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
    ]);
    const out = sanitizeLexicalForRendererCompare(input);
    expect(out.root.children).toHaveLength(1);
    expect((out.root.children[0] as { type: string }).type).toBe("paragraph");
  });

  it("replaces meta2d with a paragraph placeholder", () => {
    const input = state([{ type: "meta2d", version: 1, data: "{}", children: [] }]);
    const out = sanitizeLexicalForRendererCompare(input);
    const block = out.root.children[0] as {
      type: string;
      children: Array<{ text?: string }>;
    };
    expect(block.type).toBe("paragraph");
    expect(block.children[0]?.text).toContain("meta2d");
  });

  it("flattens leftover diff-hunk before compare", () => {
    const input = state([
      {
        type: "diff-hunk",
        kind: "update",
        opId: "1",
        version: 1,
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "kept",
                type: "text",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
          },
        ],
      },
    ]);
    const out = sanitizeLexicalForRendererCompare(input);
    expect(out.root.children.some((c) => (c as { type: string }).type === "diff-hunk")).toBe(
      false,
    );
    expect((out.root.children[0] as { type: string }).type).toBe("paragraph");
  });
});
