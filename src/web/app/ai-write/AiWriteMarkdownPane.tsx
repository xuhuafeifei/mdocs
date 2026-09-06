import { useEffect, useMemo, useRef, useState } from "react";
import { acceptHunk, computeLineHunks, type MdHunk } from "./markdown-hunks";

type InlineSeg =
  | { kind: "same"; lines: string[]; key: string }
  | { kind: "hunk"; hunk: MdHunk; hunkIndex: number; key: string };

type DiffEdits = {
  sameTexts: string[];
  newTexts: string[];
};

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split("\n");
}

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

function buildInlineSegments(currentMd: string, hunks: MdHunk[]): InlineSeg[] {
  const cur = splitLines(currentMd);
  const segs: InlineSeg[] = [];
  let oi = 0;
  hunks.forEach((h, idx) => {
    if (h.oldStart > oi) {
      segs.push({
        kind: "same",
        lines: cur.slice(oi, h.oldStart),
        key: `s-${oi}-${h.oldStart}`,
      });
    }
    segs.push({ kind: "hunk", hunk: h, hunkIndex: idx, key: `h-${h.id}-${idx}` });
    oi = h.oldEnd;
  });
  if (oi < cur.length) {
    segs.push({ kind: "same", lines: cur.slice(oi), key: `s-${oi}-end` });
  } else if (hunks.length === 0 && cur.length === 0) {
    segs.push({ kind: "same", lines: [], key: "s-empty" });
  }
  return segs;
}

function initEditsFromSegments(segments: InlineSeg[]): DiffEdits {
  const sameTexts: string[] = [];
  const newTexts: string[] = [];
  for (const seg of segments) {
    if (seg.kind === "same") sameTexts.push(joinLines(seg.lines));
    else newTexts.push(joinLines(seg.hunk.newLines));
  }
  return { sameTexts, newTexts };
}

/** 相同行 + 绿增拼回 proposed（红删不参与） */
export function rebuildProposedFromEdits(segments: InlineSeg[], edits: DiffEdits): string {
  const out: string[] = [];
  let si = 0;
  let ni = 0;
  for (const seg of segments) {
    if (seg.kind === "same") {
      const t = edits.sameTexts[si++] ?? "";
      out.push(...splitLines(t));
    } else {
      const t = edits.newTexts[ni++] ?? "";
      out.push(...splitLines(t));
    }
  }
  return joinLines(out);
}

function hunkTone(h: MdHunk): "add" | "del" | "mod" {
  if (h.oldLines.length === 0) return "add";
  if (h.newLines.length === 0) return "del";
  return "mod";
}

function EditableBlock(props: {
  className: string;
  value: string;
  onChange: (v: string) => void;
  onBlurFlush: () => void;
  "aria-label": string;
}) {
  const rows = Math.max(1, splitLines(props.value).length);
  return (
    <div className={`mdocs-ai-write-line ${props.className}`}>
      <span className="mdocs-ai-write-rail" aria-hidden />
      <textarea
        className="mdocs-ai-write-inline-edit"
        value={props.value}
        rows={rows}
        spellCheck={false}
        aria-label={props["aria-label"]}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={() => props.onBlurFlush()}
      />
    </div>
  );
}

/**
 * 右侧：有 pending hunk 且非流式 → 强制 inline diff（可改 proposedMd，红删只读）；
 * 无 hunk 或流式中 → 源码编 currentMd。写回仍只交 currentMd。
 *
 * 手改 blur 只 flush 提案文本，**冻结**当前分段布局，避免 LCS 重算把 diff 打成「上删下增」。
 * 接受 / 拒绝 / 新提案到达后再重算布局。
 */
export function AiWriteMarkdownPane(props: {
  currentMd: string;
  proposedMd: string | null;
  /** 流式中强制源码编辑 */
  sending?: boolean;
  onCurrentChange: (md: string) => void;
  onProposedChange: (md: string | null) => void;
}) {
  const sending = Boolean(props.sending);
  const [activeHunk, setActiveHunk] = useState(0);
  const [hoveredHunk, setHoveredHunk] = useState<number | null>(null);
  const [edits, setEdits] = useState<DiffEdits>({ sameTexts: [], newTexts: [] });
  /** 审阅期冻结的分段；flush 不改，接受/拒绝/新提案才换 */
  const [reviewSegments, setReviewSegments] = useState<InlineSeg[]>([]);
  const dirtyRef = useRef(false);
  /** 下一次 proposedMd 更新来自本地 flush，跳过布局重算 */
  const skipRelayoutRef = useRef(false);
  const reviewSegmentsRef = useRef<InlineSeg[]>([]);
  const editsRef = useRef(edits);
  editsRef.current = edits;
  reviewSegmentsRef.current = reviewSegments;

  const liveHunks = useMemo(() => {
    if (props.proposedMd == null || props.proposedMd === props.currentMd) return [];
    return computeLineHunks(props.currentMd, props.proposedMd);
  }, [props.currentMd, props.proposedMd]);

  const showInlineDiff = !sending && (reviewSegments.length > 0
    ? reviewSegments.some((s) => s.kind === "hunk")
    : liveHunks.length > 0);

  // 进入 / 离开 diff，或 current/提案从外部变化（非 flush）时重建冻结布局
  useEffect(() => {
    if (sending) {
      setReviewSegments([]);
      dirtyRef.current = false;
      skipRelayoutRef.current = false;
      return;
    }
    if (props.proposedMd == null || props.proposedMd === props.currentMd) {
      setReviewSegments([]);
      dirtyRef.current = false;
      skipRelayoutRef.current = false;
      return;
    }
    if (skipRelayoutRef.current) {
      skipRelayoutRef.current = false;
      return;
    }
    const hunks = computeLineHunks(props.currentMd, props.proposedMd);
    if (hunks.length === 0) {
      setReviewSegments([]);
      return;
    }
    const nextSegs = buildInlineSegments(props.currentMd, hunks);
    setReviewSegments(nextSegs);
    dirtyRef.current = false;
    setEdits(initEditsFromSegments(nextSegs));
  }, [sending, props.proposedMd, props.currentMd]);

  const reviewHunks = useMemo(
    () =>
      reviewSegments
        .filter((s): s is Extract<InlineSeg, { kind: "hunk" }> => s.kind === "hunk")
        .map((s) => s.hunk),
    [reviewSegments],
  );

  useEffect(() => {
    if (reviewHunks.length === 0) {
      setActiveHunk(0);
      return;
    }
    setActiveHunk((i) => Math.min(i, reviewHunks.length - 1));
  }, [reviewHunks.length]);

  const focusIndex = hoveredHunk ?? activeHunk;

  function readFlushedProposed(): string {
    return rebuildProposedFromEdits(reviewSegmentsRef.current, editsRef.current);
  }

  function flushProposedFromEdits(): string | null {
    if (!showInlineDiff || reviewSegmentsRef.current.length === 0) {
      return props.proposedMd;
    }
    const next = readFlushedProposed();
    dirtyRef.current = false;
    if (next === props.currentMd) {
      skipRelayoutRef.current = false;
      props.onProposedChange(null);
      return null;
    }
    if (next !== props.proposedMd) {
      skipRelayoutRef.current = true;
      props.onProposedChange(next);
    }
    return next;
  }

  function onAccept(h: MdHunk) {
    const seg = reviewSegmentsRef.current.find(
      (s): s is Extract<InlineSeg, { kind: "hunk" }> =>
        s.kind === "hunk" && s.hunk.id === h.id,
    );
    if (!seg) return;
    const editedNew = editsRef.current.newTexts[seg.hunkIndex];
    const effective: MdHunk = {
      ...h,
      newLines: editedNew != null ? splitLines(editedNew) : h.newLines,
    };
    const flushed = readFlushedProposed();
    dirtyRef.current = false;
    skipRelayoutRef.current = false;
    if (flushed === props.currentMd) {
      props.onProposedChange(null);
      return;
    }
    const nextCurrent = acceptHunk(props.currentMd, effective);
    props.onCurrentChange(nextCurrent);
    if (flushed === nextCurrent) props.onProposedChange(null);
    else props.onProposedChange(flushed);
  }

  function onReject(h: MdHunk) {
    const seg = reviewSegmentsRef.current.find(
      (s): s is Extract<InlineSeg, { kind: "hunk" }> =>
        s.kind === "hunk" && s.hunk.id === h.id,
    );
    if (!seg) return;
    const nextEdits: DiffEdits = {
      sameTexts: editsRef.current.sameTexts.slice(),
      newTexts: editsRef.current.newTexts.slice(),
    };
    nextEdits.newTexts[seg.hunkIndex] = joinLines(h.oldLines);
    const nextProposed = rebuildProposedFromEdits(reviewSegmentsRef.current, nextEdits);
    dirtyRef.current = false;
    skipRelayoutRef.current = false;
    if (nextProposed === props.currentMd) props.onProposedChange(null);
    else props.onProposedChange(nextProposed);
  }

  function acceptAll() {
    const flushed = readFlushedProposed();
    dirtyRef.current = false;
    skipRelayoutRef.current = false;
    props.onCurrentChange(flushed);
    props.onProposedChange(null);
  }

  function rejectAll() {
    dirtyRef.current = false;
    skipRelayoutRef.current = false;
    props.onProposedChange(null);
  }

  function goHunk(delta: number) {
    if (reviewHunks.length === 0) return;
    setActiveHunk((i) => {
      const next = (i + delta + reviewHunks.length) % reviewHunks.length;
      const el = document.getElementById(`mdocs-ai-hunk-${next}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return next;
    });
  }

  function setSameText(index: number, value: string) {
    dirtyRef.current = true;
    setEdits((prev) => {
      const sameTexts = prev.sameTexts.slice();
      sameTexts[index] = value;
      return { ...prev, sameTexts };
    });
  }

  function setNewText(index: number, value: string) {
    dirtyRef.current = true;
    setEdits((prev) => {
      const newTexts = prev.newTexts.slice();
      newTexts[index] = value;
      return { ...prev, newTexts };
    });
  }

  const focused = reviewHunks[focusIndex] ?? null;
  let sameCounter = 0;

  return (
    <div className="mdocs-ai-write-md-pane">
      <div className="mdocs-ai-write-diff-toolbar">
        <span className="mdocs-ai-write-diff-count">
          {sending
            ? "接收中·编辑我的稿"
            : reviewHunks.length === 0
              ? props.proposedMd
                ? "与提案一致（可编辑）"
                : "Markdown 源码（可编辑）"
              : `${reviewHunks.length} 处变更（可改提案）`}
        </span>
        {!sending && reviewHunks.length > 0 ? (
          <>
            <button type="button" onClick={acceptAll}>
              全部接受
            </button>
            <button type="button" onClick={rejectAll}>
              全部拒绝
            </button>
          </>
        ) : null}
      </div>

      {showInlineDiff && reviewSegments.length > 0 ? (
        <div className="mdocs-ai-write-inline" role="document">
          {reviewSegments.map((seg) => {
            if (seg.kind === "same") {
              const sameIndex = sameCounter++;
              const text = edits.sameTexts[sameIndex] ?? joinLines(seg.lines);
              return (
                <div key={seg.key} className="mdocs-ai-write-inline-same">
                  <EditableBlock
                    className="ctx"
                    value={text}
                    aria-label="提案相同行"
                    onChange={(v) => setSameText(sameIndex, v)}
                    onBlurFlush={() => flushProposedFromEdits()}
                  />
                </div>
              );
            }
            const h = seg.hunk;
            const tone = hunkTone(h);
            const isActive = seg.hunkIndex === focusIndex;
            const newText = edits.newTexts[seg.hunkIndex] ?? joinLines(h.newLines);
            return (
              <div
                key={seg.key}
                id={`mdocs-ai-hunk-${seg.hunkIndex}`}
                className={
                  "mdocs-ai-write-inline-hunk" +
                  ` mdocs-ai-write-inline-hunk-${tone}` +
                  (isActive ? " is-active" : "")
                }
                onMouseEnter={() => setHoveredHunk(seg.hunkIndex)}
                onMouseLeave={() => setHoveredHunk(null)}
                onClick={() => setActiveHunk(seg.hunkIndex)}
              >
                <div className="mdocs-ai-write-hunk-hover" hidden={hoveredHunk !== seg.hunkIndex}>
                  <button
                    type="button"
                    className="mdocs-ai-write-hunk-reject"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReject(h);
                    }}
                  >
                    拒绝
                  </button>
                  <button
                    type="button"
                    className="mdocs-ai-write-hunk-accept"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccept(h);
                    }}
                  >
                    接受
                  </button>
                </div>
                <pre className="mdocs-ai-write-hunk-pre">
                  {h.oldLines.map((line, i) => (
                    <div key={`o${i}`} className="mdocs-ai-write-line del mdocs-ai-write-line-readonly">
                      <span className="mdocs-ai-write-rail" aria-hidden />
                      <span className="mdocs-ai-write-code">{line || " "}</span>
                    </div>
                  ))}
                </pre>
                {h.newLines.length > 0 || newText !== "" || tone !== "del" ? (
                  <EditableBlock
                    className="add"
                    value={newText}
                    aria-label="提案新增行"
                    onChange={(v) => setNewText(seg.hunkIndex, v)}
                    onBlurFlush={() => flushProposedFromEdits()}
                  />
                ) : null}
              </div>
            );
          })}

          {focused ? (
            <div className="mdocs-ai-write-float-nav" role="toolbar" aria-label="变更导航">
              <button type="button" aria-label="上一段" onClick={() => goHunk(-1)}>
                ↑
              </button>
              <span>
                {focusIndex + 1} / {reviewHunks.length}
              </span>
              <button type="button" aria-label="下一段" onClick={() => goHunk(1)}>
                ↓
              </button>
              <button
                type="button"
                className="mdocs-ai-write-hunk-reject"
                onClick={() => onReject(focused)}
              >
                拒绝
              </button>
              <button
                type="button"
                className="mdocs-ai-write-hunk-accept"
                onClick={() => onAccept(focused)}
              >
                接受
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <textarea
          className="mdocs-ai-write-editor"
          value={props.currentMd}
          onChange={(e) => props.onCurrentChange(e.target.value)}
          spellCheck={false}
          placeholder="# 标题&#10;&#10;在此编辑 Markdown 源码…"
        />
      )}
    </div>
  );
}
