/**
 * 行级三方 merge（base / local / remote），对齐 react-monaco-json-merge 的冲突语义。
 * 不往 Markdown 写入 <<<<<<< 标记。
 */
import { diff3Merge } from "node-diff3";

export type ConflictResolution = "unresolved" | "local" | "remote" | "both" | "manual";

/** 相对 base 有差异的块均需用户点选（含 diff3 自动合并的单侧修改） */
export type MergeConflictKind = "true_conflict" | "change";

export interface MergeUnchangedSegment {
  kind: "unchanged";
  lines: string[];
}

export interface MergeConflictSegment {
  kind: "conflict";
  id: string;
  conflictKind: MergeConflictKind;
  baseLines: string[];
  localLines: string[];
  remoteLines: string[];
  resolution: ConflictResolution;
  manualLines?: string[];
}

export type MergeSegment = MergeUnchangedSegment | MergeConflictSegment;

/** 未决议冲突在结果正文中的占位行（HTML 注释，不污染渲染且便于定位） */
const CONFLICT_PLACEHOLDER_RE = /^<!--\s*mdocs-merge-conflict:([^\s]+)\s*-->$/;

export function conflictPlaceholderLine(id: string): string {
  return `<!-- mdocs-merge-conflict:${id} -->`;
}

export function isConflictPlaceholderLine(line: string): string | null {
  const m = line.trim().match(CONFLICT_PLACEHOLDER_RE);
  return m?.[1] ?? null;
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split("\n");
}

function linesEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/**
 * 三方 merge：mine=local, original=base, theirs=remote（node-diff3 约定）。
 * diff3 的 ok 段也会拆成「相对 base 无变化」与待确认 conflict，避免单侧修改被静默合并。
 * 无 base 时退化为 local vs remote 两方 diff。
 */
export function buildThreeWayMergePlan(
  localMd: string,
  baseMd: string,
  remoteMd: string,
): MergeSegment[] {
  const local = splitLines(localMd);
  const base = splitLines(baseMd);
  const remote = splitLines(remoteMd);

  if (base.length === 0 && baseMd === "") {
    return buildTwoWayFallbackPlan(localMd, remoteMd);
  }

  const chunks = diff3Merge(local, base, remote);
  const segments: MergeSegment[] = [];
  let conflictIndex = 0;
  let li = 0;
  let bi = 0;
  let ri = 0;

  const pushConflict = (
    baseLines: string[],
    localLines: string[],
    remoteLines: string[],
    conflictKind: MergeConflictKind,
  ): void => {
    segments.push({
      kind: "conflict",
      id: `conflict-${conflictIndex}`,
      conflictKind,
      baseLines,
      localLines,
      remoteLines,
      resolution: "unresolved",
    });
    conflictIndex += 1;
  };

  const processRegion = (L: string[], B: string[], R: string[]): void => {
    if (B.length === 0 && L.length === 0 && R.length === 0) return;
    if (linesEqual(L, B) && linesEqual(R, B)) {
      if (B.length > 0) segments.push({ kind: "unchanged", lines: [...B] });
      return;
    }
    if (L.length === B.length && R.length === B.length) {
      let unchangedBuf: string[] = [];
      const flushUnchanged = (): void => {
        if (unchangedBuf.length > 0) {
          segments.push({ kind: "unchanged", lines: unchangedBuf });
          unchangedBuf = [];
        }
      };
      for (let i = 0; i < B.length; i += 1) {
        const b = B[i]!;
        const l = L[i]!;
        const r = R[i]!;
        if (l === b && r === b) unchangedBuf.push(b);
        else {
          flushUnchanged();
          const kind: MergeConflictKind =
            l !== b && r !== b && l !== r ? "true_conflict" : "change";
          pushConflict([b], [l], [r], kind);
        }
      }
      flushUnchanged();
      return;
    }
    const kind: MergeConflictKind =
      L.join("\n") !== B.join("\n") && R.join("\n") !== B.join("\n") && L.join("\n") !== R.join("\n")
        ? "true_conflict"
        : "change";
    pushConflict(B, L, R, kind);
  };

  for (let k = 0; k < chunks.length; k += 1) {
    const chunk = chunks[k]!;
    const c = chunk.conflict;
    if (c) {
      processRegion(
        local.slice(li, c.aIndex),
        base.slice(bi, c.oIndex),
        remote.slice(ri, c.bIndex),
      );
      pushConflict(c.o, c.a, c.b, "true_conflict");
      li = c.aIndex + c.a.length;
      bi = c.oIndex + c.o.length;
      ri = c.bIndex + c.b.length;
      continue;
    }
    if (chunk.ok) {
      const next = chunks[k + 1];
      const nextConflict = next?.conflict;
      if (nextConflict) {
        processRegion(
          local.slice(li, nextConflict.aIndex),
          base.slice(bi, nextConflict.oIndex),
          remote.slice(ri, nextConflict.bIndex),
        );
        li = nextConflict.aIndex;
        bi = nextConflict.oIndex;
        ri = nextConflict.bIndex;
      } else {
        processRegion(local.slice(li), base.slice(bi), remote.slice(ri));
        li = local.length;
        bi = base.length;
        ri = remote.length;
      }
    }
  }

  return segments;
}

type DiffOp =
  | { type: "equal"; line: string }
  | { type: "del"; line: string }
  | { type: "add"; line: string };

function computeLineDiffOps(a: string[], b: string[]): DiffOp[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const opsRev: DiffOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      opsRev.push({ type: "equal", line: a[i - 1]! });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1]! >= dp[i - 1]![j]!)) {
      opsRev.push({ type: "add", line: b[j - 1]! });
      j -= 1;
    } else {
      opsRev.push({ type: "del", line: a[i - 1]! });
      i -= 1;
    }
  }
  return opsRev.reverse();
}

/** 无开编 base 快照：local 与 remote 行级两方 diff（相同行进入结果，差异行待决议） */
function buildTwoWayFallbackPlan(localMd: string, remoteMd: string): MergeSegment[] {
  const local = splitLines(localMd);
  const remote = splitLines(remoteMd);
  const ops = computeLineDiffOps(local, remote);
  const segments: MergeSegment[] = [];
  let conflictIndex = 0;
  let i = 0;

  while (i < ops.length) {
    const op = ops[i]!;
    if (op.type === "equal") {
      const lines: string[] = [];
      while (i < ops.length && ops[i]!.type === "equal") {
        lines.push((ops[i] as { type: "equal"; line: string }).line);
        i += 1;
      }
      segments.push({ kind: "unchanged", lines });
      continue;
    }

    const localLines: string[] = [];
    const remoteLines: string[] = [];
    while (i < ops.length && ops[i]!.type !== "equal") {
      const cur = ops[i]!;
      if (cur.type === "del") localLines.push(cur.line);
      if (cur.type === "add") remoteLines.push(cur.line);
      i += 1;
    }
    segments.push({
      kind: "conflict",
      id: `conflict-${conflictIndex}`,
      conflictKind: "true_conflict",
      baseLines: [],
      localLines,
      remoteLines,
      resolution: "unresolved",
    });
    conflictIndex += 1;
  }

  return segments;
}

export function countConflicts(segments: MergeSegment[]): number {
  return segments.filter((s): s is MergeConflictSegment => s.kind === "conflict").length;
}

export function countUnresolvedConflicts(segments: MergeSegment[]): number {
  return segments.filter(
    (s): s is MergeConflictSegment => s.kind === "conflict" && s.resolution === "unresolved",
  ).length;
}

function linesForConflict(seg: MergeConflictSegment): string[] {
  switch (seg.resolution) {
    case "local":
      return seg.localLines;
    case "remote":
      return seg.remoteLines;
    case "both":
      return [...seg.localLines, ...seg.remoteLines];
    case "manual":
      return seg.manualLines ?? [];
    default:
      return [];
  }
}

/** 拼接发布用 Markdown；未决议冲突用占位行供行内 UI 定位 */
export function assembleMergedMarkdown(segments: MergeSegment[]): string {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg.kind === "unchanged") {
      out.push(...seg.lines);
    } else if (seg.resolution === "unresolved") {
      out.push(conflictPlaceholderLine(seg.id));
    } else {
      out.push(...linesForConflict(seg));
    }
  }
  return out.join("\n");
}

/** 计算每段在合并结果中的行区间（0-based 行号，含占位行） */
export function computeSegmentLineRanges(
  segments: MergeSegment[],
): Map<string, { from: number; to: number }> {
  const map = new Map<string, { from: number; to: number }>();
  let line = 0;
  for (const seg of segments) {
    const start = line;
    if (seg.kind === "unchanged") {
      line += seg.lines.length;
    } else if (seg.resolution === "unresolved") {
      map.set(seg.id, { from: line, to: line + 1 });
      line += 1;
    } else {
      line += linesForConflict(seg).length;
    }
    if (seg.kind === "conflict" && seg.resolution !== "unresolved") {
      map.set(seg.id, { from: start, to: line });
    }
  }
  return map;
}

/** 发布前去掉占位行（手改结果时可能残留） */
export function stripConflictPlaceholders(markdown: string): string {
  return splitLines(markdown)
    .filter((line) => !isConflictPlaceholderLine(line))
    .join("\n");
}

export function updateConflictResolution(
  segments: MergeSegment[],
  conflictId: string,
  resolution: ConflictResolution,
  manualLines?: string[],
): MergeSegment[] {
  return segments.map((seg) => {
    if (seg.kind !== "conflict" || seg.id !== conflictId) return seg;
    return {
      ...seg,
      resolution,
      manualLines: resolution === "manual" ? (manualLines ?? seg.manualLines ?? []) : undefined,
    };
  });
}

/** @deprecated 两方计划；请用 buildThreeWayMergePlan */
export function buildMergePlan(localMd: string, remoteMd: string): MergeSegment[] {
  return buildTwoWayFallbackPlan(localMd, remoteMd);
}
