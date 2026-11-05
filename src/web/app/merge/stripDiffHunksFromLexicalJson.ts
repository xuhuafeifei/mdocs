/**
 * Merge 桥 / 无 DiffPlugin 的编辑器吃不下 type: "diff-hunk"。
 * AI Diff 审阅中（或 Keep All 后草稿尚未刷盘）的本地快照会带 hunk，
 * 直接 setDocument 会抛错 → 无 ErrorBoundary 时整页卸成「mdocs 加载中…」。
 *
 * 语义对齐 @lobehub/editor 的 flattenCanonicalState（keep = Accept，reject = Undo），
 * 故意不 import 该包，避免测试/首屏被 editor 图拖垮。
 */

type LexNode = {
  type?: string;
  kind?: string;
  oldBlock?: LexNode | null;
  children?: LexNode[];
  [key: string]: unknown;
};

type LexState = {
  root?: LexNode & { children?: LexNode[] };
  [key: string]: unknown;
};

function flattenHunk(node: LexNode, mode: "keep" | "reject"): LexNode[] {
  const kind = String(node.kind ?? "");
  const oldBlock = node.oldBlock ?? null;
  const children = Array.isArray(node.children)
    ? node.children.filter((c) => c?.type !== "diff-chrome")
    : [];
  if (mode === "keep") {
    if (kind === "delete") return [];
    return children;
  }
  if (kind === "insert") return [];
  if (oldBlock) return [oldBlock];
  return [];
}

export function stripDiffHunksFromLexicalJson(
  raw: string,
  mode: "keep" | "reject" = "keep",
): string {
  try {
    const parsed = JSON.parse(raw) as LexState;
    const children = parsed?.root?.children;
    if (!Array.isArray(children)) return raw;
    if (!children.some((c) => c?.type === "diff-hunk")) return raw;
    const next: LexNode[] = [];
    for (const child of children) {
      if (child?.type === "diff-hunk") next.push(...flattenHunk(child, mode));
      else next.push(child);
    }
    return JSON.stringify({
      ...parsed,
      root: {
        ...parsed.root,
        children: next,
      },
    });
  } catch {
    return raw;
  }
}
