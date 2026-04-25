/** Shared with `useFlowRenderer` — fenced ```meta2 / ```meta blocks in Markdown. */
export const OPEN_FLOW_FENCE = /^\s*```(meta2|meta)\b/;

/** 1-based line number of the opening ```meta2 line for block `blockIndex` (0-based). */
export function findMeta2BlockLineNumber(markdown: string, blockIndex: number): number {
  const lines = markdown.split("\n");
  let count = -1;
  for (let i = 0; i < lines.length; i++) {
    if (OPEN_FLOW_FENCE.test(lines[i] ?? "")) {
      count++;
      if (count === blockIndex) {
        return i + 1;
      }
    }
  }
  return -1;
}

/** Inclusive 0-based [startLine, endLine] of the whole fenced block for `blockIndex`. */
export function findMeta2BlockRange(
  markdown: string,
  blockIndex: number,
): [number, number] | null {
  const lines = markdown.split("\n");
  let count = -1;
  for (let i = 0; i < lines.length; i++) {
    if (OPEN_FLOW_FENCE.test(lines[i] ?? "")) {
      count++;
      if (count === blockIndex) {
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\s*```\s*$/.test(lines[j] ?? "")) {
            return [i, j];
          }
        }
        return [i, lines.length - 1];
      }
    }
  }
  return null;
}
