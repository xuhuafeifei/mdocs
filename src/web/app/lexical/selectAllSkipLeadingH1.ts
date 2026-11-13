import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $normalizeSelection__EXPERIMENTAL,
  $setSelection,
  type LexicalNode,
  type RangeSelection,
} from "lexical";
import { $isHeadingNode, type HeadingNode } from "@lexical/rich-text";

function isH1Block(node: LexicalNode): node is HeadingNode {
  if ($isHeadingNode(node)) return node.getTag() === "h1";
  if (node.getType() !== "heading") return false;
  const tag = (node as { getTag?: () => string }).getTag?.();
  return tag === "h1";
}

function isSkippableLeadingBlock(node: LexicalNode): boolean {
  return $isParagraphNode(node) && node.getTextContent().trim() === "";
}

/** 首个「有效」块前只允许空段落；该块须为 H1 */
export function findLeadingH1(
  children: LexicalNode[],
): { h1: LexicalNode; index: number } | null {
  for (let i = 0; i < children.length; i++) {
    const node = children[i]!;
    if (isSkippableLeadingBlock(node)) continue;
    if (isH1Block(node)) return { h1: node, index: i };
    return null;
  }
  return null;
}

function elementChildCount(node: LexicalNode): number {
  return $isElementNode(node) ? node.getChildrenSize() : 0;
}

/** 锚点所在顶层块在 root 下的下标；-1 表示未找到 */
export function indexOfTopLevelBlock(anchor: RangeSelection["anchor"]): number {
  const root = $getRoot();
  let node: LexicalNode | null = anchor.getNode();
  while (node != null && node.getParent() !== root) {
    node = node.getParent();
  }
  if (node == null || node === root) return -1;
  return root.getChildren().findIndex((c) => c.getKey() === node!.getKey());
}

function isSelectionInsideNode(selection: RangeSelection, blockKey: string): boolean {
  const root = $getRoot();
  let node: LexicalNode | null = selection.anchor.getNode();
  while (node != null && node !== root) {
    if (node.getKey() === blockKey) return true;
    node = node.getParent();
  }
  return false;
}

function setElementRange(
  selection: RangeSelection,
  anchorKey: string,
  anchorOffset: number,
  focusKey: string,
  focusOffset: number,
): void {
  selection.anchor.set(anchorKey, anchorOffset, "element");
  selection.focus.set(focusKey, focusOffset, "element");
  $setSelection($normalizeSelection__EXPERIMENTAL(selection));
}

function selectTopLevelBlock(blockKey: string, childCount: number): void {
  const sel = $getSelection();
  const selection = sel && $isRangeSelection(sel) ? sel : $createRangeSelection();
  setElementRange(selection, blockKey, 0, blockKey, childCount);
}

/**
 * 飞书式全选：首个 H1（前可有空段落）时，正文区 Ctrl/⌘+A 不包含该 H1。
 * @returns 是否已自定义处理（true 则不再走 Lexical 默认 $selectAll）
 */
export function applySelectAllSkipLeadingH1(): boolean {
  const root = $getRoot();
  const children = root.getChildren();
  if (children.length === 0) return false;

  const leading = findLeadingH1(children);
  if (!leading) return false;

  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return false;

  const firstKey = leading.h1.getKey();

  if (isSelectionInsideNode(sel, firstKey)) {
    selectTopLevelBlock(firstKey, elementChildCount(leading.h1));
    return true;
  }

  const bodyStartIndex = leading.index + 1;
  if (bodyStartIndex >= children.length) {
    setElementRange(sel, root.getKey(), bodyStartIndex, root.getKey(), root.getChildrenSize());
    return true;
  }

  const last = children[children.length - 1]!;
  const bodyStart = children[bodyStartIndex]!;
  setElementRange(
    sel,
    bodyStart.getKey(),
    0,
    last.getKey(),
    elementChildCount(last),
  );
  return true;
}

/** Win / Mac 全选快捷键（与 Lexical isSelectAll 一致） */
export function isDocumentSelectAllKey(event: KeyboardEvent): boolean {
  if (event.isComposing) return false;
  if (event.shiftKey || event.altKey) return false;
  const isApple =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modOk = isApple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!modOk) return false;
  if (event.key.toLowerCase() === "a") return true;
  return event.code === "KeyA";
}
