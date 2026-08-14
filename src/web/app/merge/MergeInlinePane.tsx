/**
 * 冲突 Merge 单栏 inline：红=local（我的），绿=remote（别人的）；
 * 接收=remote，拒绝=local。有未决议时只读。
 */
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import type { MergeConflictSegment, MergeSegment } from "./merge-plan";

export function MergeInlinePane(props: {
  segments: MergeSegment[];
  unresolvedCount: number;
  onReceive: (conflictId: string) => void;
  onReject: (conflictId: string) => void;
  onUseAllMine: () => void;
  onUseAllTheirs: () => void;
  /** 全部决议后可编辑的正文 */
  editableMarkdown: string;
  onEditableChange: (md: string) => void;
}) {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const conflicts = props.segments.filter((s): s is MergeConflictSegment => s.kind === "conflict");
  const reviewing = props.unresolvedCount > 0;

  useEffect(() => {
    if (conflicts.length === 0) {
      setActive(0);
      return;
    }
    setActive((i) => Math.min(i, conflicts.length - 1));
  }, [conflicts.length]);

  function go(delta: number) {
    if (conflicts.length === 0) return;
    setActive((i) => {
      const next = (i + delta + conflicts.length) % conflicts.length;
      document.getElementById(`mdocs-merge-hunk-${next}`)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
      return next;
    });
  }

  let conflictIndex = -1;

  return (
    <div className="mdocs-merge-inline-pane">
      <div className="mdocs-merge-inline-toolbar">
        <span className="mdocs-merge-inline-hint">
          {reviewing
            ? t("mergeReviewHint")
            : conflicts.length === 0
              ? t("mergeNoConflicts")
              : t("mergeEditAfterResolve")}
        </span>
        {conflicts.length > 0 ? (
          <>
            <button type="button" onClick={props.onUseAllMine}>
              {t("mergeUseAllMine")}
            </button>
            <button type="button" onClick={props.onUseAllTheirs}>
              {t("mergeUseAllTheirs")}
            </button>
          </>
        ) : null}
      </div>

      {reviewing ? (
        <div className="mdocs-merge-inline" role="document">
          {props.segments.map((seg, segIdx) => {
            if (seg.kind === "unchanged") {
              return (
                <pre key={`u-${segIdx}`} className="mdocs-merge-inline-same">
                  {seg.lines.map((line, i) => (
                    <div key={i} className="mdocs-ai-write-line ctx">
                      <span className="mdocs-ai-write-rail" aria-hidden />
                      <span className="mdocs-ai-write-code">{line || " "}</span>
                    </div>
                  ))}
                </pre>
              );
            }
            conflictIndex += 1;
            const idx = conflictIndex;
            const resolved = seg.resolution !== "unresolved";
            const isActive = idx === active;
            return (
              <div
                key={seg.id}
                id={`mdocs-merge-hunk-${idx}`}
                className={
                  "mdocs-merge-inline-hunk" +
                  (isActive ? " is-active" : "") +
                  (resolved ? " is-resolved" : "")
                }
                onClick={() => setActive(idx)}
              >
                {!resolved ? (
                  <div className="mdocs-merge-hunk-actions">
                    <button
                      type="button"
                      className="mdocs-ai-write-hunk-reject"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onReject(seg.id);
                      }}
                    >
                      {t("mergeReject")}
                    </button>
                    <button
                      type="button"
                      className="mdocs-ai-write-hunk-accept"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onReceive(seg.id);
                      }}
                    >
                      {t("mergeReceive")}
                    </button>
                  </div>
                ) : (
                  <div className="mdocs-merge-hunk-resolved-tag">
                    {seg.resolution === "remote" ? t("mergeReceive") : t("mergeReject")}
                  </div>
                )}
                <pre className="mdocs-ai-write-hunk-pre">
                  {seg.localLines.map((line, i) => (
                    <div key={`l${i}`} className="mdocs-ai-write-line del">
                      <span className="mdocs-ai-write-rail" aria-hidden />
                      <span className="mdocs-ai-write-code">{line || " "}</span>
                    </div>
                  ))}
                  {seg.remoteLines.map((line, i) => (
                    <div key={`r${i}`} className="mdocs-ai-write-line add">
                      <span className="mdocs-ai-write-rail" aria-hidden />
                      <span className="mdocs-ai-write-code">{line || " "}</span>
                    </div>
                  ))}
                </pre>
              </div>
            );
          })}

          {conflicts.length > 0 ? (
            <div className="mdocs-ai-write-float-nav" role="toolbar" aria-label="冲突导航">
              <button type="button" aria-label="上一段" onClick={() => go(-1)}>
                ↑
              </button>
              <span>
                {active + 1} / {conflicts.length}
              </span>
              <button type="button" aria-label="下一段" onClick={() => go(1)}>
                ↓
              </button>
              {conflicts[active] && conflicts[active]!.resolution === "unresolved" ? (
                <>
                  <button
                    type="button"
                    className="mdocs-ai-write-hunk-reject"
                    onClick={() => props.onReject(conflicts[active]!.id)}
                  >
                    {t("mergeReject")}
                  </button>
                  <button
                    type="button"
                    className="mdocs-ai-write-hunk-accept"
                    onClick={() => props.onReceive(conflicts[active]!.id)}
                  >
                    {t("mergeReceive")}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <textarea
          className="mdocs-merge-inline-editor"
          value={props.editableMarkdown}
          onChange={(e) => props.onEditableChange(e.target.value)}
          spellCheck={false}
        />
      )}
    </div>
  );
}
