/**
 * 两段正文的行级变化率：ratio = (added + removed) / max(oldLines, 1)
 */
export const DEFAULT_GRAPH_DIRTY_RATIO = 0.15;

export function changeRatio(oldText: string, newText: string): number {
  const a = oldText === "" ? [] : oldText.split("\n");
  const b = newText === "" ? [] : newText.split("\n");
  const { added, removed } = lineEditCounts(a, b);
  return (added + removed) / Math.max(a.length, 1);
}

/** 基于 LCS 的行增删统计 */
export function lineEditCounts(
  oldLines: string[],
  newLines: string[],
): { added: number; removed: number } {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  const lcs = dp[m]![n]!;
  return { removed: m - lcs, added: n - lcs };
}
