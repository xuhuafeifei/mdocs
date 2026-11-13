import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $normalizeSelection__EXPERIMENTAL,
  $setSelection,
  type LexicalNode,
  type RangeSelection,
} from "lexical";
import { $isHeadingNode, type HeadingNode } from "@lexical/rich-text";

function isLeadingH1(node: LexicalNode): node is HeadingNode {
  return $isHeadingNode(node) && node.getTag() === "h1";
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
 * 飞书式全选：首块为 H1 时，正文区 Cmd+A 不包含该 H1。
 * 须在 editor.update() 内调用。
 * @returns 是否已自定义处理（true 则不再走 Lexical 默认 $selectAll）
 */
export function applySelectAllSkipLeadingH1(): boolean {
  const root = $getRoot();
  const children = root.getChildren();
  if (children.length === 0) return false;

  const first = children[0];
  if (!first || !isLeadingH1(first)) return false;

  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return false;

  const firstKey = first.getKey();

  if (isSelectionInsideNode(sel, firstKey)) {
    selectTopLevelBlock(firstKey, elementChildCount(first));
    return true;
  }

  if (children.length < 2) {
    setElementRange(sel, root.getKey(), 1, root.getKey(), root.getChildrenSize());
    return true;
  }

  const last = children[children.length - 1]!;
  const bodyStart = children[1]!;
  setElementRange(
    sel,
    bodyStart.getKey(),
    0,
    last.getKey(),
    elementChildCount(last),
  );
  return true;
}
