/**
 * 冲突 Merge：
 * - md：Lexical → LexicalMarkdownBridge → MD → merge-plan → convert → Lexical
 * - html：原文直通 merge-plan → updateDocument
 * - sheet：整表二选一（用我的 / 用别人的），不做 JSON 行级 merge
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { LexicalMarkdownBridge } from "./LexicalMarkdownBridge";
import { MergeInlinePane } from "./merge/MergeInlinePane";
import { SheetWholeMergePane } from "./merge/SheetWholeMergePane";
import {
  assembleMergedMarkdown,
  buildThreeWayMergePlan,
  countConflicts,
  countUnresolvedConflicts,
  stripConflictPlaceholders,
  updateConflictResolution,
  type MergeSegment,
} from "./merge/merge-plan";
import {
  convertContentApi,
  getDocumentApi,
  getDocumentMergeContextApi,
  updateDocumentApi,
} from "../services/endpoints";
import { ApiRequestError } from "../services/api-request-error";
import type { DraftConflictRecord } from "../storage/drafts";
import type { DocumentDetail } from "../../shared/types/document";
import { getPolicy } from "../../shared/file-type-policy";
import type { FileType } from "../../shared/file-types";
import { publishSheetWholeChoice } from "./merge/sheet-whole-publish";
import {
  isSameMarkdownBody,
  publishLineMergeDocument,
} from "./merge/line-merge-publish";

export interface MergeViewProps {
  documentId: string;
  displayName: string;
  conflict: DraftConflictRecord;
  /** 缺省 md；html 走 raw-text；sheet 走 whole-document */
  fileType?: string;
  onClose: () => void;
  onSuccess: (doc: DocumentDetail) => void | Promise<void>;
  onError: (message: string) => void;
  /** 仅文档所有者：整表 merge 页也可强制覆盖 */
  onForceOverwrite?: () => void;
  forceBusy?: boolean;
}

export function MergeView(props: MergeViewProps) {
  const { t } = useI18n();
  const mergePipeline =
    getPolicy((props.fileType ?? "md") as FileType)?.mergePipeline ?? "lexical-md-bridge";
  const isWholeDocument = mergePipeline === "whole-document";
  const isRawText = mergePipeline === "raw-text";

  if (isWholeDocument) {
    return <SheetWholeDocumentMerge {...props} />;
  }

  return (
    <LineBasedMergeView {...props} isRawText={isRawText} />
  );
}

function SheetWholeDocumentMerge(props: MergeViewProps) {
  const { t } = useI18n();
  const [remoteContent, setRemoteContent] = useState("");
  const [loadingRemote, setLoadingRemote] = useState(true);
  const [busy, setBusy] = useState(false);
  const localContent = props.conflict.localSnapshotContent;

  useEffect(() => {
    let cancelled = false;
    setLoadingRemote(true);
    setRemoteContent("");
    void (async () => {
      try {
        const doc = await getDocumentApi(props.documentId);
        if (cancelled) return;
        setRemoteContent(doc.content);
      } catch {
        if (!cancelled) props.onError(t("mergeLoadRemoteFailed"));
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.documentId, props.onError, t]);

  async function publishSide(side: "local" | "remote"): Promise<void> {
    if (side === "local" && !localContent.trim()) {
      props.onError(t("mergeLoadLocalFailed"));
      return;
    }
    if (side === "remote" && !remoteContent.trim()) {
      props.onError(t("mergeLoadRemoteFailed"));
      return;
    }
    setBusy(true);
    try {
      // 发布前重新拉 tip：冲突页里缓存的 remoteCommitId 可能已落后，再用会 409
      const updated = await publishSheetWholeChoice({
        documentId: props.documentId,
        displayName: props.displayName,
        side,
        localContent: props.conflict.localSnapshotContent || localContent,
        localBaseCommitId: props.conflict.localBaseCommitId,
        getDocument: getDocumentApi,
        updateDocument: updateDocumentApi,
      });
      await props.onSuccess(updated);
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      props.onError(msg);
    } finally {
      setBusy(false);
    }
  }

  const ready = !loadingRemote;
  const actionBusy = busy || Boolean(props.forceBusy);

  return (
    <div className="mdocs-merge-overlay">
      <header className="mdocs-merge-toolbar">
        <div className="mdocs-merge-toolbar-title">
          <h2>{t("mergeTitle")}</h2>
          <span className="mdocs-merge-conflict-pill pending">{t("sheetMergeModeBadge")}</span>
        </div>
        <div className="mdocs-merge-toolbar-actions">
          <button type="button" className="secondary" disabled={actionBusy} onClick={props.onClose}>
            {t("cancel")}
          </button>
        </div>
      </header>
      <div className="mdocs-merge-body mdocs-merge-body--sheet-whole">
        {!ready ? (
          <p className="mdocs-merge-loading">{t("mergeLoadingRemote")}</p>
        ) : (
          <SheetWholeMergePane
            localContent={localContent}
            remoteContent={remoteContent}
            busy={actionBusy}
            onUseMine={() => void publishSide("local")}
            onUseTheirs={() => void publishSide("remote")}
            onForceOverwrite={props.onForceOverwrite}
            forceBusy={props.forceBusy}
          />
        )}
      </div>
    </div>
  );
}

function LineBasedMergeView(
  props: MergeViewProps & { isRawText: boolean },
) {
  const { t } = useI18n();
  const { isRawText } = props;

  const [localMd, setLocalMd] = useState("");
  const [baseMd, setBaseMd] = useState("");
  const [baseLexical, setBaseLexical] = useState<string | null>(null);
  const [baseMissing, setBaseMissing] = useState(false);
  const [baseReady, setBaseReady] = useState(false);
  const [remoteLexical, setRemoteLexical] = useState<string | null>(null);
  const [remoteMd, setRemoteMd] = useState("");
  const [segments, setSegments] = useState<MergeSegment[] | null>(null);
  const [editedMd, setEditedMd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingRemote(true);
    setRemoteLexical(null);
    setRemoteMd("");
    setSegments(null);
    setEditedMd(null);
    void (async () => {
      try {
        const doc = await getDocumentApi(props.documentId);
        if (cancelled) return;
        if (isRawText) {
          setRemoteMd(doc.content);
          setLoadingRemote(false);
        } else {
          setRemoteLexical(doc.content);
        }
      } catch {
        if (!cancelled) props.onError(t("mergeLoadRemoteFailed"));
        if (!cancelled) setLoadingRemote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.documentId, props.onError, t, isRawText]);

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
          if (isRawText) {
            setBaseMd(ctx.mergeBaseContent);
            setBaseReady(true);
          } else {
            setBaseLexical(ctx.mergeBaseContent);
          }
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
  }, [
    props.documentId,
    props.conflict.localBaseCommitId,
    props.conflict.remoteCommitId,
    isRawText,
  ]);

  useEffect(() => {
    if (!isRawText) return;
    setLocalMd(props.conflict.localSnapshotContent);
  }, [isRawText, props.conflict.localSnapshotContent]);

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
    setEditedMd(null);
  }, [localMd, remoteMd, baseMd, baseReady, loadingRemote, props.conflict.remoteCommitId]);

  const assembledMd = useMemo(() => {
    if (!segments) return "";
    return stripConflictPlaceholders(assembleMergedMarkdown(segments));
  }, [segments]);

  const conflictTotal = segments ? countConflicts(segments) : 0;
  const unresolvedCount = segments ? countUnresolvedConflicts(segments) : 0;
  const publishBody = editedMd ?? assembledMd;

  useEffect(() => {
    if (unresolvedCount === 0 && segments && editedMd === null) {
      setEditedMd(assembledMd);
    }
  }, [unresolvedCount, segments, assembledMd, editedMd]);

  function resolveAll(resolution: "local" | "remote"): void {
    setSegments((prev) => {
      if (!prev) return prev;
      let next = prev;
      for (const seg of prev) {
        if (seg.kind === "conflict") {
          next = updateConflictResolution(next, seg.id, resolution);
        }
      }
      return next;
    });
    setEditedMd(null);
  }

  async function completeMerge(): Promise<void> {
    if (unresolvedCount > 0) {
      props.onError(t("mergeConflictsUnresolved", { count: String(unresolvedCount) }));
      return;
    }
    const body = stripConflictPlaceholders(publishBody);
    setBusy(true);
    try {
      // 全盘接收「别人的」时直写 tip Lexical，避免 MD↔Lexical 往返丢 list/table，
      // 也避免旧桥截断后的残缺 MD 写回云端。
      const tip = await getDocumentApi(props.documentId);
      const content = isRawText
        ? body
        : remoteMd && isSameMarkdownBody(body, remoteMd)
          ? tip.content
          : (
              await convertContentApi({
                content: body,
                from: "markdown",
                to: "lexical",
              })
            ).content;

      const updated = await publishLineMergeDocument({
        documentId: props.documentId,
        displayName: props.displayName,
        content,
        localBaseCommitId: props.conflict.localBaseCommitId,
        localSnapshotContent: props.conflict.localSnapshotContent,
        getDocument: getDocumentApi,
        updateDocument: updateDocumentApi,
      });
      await props.onSuccess(updated);
    } catch (err) {
      props.onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(localMd && remoteMd && segments && !loadingRemote && baseReady);

  return (
    <div className="mdocs-merge-overlay">
      {!isRawText ? (
        <>
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
        </>
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
      <div className="mdocs-merge-body mdocs-merge-body--inline">
        {!ready ? (
          <p className="mdocs-merge-loading">{t("mergeLoadingRemote")}</p>
        ) : (
          <MergeInlinePane
            segments={segments!}
            unresolvedCount={unresolvedCount}
            onReceive={(id) => {
              setSegments((prev) => (prev ? updateConflictResolution(prev, id, "remote") : prev));
              setEditedMd(null);
            }}
            onReject={(id) => {
              setSegments((prev) => (prev ? updateConflictResolution(prev, id, "local") : prev));
              setEditedMd(null);
            }}
            onUseAllMine={() => resolveAll("local")}
            onUseAllTheirs={() => resolveAll("remote")}
            editableMarkdown={publishBody}
            onEditableChange={setEditedMd}
          />
        )}
      </div>
    </div>
  );
}
