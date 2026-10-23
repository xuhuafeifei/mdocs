/**
 * MergeSegment[] → 完整 git 风格冲突 Markdown（供 AI merge 输入）。
 * 无冲突段原样保留；未决议冲突用 <<<<<<< / ======= / >>>>>>>。
 */
import type { MergeConflictSegment, MergeSegment } from "./merge-plan.js";

const MARKED_MAX_CHARS = 24_000;

export function serializeMergeMarkedText(
  segments: MergeSegment[],
  opts?: { maxChars?: number },
): { conflictMarkdown: string; unresolvedCount: number } {
  const maxChars = opts?.maxChars ?? MARKED_MAX_CHARS;
  const parts: string[] = [];
  let unresolvedCount = 0;

  for (const seg of segments) {
    if (seg.kind === "unchanged") {
      if (seg.lines.length > 0) parts.push(seg.lines.join("\n"));
      continue;
    }
    if (seg.resolution !== "unresolved") {
      const lines = linesForResolved(seg);
      if (lines.length > 0) parts.push(lines.join("\n"));
      continue;
    }
    unresolvedCount += 1;
    parts.push(formatGitConflictBlock(seg));
  }

  let conflictMarkdown = parts.join("\n");
  if (conflictMarkdown.length > maxChars) {
    conflictMarkdown = truncatePreferConflicts(conflictMarkdown, maxChars);
  }
  return { conflictMarkdown, unresolvedCount };
}

function linesForResolved(seg: MergeConflictSegment): string[] {
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
      return seg.localLines;
  }
}

/** 经典 git / diff3 冲突块，LLM 熟悉。 */
function formatGitConflictBlock(seg: MergeConflictSegment): string {
  const local = seg.localLines.join("\n");
  const remote = seg.remoteLines.join("\n");
  const base = seg.baseLines.join("\n");
  const includeBase =
    seg.baseLines.length > 0 && base !== local && base !== remote;
  if (includeBase) {
    return ["<<<<<<< local", local, "||||||| base", base, "=======", remote, ">>>>>>> remote"].join(
      "\n",
    );
  }
  return ["<<<<<<< local", local, "=======", remote, ">>>>>>> remote"].join("\n");
}

function truncatePreferConflicts(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.35);
  const tail = maxChars - head - 20;
  return `${text.slice(0, head)}\n\n…\n\n${text.slice(-tail)}`;
}

export function stillHasGitConflictMarkers(markdown: string): boolean {
  return (
    /^<<<<<<< /m.test(markdown) ||
    /^>>>>>>> /m.test(markdown) ||
    /^=======$/m.test(markdown) ||
    /^\|{7} /m.test(markdown)
  );
}

/** 去掉模型外层 ``` 围栏。 */
export function unwrapMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/);
  return m?.[1] ?? trimmed;
}
