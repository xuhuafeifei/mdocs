/** 行级 hunk：用于帮写提案接受/拒绝 */

export type MdHunk = {
  id: string;
  /** current 中受影响的行区间 [start, end) */
  oldStart: number;
  oldEnd: number;
  /** proposed 中对应行区间 [start, end) */
  newStart: number;
  newEnd: number;
  oldLines: string[];
  newLines: string[];
};

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split("\n");
}

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

/**
 * Myers 简化：用 LCS 表回溯，把连续 del/ins 收成 hunk。
 */
export function computeLineHunks(oldText: string, newText: string): MdHunk[] {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      else dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  type Tok = { kind: "eq" | "del" | "ins"; oi: number; ni: number };
  const toks: Tok[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      toks.push({ kind: "eq", oi: i, ni: j });
      i++;
      j++;
    } else if (j < m && (i === n || dp[i]![j + 1]! >= dp[i + 1]![j]!)) {
      toks.push({ kind: "ins", oi: i, ni: j });
      j++;
    } else if (i < n) {
      toks.push({ kind: "del", oi: i, ni: j });
      i++;
    } else {
      break;
    }
  }

  const hunks: MdHunk[] = [];
  let t = 0;
  let seq = 0;
  while (t < toks.length) {
    if (toks[t]!.kind === "eq") {
      t++;
      continue;
    }
    const oldStart = toks[t]!.oi;
    const newStart = toks[t]!.ni;
    const oldLines: string[] = [];
    const newLines: string[] = [];
    let oldEnd = oldStart;
    let newEnd = newStart;
    while (t < toks.length && toks[t]!.kind !== "eq") {
      const tok = toks[t]!;
      if (tok.kind === "del") {
        oldLines.push(a[tok.oi]!);
        oldEnd = tok.oi + 1;
      } else {
        newLines.push(b[tok.ni]!);
        newEnd = tok.ni + 1;
      }
      t++;
    }
    hunks.push({
      id: `h${seq++}`,
      oldStart,
      oldEnd,
      newStart,
      newEnd,
      oldLines,
      newLines,
    });
  }
  return hunks;
}

export function acceptHunk(currentText: string, hunk: MdHunk): string {
  const lines = splitLines(currentText);
  return joinLines([
    ...lines.slice(0, hunk.oldStart),
    ...hunk.newLines,
    ...lines.slice(hunk.oldEnd),
  ]);
}

export function rejectHunkFromProposed(proposedText: string, hunk: MdHunk): string {
  const lines = splitLines(proposedText);
  return joinLines([
    ...lines.slice(0, hunk.newStart),
    ...hunk.oldLines,
    ...lines.slice(hunk.newEnd),
  ]);
}

/** 冻结布局上的分段（与 AiWriteMarkdownPane 同构） */
export type MdInlineSeg =
  | { kind: "same"; lines: string[]; key: string }
  | { kind: "hunk"; hunk: MdHunk; hunkIndex: number; key: string };

function mergeAdjacentSame(segs: MdInlineSeg[]): MdInlineSeg[] {
  const out: MdInlineSeg[] = [];
  for (const seg of segs) {
    const prev = out[out.length - 1];
    if (seg.kind === "same" && prev?.kind === "same") {
      out[out.length - 1] = {
        kind: "same",
        lines: [...prev.lines, ...seg.lines],
        key: prev.key,
      };
    } else {
      out.push(seg);
    }
  }
  return out;
}

function renumberHunkIndices(segs: MdInlineSeg[]): MdInlineSeg[] {
  let hi = 0;
  return segs.map((seg) => {
    if (seg.kind !== "hunk") return seg;
    const next = { ...seg, hunkIndex: hi, key: `h-${seg.hunk.id}-${hi}` };
    hi += 1;
    return next;
  });
}

/**
 * 拒绝某一 hunk：就地变成 same（用 oldLines），不重跑 LCS。
 * 避免长文/重复空行时 Myers 重排成「上半全同、下半一大块」。
 */
export function rejectHunkInSegments(segs: MdInlineSeg[], hunkId: string): MdInlineSeg[] {
  const next = segs.map((seg) => {
    if (seg.kind !== "hunk" || seg.hunk.id !== hunkId) return seg;
    return {
      kind: "same" as const,
      lines: seg.hunk.oldLines.slice(),
      key: `s-rej-${seg.hunk.id}`,
    };
  });
  return renumberHunkIndices(mergeAdjacentSame(next));
}

/**
 * 接受某一 hunk：就地变成 same（用生效后的 newLines），并平移后续 hunk 的 old 行号。
 */
export function acceptHunkInSegments(
  segs: MdInlineSeg[],
  hunkId: string,
  effectiveNewLines: string[],
): MdInlineSeg[] {
  let delta = 0;
  let found = false;
  const next: MdInlineSeg[] = [];
  for (const seg of segs) {
    if (seg.kind === "same") {
      next.push(seg);
      continue;
    }
    if (seg.hunk.id === hunkId) {
      found = true;
      delta = effectiveNewLines.length - seg.hunk.oldLines.length;
      next.push({
        kind: "same",
        lines: effectiveNewLines.slice(),
        key: `s-acc-${seg.hunk.id}`,
      });
      continue;
    }
    if (!found || delta === 0) {
      next.push(seg);
      continue;
    }
    next.push({
      ...seg,
      hunk: {
        ...seg.hunk,
        oldStart: seg.hunk.oldStart + delta,
        oldEnd: seg.hunk.oldEnd + delta,
      },
    });
  }
  return renumberHunkIndices(mergeAdjacentSame(next));
}
