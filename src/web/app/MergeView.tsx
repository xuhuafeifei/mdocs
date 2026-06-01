/**
 * 三栏手动 Merge：左本地 / 中合成 / 右远端（均为 Markdown）。
 */
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "../i18n";
import { LexicalMarkdownBridge } from "./LexicalMarkdownBridge";
import {
  convertContentApi,
  getDocumentApi,
  updateDocumentApi,
} from "../services/endpoints";
import type { DraftConflictRecord } from "../storage/drafts";
import type { DocumentDetail } from "../../shared/types/document";

type PaneMode = "source" | "preview";

function MergePane(props: {
  title: string;
  markdown: string;
  editable?: boolean;
  onChange?: (v: string) => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<PaneMode>("source");

  return (
    <section className="mdocs-merge-pane">
      <header className="mdocs-merge-pane-header">
        <span>{props.title}</span>
        <div className="mdocs-merge-pane-tabs">
          <button
            type="button"
            className={mode === "source" ? "active" : ""}
            onClick={() => setMode("source")}
          >
            {t("mergeSource")}
          </button>
          <button
            type="button"
            className={mode === "preview" ? "active" : ""}
            onClick={() => setMode("preview")}
          >
            {t("mergePreview")}
          </button>
        </div>
      </header>
      {mode === "source" ? (
        props.editable ? (
          <textarea
            className="mdocs-merge-textarea"
            value={props.markdown}
            onChange={(e) => props.onChange?.(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <pre className="mdocs-merge-readonly">{props.markdown}</pre>
        )
      ) : (
        <div className="mdocs-merge-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{props.markdown || ""}</ReactMarkdown>
        </div>
      )}
    </section>
  );
}

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
  const [remoteLexical, setRemoteLexical] = useState<string | null>(null);
  const [remoteMd, setRemoteMd] = useState("");
  const [mergedMd, setMergedMd] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingRemote(true);
    setRemoteLexical(null);
    setRemoteMd("");
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

  const handleRemoteMd = useCallback((md: string) => {
    setRemoteMd(md);
    setLoadingRemote(false);
  }, []);

  const handleLocalMd = useCallback((md: string) => {
    setLocalMd(md);
    setMergedMd((prev) => (prev ? prev : md));
  }, []);

  async function completeMerge(): Promise<void> {
    setBusy(true);
    try {
      const { content: lexical } = await convertContentApi({
        content: mergedMd,
        from: "markdown",
        to: "lexical",
      });
      const updated = await updateDocumentApi(props.documentId, {
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
      props.onSuccess(updated);
    } catch (err) {
      props.onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mdocs-merge-overlay">
      <LexicalMarkdownBridge
        lexicalJson={props.conflict.localSnapshotContent}
        onMarkdown={handleLocalMd}
        onError={() => props.onError(t("mergeLoadLocalFailed"))}
      />
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
        <h2>{t("mergeTitle")}</h2>
        <div className="mdocs-merge-toolbar-actions">
          <button type="button" className="secondary" disabled={busy} onClick={props.onClose}>
            {t("cancel")}
          </button>
          <button type="button" className="primary" disabled={busy || loadingRemote} onClick={() => void completeMerge()}>
            {busy ? t("publishing") : t("mergeComplete")}
          </button>
        </div>
      </header>
      <div className="mdocs-merge-columns">
        <MergePane title={t("mergeLocal")} markdown={localMd} />
        <MergePane title={t("mergeResult")} markdown={mergedMd} editable onChange={setMergedMd} />
        <MergePane
          title={loadingRemote ? t("mergeLoadingRemote") : t("mergeRemote")}
          markdown={remoteMd}
        />
      </div>
    </div>
  );
}
