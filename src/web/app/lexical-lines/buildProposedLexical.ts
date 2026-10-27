/**
 * 前端用 lobe Headless 把提案 MD 合成完整 Lexical（与编辑器同源，利于 Diff）。
 */
import { createHeadlessEditor } from "@lobehub/editor";
import type { SerializedEditorState } from "lexical";

export type LexicalLinesMode = "patch_lines" | "replace_all";

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
  const editor = createHeadlessEditor();
  try {
    editor.hydrateMarkdown(markdown ?? "");
    const json = JSON.stringify(editor.export().editorData);
    return parseChildren(json);
  } finally {
    editor.destroy();
  }
}

export function parseEditorState(raw: string): SerializedEditorState {
  try {
    const doc = JSON.parse(raw) as SerializedEditorState;
    if (doc?.root?.children) return doc;
  } catch {
    /* fall through */
  }
  return wrapRoot(mdToChildren(raw));
}

export function buildProposedEditorState(
  baseLexicalJson: string,
  mode: LexicalLinesMode,
  lines: Record<string, string>,
  fullMarkdown?: string,
): SerializedEditorState {
  if (mode === "replace_all") {
    if (typeof fullMarkdown === "string" && fullMarkdown.length > 0) {
      return wrapRoot(mdToChildren(fullMarkdown));
    }
    const keys = Object.keys(lines)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n) && n >= 1)
      .sort((a, b) => a - b);
    const children: LexNode[] = [];
    for (const k of keys) {
      children.push(...mdToChildren(lines[String(k)] ?? ""));
    }
    return wrapRoot(children);
  }

  const base = parseChildren(baseLexicalJson);
  const out: LexNode[] = [];
  for (let i = 0; i < base.length; i++) {
    const key = String(i + 1);
    if (Object.prototype.hasOwnProperty.call(lines, key)) {
      out.push(...mdToChildren(lines[key] ?? ""));
    } else {
      out.push(base[i]!);
    }
  }
  return wrapRoot(out);
}

export type LineDecision = "pending" | "accepted" | "rejected";

/** patch：按门牌决策拼最终稿 */
export function applyPatchDecisions(
  baseLexicalJson: string,
  lines: Record<string, string>,
  decisions: Record<string, LineDecision>,
): SerializedEditorState {
  const base = parseChildren(baseLexicalJson);
  const out: LexNode[] = [];
  for (let i = 0; i < base.length; i++) {
    const key = String(i + 1);
    const d = decisions[key] ?? "pending";
    if (d === "accepted" && Object.prototype.hasOwnProperty.call(lines, key)) {
      out.push(...mdToChildren(lines[key] ?? ""));
    } else {
      out.push(base[i]!);
    }
  }
  return wrapRoot(out);
}
