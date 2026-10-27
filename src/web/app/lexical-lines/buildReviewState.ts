/**
 * 把 LexicalDiff rows + hunk 决策合成「写入 live Editor」的审阅 JSON。
 * pending hunk：old/new 块都进文档（带 delete/insert 染色）；settled 只留 sourceBlock。
 */
import type { LexicalDiffRow } from "@lobehub/editor/renderer";
import type { SerializedEditorState, SerializedLexicalNode } from "lexical";

export type HunkDecision = "pending" | "accepted" | "rejected";

export type Hunk = {
  id: string;
  start: number;
  end: number;
};

export type ReviewBlockRole = "delete" | "insert" | "plain";

export type ReviewHunkPlacement = {
  id: string;
  hunkIndex: number;
  /** Inclusive start / exclusive end into review root.children */
  blockStart: number;
  blockEnd: number;
  roles: ReviewBlockRole[];
};

type NodeRecord = Record<string, unknown>;

type TextNodeLike = SerializedLexicalNode & {
  style?: string;
  text: string;
  type: "text";
};

const DELETE_MARK_STYLE =
  "background-color: color-mix(in srgb, var(--ant-color-error, #ff4d4f) 18%, transparent); text-decoration: line-through;";
const INSERT_MARK_STYLE =
  "background-color: color-mix(in srgb, var(--ant-color-success, #52c41a) 18%, transparent);";

function emptyParagraph(): SerializedLexicalNode {
  return {
    children: [],
    direction: "ltr",
    format: "",
    indent: 0,
    textFormat: 0,
    textStyle: "",
    type: "paragraph",
    version: 1,
  } as unknown as SerializedLexicalNode;
}

function isTextNode(node: SerializedLexicalNode): node is TextNodeLike {
  const r = node as NodeRecord;
  return r.type === "text" && typeof r.text === "string";
}

function getChildren(node: SerializedLexicalNode): SerializedLexicalNode[] | null {
  const children = (node as NodeRecord).children;
  return Array.isArray(children) ? (children as SerializedLexicalNode[]) : null;
}

function appendStyle(baseStyle: unknown, extra: string): string {
  const base = typeof baseStyle === "string" ? baseStyle.trim() : "";
  if (!base) return extra;
  return `${base}${base.endsWith(";") ? "" : ";"} ${extra}`;
}

function decorateSubtree(
  node: SerializedLexicalNode,
  kind: "delete" | "insert",
): SerializedLexicalNode {
  if (isTextNode(node)) {
    return {
      ...node,
      style: appendStyle(
        node.style,
        kind === "delete" ? DELETE_MARK_STYLE : INSERT_MARK_STYLE,
      ),
    } as SerializedLexicalNode;
  }
  const children = getChildren(node);
  if (!children) return node;
  return {
    ...(node as NodeRecord),
    children: children.map((c) => decorateSubtree(c, kind)),
  } as unknown as SerializedLexicalNode;
}

function sourceOf(
  cell: LexicalDiffRow["oldCell"] | LexicalDiffRow["newCell"],
): SerializedLexicalNode | null {
  if (!cell) return null;
  return cell.sourceBlock ?? cell.block;
}

/** Display block for pending delete/insert: prefer already-decorated modify cells. */
function displayOf(
  cell: LexicalDiffRow["oldCell"] | LexicalDiffRow["newCell"],
  role: "delete" | "insert",
): SerializedLexicalNode | null {
  if (!cell?.block) return null;
  // modify rows already bake marks into `block`; insert/delete rows do not.
  const styleProbe = JSON.stringify(cell.block);
  const hasMark =
    role === "delete"
      ? styleProbe.includes("line-through")
      : styleProbe.includes("--ant-color-success") ||
        styleProbe.includes("52c41a");
  if (hasMark) return cell.block;
  return decorateSubtree(cell.block, role);
}

export function groupHunks(rows: LexicalDiffRow[]): Hunk[] {
  const hunks: Hunk[] = [];
  let i = 0;
  let seq = 0;
  while (i < rows.length) {
    if (rows[i]!.kind === "equal") {
      i++;
      continue;
    }
    const start = i;
    while (i < rows.length && rows[i]!.kind !== "equal") i++;
    hunks.push({ id: `h${seq++}`, start, end: i });
  }
  return hunks;
}

function wrapRoot(children: SerializedLexicalNode[]): SerializedEditorState {
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
  } as SerializedEditorState;
}

export function buildFinalFromDecisions(
  rows: LexicalDiffRow[],
  hunks: Hunk[],
  decisions: Record<string, HunkDecision>,
): SerializedEditorState {
  const hunkOfRow = new Map<number, Hunk>();
  for (const h of hunks) {
    for (let i = h.start; i < h.end; i++) hunkOfRow.set(i, h);
  }

  const children: SerializedLexicalNode[] = [];
  rows.forEach((row, index) => {
    if (row.kind === "equal") {
      const block = sourceOf(row.newCell) ?? sourceOf(row.oldCell);
      if (block) children.push(block);
      return;
    }
    const hunk = hunkOfRow.get(index);
    const d = hunk ? (decisions[hunk.id] ?? "pending") : "pending";
    if (d === "accepted") {
      const block = sourceOf(row.newCell);
      if (block) children.push(block);
    } else {
      const block = sourceOf(row.oldCell);
      if (block) children.push(block);
    }
  });

  return wrapRoot(children);
}

/**
 * Live-editor review document: pending hunks expand to delete+insert blocks;
 * settled hunks collapse to chosen source.
 */
export function buildReviewEditorState(
  rows: LexicalDiffRow[],
  hunks: Hunk[],
  decisions: Record<string, HunkDecision>,
): { state: SerializedEditorState; placements: ReviewHunkPlacement[] } {
  const children: SerializedLexicalNode[] = [];
  const placements: ReviewHunkPlacement[] = [];

  let rowCursor = 0;
  const pushPlain = (from: number, to: number, preferNew: boolean) => {
    for (let i = from; i < to; i++) {
      const row = rows[i]!;
      const block = preferNew
        ? (sourceOf(row.newCell) ?? sourceOf(row.oldCell))
        : (sourceOf(row.oldCell) ?? sourceOf(row.newCell));
      if (block) children.push(block);
    }
  };

  for (let hi = 0; hi < hunks.length; hi++) {
    const hunk = hunks[hi]!;
    if (rowCursor < hunk.start) pushPlain(rowCursor, hunk.start, true);

    const d = decisions[hunk.id] ?? "pending";
    if (d === "accepted") {
      pushPlain(hunk.start, hunk.end, true);
    } else if (d === "rejected") {
      pushPlain(hunk.start, hunk.end, false);
    } else {
      const blockStart = children.length;
      const roles: ReviewBlockRole[] = [];
      for (let i = hunk.start; i < hunk.end; i++) {
        const row = rows[i]!;
        if (row.oldCell) {
          const block = displayOf(row.oldCell, "delete");
          if (block) {
            children.push(block);
            roles.push("delete");
          }
        }
        if (row.newCell) {
          const block = displayOf(row.newCell, "insert");
          if (block) {
            children.push(block);
            roles.push("insert");
          }
        }
      }
      placements.push({
        id: hunk.id,
        hunkIndex: hi,
        blockStart,
        blockEnd: children.length,
        roles,
      });
    }
    rowCursor = hunk.end;
  }
  if (rowCursor < rows.length) pushPlain(rowCursor, rows.length, true);

  return { state: wrapRoot(children), placements };
}
