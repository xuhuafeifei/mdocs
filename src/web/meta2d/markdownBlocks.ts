const META2_FENCE_RE = /```(?:meta2|meta)\b[^\n]*\n([\s\S]*?)\n```/g;

export interface Meta2BlockMatch {
  ordinal: number;
  start: number;
  end: number;
  body: string;
  bodyStart: number;
  bodyLine: number; // 1-based
}

function countNewlines(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) count += 1;
  }
  return count;
}

export function findMeta2Block(markdown: string, ordinal: number): Meta2BlockMatch | null {
  META2_FENCE_RE.lastIndex = 0;
  let idx = 0;
  while (true) {
    const m = META2_FENCE_RE.exec(markdown);
    if (!m) return null;
    if (idx !== ordinal) {
      idx += 1;
      continue;
    }

    const full = m[0] ?? "";
    const body = m[1] ?? "";
    const start = m.index;
    const end = start + full.length;
    const localBodyOffset = full.indexOf(body);
    const bodyStart = start + Math.max(0, localBodyOffset);
    const bodyLine = 1 + countNewlines(markdown.slice(0, bodyStart));

    return {
      ordinal,
      start,
      end,
      body,
      bodyStart,
      bodyLine,
    };
  }
}

export function removeMeta2Block(markdown: string, ordinal: number): string | null {
  const match = findMeta2Block(markdown, ordinal);
  if (!match) return null;

  const before = markdown.slice(0, match.start);
  const after = markdown.slice(match.end);

  // Avoid leaving too many blank lines around the removed block.
  const joined = (before.replace(/\n{3,}$/, "\n\n") + after.replace(/^\n{3,}/, "\n\n"))
    .replace(/\n{4,}/g, "\n\n\n");
  return joined;
}

