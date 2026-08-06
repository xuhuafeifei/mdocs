import { useEffect, useMemo, useState } from "react";
import { acceptHunk, computeLineHunks, rejectHunkFromProposed, type MdHunk } from "./markdown-hunks";

type InlineSeg =
  | { kind: "same"; lines: string[]; key: string }
  | { kind: "hunk"; hunk: MdHunk; hunkIndex: number; key: string };

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split("\n");
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

function hunkTone(h: MdHunk): "add" | "del" | "mod" {
  if (h.oldLines.length === 0) return "add";
  if (h.newLines.length === 0) return "del";
  return "mod";
}

/**
 * 右侧：有 hunk 时默认源码可编；「查看 diff」进入只读审阅。
 * diff 内直接编辑：本期不做。
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
  /** false = 源码编辑；true = 只读 diff（有 hunk 时） */
  const [reviewDiff, setReviewDiff] = useState(false);
  const [activeHunk, setActiveHunk] = useState(0);
  const [hoveredHunk, setHoveredHunk] = useState<number | null>(null);

  const hunks = useMemo(() => {
    if (props.proposedMd == null || props.proposedMd === props.currentMd) return [];
    return computeLineHunks(props.currentMd, props.proposedMd);
  }, [props.currentMd, props.proposedMd]);

  const segments = useMemo(
    () => buildInlineSegments(props.currentMd, hunks),
    [props.currentMd, hunks],
  );

  useEffect(() => {
    if (hunks.length === 0) {
      setActiveHunk(0);
      setReviewDiff(false);
      return;
    }
    setActiveHunk((i) => Math.min(i, hunks.length - 1));
  }, [hunks.length]);

  useEffect(() => {
    if (sending) setReviewDiff(false);
  }, [sending]);

  const showInlineDiff = !sending && reviewDiff && hunks.length > 0;
  const focusIndex = hoveredHunk ?? activeHunk;

  function onAccept(h: MdHunk) {
    const nextCurrent = acceptHunk(props.currentMd, h);
    props.onCurrentChange(nextCurrent);
    if (props.proposedMd != null) {
      const still = computeLineHunks(nextCurrent, props.proposedMd);
      if (still.length === 0) props.onProposedChange(null);
    }
  }

  function onReject(h: MdHunk) {
    if (props.proposedMd == null) return;
    const nextProposed = rejectHunkFromProposed(props.proposedMd, h);
    if (nextProposed === props.currentMd) props.onProposedChange(null);
    else props.onProposedChange(nextProposed);
  }

  function acceptAll() {
    if (props.proposedMd == null) return;
    props.onCurrentChange(props.proposedMd);
    props.onProposedChange(null);
  }

  function rejectAll() {
    props.onProposedChange(null);
  }

  function goHunk(delta: number) {
    if (hunks.length === 0) return;
    setActiveHunk((i) => {
      const next = (i + delta + hunks.length) % hunks.length;
      const el = document.getElementById(`mdocs-ai-hunk-${next}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return next;
    });
  }

  const focused = hunks[focusIndex] ?? null;

  return (
    <div className="mdocs-ai-write-md-pane">
      <div className="mdocs-ai-write-diff-toolbar">
        <span className="mdocs-ai-write-diff-count">
          {sending
            ? "接收中·编辑我的稿"
            : hunks.length === 0
              ? props.proposedMd
                ? "与提案一致（可编辑）"
                : "Markdown 源码（可编辑）"
              : reviewDiff
                ? `${hunks.length} 处变更`
                : `${hunks.length} 处变更（编辑中）`}
        </span>
        {!sending && hunks.length > 0 ? (
          <>
            <button type="button" onClick={acceptAll}>
              全部接受
            </button>
            <button type="button" onClick={rejectAll}>
              全部拒绝
            </button>
            <button
              type="button"
              className={reviewDiff ? "active" : ""}
              onClick={() => setReviewDiff((v) => !v)}
            >
              {reviewDiff ? "编辑我的稿" : "查看 diff"}
            </button>
          </>
        ) : null}
      </div>

      {showInlineDiff ? (
        <div className="mdocs-ai-write-inline" role="document">
          {segments.map((seg) => {
            if (seg.kind === "same") {
              return (
                <pre key={seg.key} className="mdocs-ai-write-inline-same">
                  {seg.lines.map((line, i) => (
                    <div key={i} className="mdocs-ai-write-line ctx">
                      <span className="mdocs-ai-write-rail" aria-hidden />
                      <span className="mdocs-ai-write-code">{line || " "}</span>
                    </div>
                  ))}
                </pre>
              );
            }
            const h = seg.hunk;
            const tone = hunkTone(h);
            const isActive = seg.hunkIndex === focusIndex;
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
                    <div key={`o${i}`} className="mdocs-ai-write-line del">
                      <span className="mdocs-ai-write-rail" aria-hidden />
                      <span className="mdocs-ai-write-code">{line || " "}</span>
                    </div>
                  ))}
                  {h.newLines.map((line, i) => (
                    <div key={`n${i}`} className="mdocs-ai-write-line add">
                      <span className="mdocs-ai-write-rail" aria-hidden />
                      <span className="mdocs-ai-write-code">{line || " "}</span>
                    </div>
                  ))}
                </pre>
              </div>
            );
          })}

          {focused ? (
            <div className="mdocs-ai-write-float-nav" role="toolbar" aria-label="变更导航">
              <button type="button" aria-label="上一段" onClick={() => goHunk(-1)}>
                ↑
              </button>
              <span>
                {focusIndex + 1} / {hunks.length}
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
