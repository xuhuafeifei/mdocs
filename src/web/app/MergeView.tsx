/**
 * IDEA 式三方 merge：左 local / 中 CodeMirror 结果（行内决议）/ 右 remote。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { LexicalMarkdownBridge } from "./LexicalMarkdownBridge";
import { MergeCodeMirrorPane } from "./merge/MergeCodeMirrorPane";
import { MergeResultEditor } from "./merge/MergeResultEditor";
import {
  assembleMergedMarkdown,
  buildThreeWayMergePlan,
  countConflicts,
  countUnresolvedConflicts,
  stripConflictPlaceholders,
  updateConflictResolution,
  type ConflictResolution,
  type MergeSegment,
} from "./merge/merge-plan";
import {
  convertContentApi,
  getDocumentApi,
  getDocumentMergeContextApi,
  updateDocumentApi,
} from "../services/endpoints";
import type { DraftConflictRecord } from "../storage/drafts";
import type { DocumentDetail } from "../../shared/types/document";

export interface MergeViewProps {
  documentId: string;
  displayName: string;
  conflict: DraftConflictRecord;
  onClose: () => void;
  onSuccess: (doc: DocumentDetail) => void;
  onError: (message: string) => void;
}

export function MergeView(props: MergeViewProps) {
  const { t } = useI18n();
  const [localMd, setLocalMd] = useState("");
  const [baseMd, setBaseMd] = useState("");
  const [baseLexical, setBaseLexical] = useState<string | null>(null);
  const [baseMissing, setBaseMissing] = useState(false);
  const [baseReady, setBaseReady] = useState(false);
  const [remoteLexical, setRemoteLexical] = useState<string | null>(null);
  const [remoteMd, setRemoteMd] = useState("");
  const [segments, setSegments] = useState<MergeSegment[] | null>(null);
  const [manualEdit, setManualEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(true);
  const resultEditorGetTextRef = useRef<(() => string) | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingRemote(true);
    setRemoteLexical(null);
    setRemoteMd("");
    setSegments(null);
    setManualEdit(false);
    void (async () => {
      try {
        const doc = await getDocumentApi(props.documentId);
        if (cancelled) return;
        setRemoteLexical(doc.content);
      } catch {
        if (!cancelled) props.onError(t("mergeLoadRemoteFailed"));
        if (!cancelled) setLoadingRemote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.documentId, props.onError, t]);

  useEffect(() => {
    let cancelled = false;
    setBaseLexical(null);
    setBaseMd("");
    setBaseMissing(false);
    setBaseReady(false);
    void (async () => {
      try {
        const ctx = await getDocumentMergeContextApi(
          props.documentId,
          props.conflict.localBaseCommitId,
          props.conflict.remoteCommitId,
        );
        if (cancelled) return;
        if (ctx.mode === "three_way" && ctx.mergeBaseContent) {
          setBaseLexical(ctx.mergeBaseContent);
          return;
        }
        setBaseMissing(true);
        setBaseReady(true);
      } catch {
        if (cancelled) return;
        setBaseMissing(true);
        setBaseReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.documentId, props.conflict.localBaseCommitId, props.conflict.remoteCommitId]);

  const handleRemoteMd = useCallback((md: string) => {
    setRemoteMd(md);
    setLoadingRemote(false);
  }, []);

  const handleLocalMd = useCallback((md: string) => {
    setLocalMd(md);
  }, []);

  const handleBaseMd = useCallback((md: string) => {
    setBaseMd(md);
    setBaseReady(true);
  }, []);

  const handleBaseBridgeError = useCallback(() => {
    setBaseMissing(true);
    setBaseMd("");
    setBaseReady(true);
  }, []);

  useEffect(() => {
    if (!localMd || !remoteMd || loadingRemote || !baseReady) return;
    setSegments(buildThreeWayMergePlan(localMd, baseMd, remoteMd));
    setManualEdit(false);
  }, [localMd, remoteMd, baseMd, baseReady, loadingRemote, props.conflict.remoteCommitId]);

  const publishMd = useMemo(() => {
    if (!segments) return "";
    return assembleMergedMarkdown(segments);
  }, [segments]);

  const conflictTotal = segments ? countConflicts(segments) : 0;
  const unresolvedCount = segments ? countUnresolvedConflicts(segments) : 0;

  function handleResolve(
    conflictId: string,
    resolution: ConflictResolution,
    manualLines?: string[],
  ): void {
    setSegments((prev) =>
      prev ? updateConflictResolution(prev, conflictId, resolution, manualLines) : prev,
    );
    setManualEdit(false);
  }

  async function completeMerge(): Promise<void> {
    if (unresolvedCount > 0) {
      props.onError(t("mergeConflictsUnresolved", { count: String(unresolvedCount) }));
      return;
    }
    const raw =
      manualEdit && resultEditorGetTextRef.current
        ? resultEditorGetTextRef.current()
        : publishMd;
    const body = stripConflictPlaceholders(raw);
    setBusy(true);
    try {
      const { content: lexical } = await convertContentApi({
        content: body,
        from: "markdown",
        to: "lexical",
      });
      await updateDocumentApi(props.documentId, {
        content: lexical,
        displayName: props.displayName,
        version: {
          localBaseCommitId: props.conflict.localBaseCommitId,
          merge: {
            remoteCommitId: props.conflict.remoteCommitId,
            localSnapshotContent: props.conflict.localSnapshotContent,
          },
        },
      });
      const updated = await getDocumentApi(props.documentId);
      props.onSuccess(updated);
    } catch (err) {
      props.onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(localMd && remoteMd && segments && !loadingRemote && baseReady);

  return (
    <div className="mdocs-merge-overlay">
      <LexicalMarkdownBridge
        lexicalJson={props.conflict.localSnapshotContent}
        onMarkdown={handleLocalMd}
        onError={() => props.onError(t("mergeLoadLocalFailed"))}
      />
      {baseLexical ? (
        <LexicalMarkdownBridge
          lexicalJson={baseLexical}
          onMarkdown={handleBaseMd}
          onError={handleBaseBridgeError}
        />
      ) : null}
      {remoteLexical ? (
        <LexicalMarkdownBridge
          lexicalJson={remoteLexical}
          onMarkdown={handleRemoteMd}
          onError={() => {
            setLoadingRemote(false);
            props.onError(t("mergeLoadRemoteFailed"));
          }}
        />
      ) : null}
      <header className="mdocs-merge-toolbar">
        <div className="mdocs-merge-toolbar-title">
          <h2>{t("mergeTitle")}</h2>
          {ready && conflictTotal > 0 ? (
            <span
              className={`mdocs-merge-conflict-pill ${unresolvedCount > 0 ? "pending" : "resolved"}`}
            >
              {unresolvedCount > 0
                ? t("mergeConflictsPending", {
                    unresolved: String(unresolvedCount),
                    total: String(conflictTotal),
                  })
                : t("mergeConflictsResolved", { total: String(conflictTotal) })}
            </span>
          ) : null}
          {baseMissing ? (
            <span className="mdocs-merge-base-warning">{t("mergeBaseMissing")}</span>
          ) : null}
        </div>
        <div className="mdocs-merge-toolbar-actions">
          <button type="button" className="secondary" disabled={busy} onClick={props.onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || !ready || unresolvedCount > 0}
            onClick={() => void completeMerge()}
          >
            {busy ? t("publishing") : t("mergeComplete")}
          </button>
        </div>
      </header>
      <div className="mdocs-merge-body">
        <aside className="mdocs-merge-side">
          <header className="mdocs-merge-pane-header mdocs-merge-pane-header-static">
            {t("mergeLocal")}
          </header>
          <MergeCodeMirrorPane doc={localMd} readOnly className="mdocs-merge-cm-side" />
        </aside>
        <main className="mdocs-merge-center">
          {!ready ? (
            <p className="mdocs-merge-loading">{t("mergeLoadingRemote")}</p>
          ) : (
            <>
              <header className="mdocs-merge-result-header">
                <h3>{t("mergeResult")}</h3>
                <span className="mdocs-merge-result-hint">{t("mergeResultInlineHint")}</span>
              </header>
              <MergeResultEditor
                segments={segments!}
                onResolve={handleResolve}
                getTextRef={resultEditorGetTextRef}
                onDocumentEdited={() => setManualEdit(true)}
              />
            </>
          )}
        </main>
        <aside className="mdocs-merge-side">
          <header className="mdocs-merge-pane-header mdocs-merge-pane-header-static">
            {loadingRemote ? t("mergeLoadingRemote") : t("mergeRemote")}
          </header>
          <MergeCodeMirrorPane doc={remoteMd} readOnly className="mdocs-merge-cm-side" />
        </aside>
      </div>
    </div>
  );
}
