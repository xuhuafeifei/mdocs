/**
 * 前端：按 batch ranges 对 base Lexical 做 span 替换，导出 Markdown 供 overwriteAll。
 */
import { createHeadlessEditor } from "@lobehub/editor";
import type { SerializedEditorState } from "lexical";

import {
  applyBatchSlotRangesToBlocks,
  type BatchSlotRange,
} from "@shared/batchSlotRanges";

type LexNode = Record<string, unknown>;

function emptyParagraph(): LexNode {
  return {
    children: [],
    direction: "ltr",
    format: "",
    indent: 0,
    textFormat: 0,
    textStyle: "",
    type: "paragraph",
    version: 1,
  };
}

function parseChildren(raw: string): LexNode[] {
  try {
    const doc = JSON.parse(raw) as { root?: { children?: unknown } };
    if (!Array.isArray(doc?.root?.children)) return [emptyParagraph()];
    return doc.root.children.filter(
      (c): c is LexNode => Boolean(c) && typeof c === "object",
    );
  } catch {
    return [emptyParagraph()];
  }
}

function wrapRoot(children: LexNode[]): SerializedEditorState {
  const safe = children.length > 0 ? children : [emptyParagraph()];
  return {
    root: {
      children: safe,
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  } as unknown as SerializedEditorState;
}

function mdToChildren(markdown: string): LexNode[] {
  const trimmed = (markdown ?? "").trim();
  if (!trimmed) return [];
  const editor = createHeadlessEditor();
  try {
    editor.hydrateMarkdown(markdown ?? "");
    const json = JSON.stringify(editor.export().editorData);
    return parseChildren(json);
  } finally {
    editor.destroy();
  }
}

export function batchRangesToProposedMarkdown(
  baseLexicalJson: string,
  ranges: BatchSlotRange[],
): { ok: true; markdown: string } | { ok: false; error: string } {
  const applied = applyBatchSlotRangesToBlocks(
    parseChildren(baseLexicalJson),
    ranges,
    mdToChildren,
  );
  if (!applied.ok) return applied;

  const editor = createHeadlessEditor();
  try {
    editor.hydrateEditorData(wrapRoot(applied.blocks));
    return { ok: true, markdown: editor.export().markdown ?? "" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    editor.destroy();
  }
}
