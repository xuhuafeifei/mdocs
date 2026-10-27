/**
 * md_format_lexical 提案：按外层块门牌拼回完整 Lexical。
 */
import { markdownToLexicalJson } from "./markdown-to-lexical.js";

export type LexicalLinesMode = "patch_lines" | "replace_all";

export type LexicalLineDecision = "pending" | "accepted" | "rejected";

type LexNode = Record<string, unknown>;

function parseRootChildren(raw: string): LexNode[] | null {
  try {
    const doc = JSON.parse(raw) as { root?: { children?: unknown } };
    if (!doc?.root || !Array.isArray(doc.root.children)) return null;
    return doc.root.children.filter(
      (c): c is LexNode => Boolean(c) && typeof c === "object",
    );
  } catch {
    return null;
  }
}

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

function wrapRoot(children: LexNode[]): string {
  const safe = children.length > 0 ? children : [emptyParagraph()];
  return JSON.stringify({
    root: {
      children: safe,
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

/** 一段 MD → 外层块数组（可多块） */
export function markdownToOuterBlocks(markdown: string): LexNode[] {
  const json = markdownToLexicalJson(markdown ?? "");
  return parseRootChildren(json) ?? [emptyParagraph()];
}

/** 提案 lines 展开成完整 Lexical JSON（全部按提案，忽略 decision） */
export function buildProposedLexicalJson(
  baseLexicalJson: string,
  mode: LexicalLinesMode,
  lines: Record<string, string>,
  fullMarkdown?: string,
): string {
  if (mode === "replace_all") {
    if (typeof fullMarkdown === "string" && fullMarkdown.length > 0) {
      return markdownToLexicalJson(fullMarkdown);
    }
    const keys = Object.keys(lines)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n) && n >= 1)
      .sort((a, b) => a - b);
    const children: LexNode[] = [];
    for (const k of keys) {
      children.push(...markdownToOuterBlocks(lines[String(k)] ?? ""));
    }
    return wrapRoot(children);
  }

  const base = parseRootChildren(baseLexicalJson) ?? [emptyParagraph()];
  const out: LexNode[] = [];
  for (let i = 0; i < base.length; i++) {
    const key = String(i + 1);
    if (Object.prototype.hasOwnProperty.call(lines, key)) {
      out.push(...markdownToOuterBlocks(lines[key] ?? ""));
    } else {
      out.push(base[i]!);
    }
  }
  return wrapRoot(out);
}

/**
 * 按门牌决策拼回（patch_lines）。
 * accepted → 用提案 MD 展开块；rejected/pending → 保留 base 外层块。
 */
export function applyPatchLineDecisions(
  baseLexicalJson: string,
  lines: Record<string, string>,
  decisions: Record<string, LexicalLineDecision>,
): string {
  const base = parseRootChildren(baseLexicalJson) ?? [emptyParagraph()];
  const out: LexNode[] = [];
  for (let i = 0; i < base.length; i++) {
    const key = String(i + 1);
    const d = decisions[key] ?? "pending";
    if (d === "accepted" && Object.prototype.hasOwnProperty.call(lines, key)) {
      out.push(...markdownToOuterBlocks(lines[key] ?? ""));
    } else {
      out.push(base[i]!);
    }
  }
  return wrapRoot(out);
}
