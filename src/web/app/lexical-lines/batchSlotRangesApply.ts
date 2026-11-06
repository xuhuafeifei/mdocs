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
  const state = batchRangesToProposedState(baseLexicalJson, ranges);
  if (!state.ok) return state;

  const editor = createHeadlessEditor();
  try {
    editor.hydrateEditorData(state.state);
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

/**
 * 批量 slot → 提案 Lexical 状态（未改块保留 base JSON，避免整篇 MD 往返假 Diff）。
 */
export function batchRangesToProposedState(
  baseLexicalJson: string,
  ranges: BatchSlotRange[],
): { ok: true; state: SerializedEditorState } | { ok: false; error: string } {
  const applied = applyBatchSlotRangesToBlocks(
    parseChildren(baseLexicalJson),
    ranges,
    mdToChildren,
  );
  if (!applied.ok) return applied;
  return { ok: true, state: wrapRoot(applied.blocks) };
}
