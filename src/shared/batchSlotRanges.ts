/**
 * batch_update_slots：连续闭区间 + 不相交校验（门牌均为 1-based）。
 */

export type BatchSlotRange = {
  start: number;
  end: number;
  markdown: string;
};

export type BatchSlotRangesOk = {
  ok: true;
  /** 按 start 升序；调用方若原地改数组请从高 start 往低应用 */
  sorted: BatchSlotRange[];
};

export type BatchSlotRangesErr = { ok: false; error: string };

export type BatchSlotRangesResult = BatchSlotRangesOk | BatchSlotRangesErr;

function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n);
}

/**
 * 校验 ranges：非空、start/end 为整数且 start≤end、start≥1、两两不相交。
 * 相交判定：闭区间 [a,b] 与 [c,d] 在 b≥c && d≥a 时相交。
 */
export function validateBatchSlotRanges(
  ranges: unknown,
): BatchSlotRangesResult {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return { ok: false, error: "ranges must be a non-empty array" };
  }

  const parsed: BatchSlotRange[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const raw = ranges[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: `ranges[${i}] must be an object` };
    }
    const r = raw as Record<string, unknown>;
    if (!isInt(r.start) || !isInt(r.end)) {
      return { ok: false, error: `ranges[${i}].start/end must be integers` };
    }
    if (r.start < 1 || r.end < 1) {
      return { ok: false, error: `ranges[${i}].start/end must be >= 1` };
    }
    if (r.start > r.end) {
      return {
        ok: false,
        error: `ranges[${i}]: start (${r.start}) must be <= end (${r.end})`,
      };
    }
    if (typeof r.markdown !== "string") {
      return { ok: false, error: `ranges[${i}].markdown must be a string` };
    }
    parsed.push({ start: r.start, end: r.end, markdown: r.markdown });
  }

  const sorted = [...parsed].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (prev.end >= cur.start) {
      return {
        ok: false,
        error: `ranges overlap: [${prev.start},${prev.end}] and [${cur.start},${cur.end}]`,
      };
    }
  }

  return { ok: true, sorted };
}

/**
 * 在 0-based 外层块数组上应用不相交区间（门牌相对**应用前** base）。
 * `splitMarkdown` 把每段 md 拆成外层块；空串可返回 [] 表示删光该区间。
 */
export function applyBatchSlotRangesToBlocks<T>(
  base: readonly T[],
  ranges: readonly BatchSlotRange[],
  splitMarkdown: (markdown: string) => T[],
): { ok: true; blocks: T[] } | { ok: false; error: string } {
  const validated = validateBatchSlotRanges(ranges);
  if (!validated.ok) return validated;

  const n = base.length;
  for (const r of validated.sorted) {
    if (r.end > n) {
      return {
        ok: false,
        error: `range [${r.start},${r.end}] exceeds document length ${n}`,
      };
    }
  }

  // 从高 start 往低 splice，避免门牌漂移
  const descending = [...validated.sorted].sort((a, b) => b.start - a.start);
  const out = [...base];
  for (const r of descending) {
    const replacement = splitMarkdown(r.markdown);
    out.splice(r.start - 1, r.end - r.start + 1, ...replacement);
  }
  return { ok: true, blocks: out };
}
