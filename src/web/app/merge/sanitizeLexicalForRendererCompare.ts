/**
 * LexicalDiff → LexicalRenderer only registers a subset of editor nodes.
 * Historical blobs with meta2d / markmap / leftover diff-hunk throw inside
 * parseEditorState during React render; without a boundary that blanks the app.
 *
 * Strip hunks, then replace unknown root-level (and nested) types with a
 * plain paragraph placeholder so compare can still open.
 */
import type { SerializedEditorState, SerializedLexicalNode } from "lexical";
import { stripDiffHunksFromLexicalJson } from "./stripDiffHunksFromLexicalJson";

/** Types accepted by @lobehub/editor/renderer `rendererNodes` + Lexical builtins. */
const RENDERER_SAFE_TYPES = new Set([
  "root",
  "paragraph",
  "text",
  "linebreak",
  "tab",
  "heading",
  "quote",
  "list",
  "listitem",
  "table",
  "tablerow",
  "tablecell",
  "link",
  "autolink",
  "image",
  "block-image",
  "math",
  "mathBlock",
  "code",
  "codeInline",
  "horizontalrule",
  "mention",
  "file",
  "cursor",
  "linkHighlight",
  "PlaceholderInline",
  "PlaceholderBlock",
]);

type LexNode = SerializedLexicalNode & {
  children?: LexNode[];
  text?: string;
  type: string;
};

function plainTextOf(node: LexNode): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.children)) return "";
  return node.children.map(plainTextOf).join("");
}

function placeholderParagraph(label: string, text: string): LexNode {
  const body = text.trim() || `[${label}]`;
  return {
    children: [
      {
        detail: 0,
        format: 0,
        mode: "normal",
        style: "",
        text: body.length > 240 ? `${body.slice(0, 240)}…` : body,
        type: "text",
        version: 1,
      } as LexNode,
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
  } as LexNode;
}

function sanitizeNode(node: LexNode): LexNode {
  const type = String(node.type ?? "");
  if (!RENDERER_SAFE_TYPES.has(type)) {
    return placeholderParagraph(type || "unknown", plainTextOf(node));
  }
  if (!Array.isArray(node.children)) return node;
  return {
    ...node,
    children: node.children.map((child) => sanitizeNode(child as LexNode)),
  };
}

export function sanitizeLexicalForRendererCompare(
  state: SerializedEditorState,
): SerializedEditorState {
  const stripped = stripDiffHunksFromLexicalJson(JSON.stringify(state), "keep");
  let parsed: SerializedEditorState;
  try {
    parsed = JSON.parse(stripped) as SerializedEditorState;
  } catch {
    return state;
  }
  const root = parsed.root as LexNode | undefined;
  if (!root || !Array.isArray(root.children)) return parsed;
  return {
    ...parsed,
    root: {
      ...root,
      children: root.children.map((child) => sanitizeNode(child as LexNode)),
    },
  } as SerializedEditorState;
}
