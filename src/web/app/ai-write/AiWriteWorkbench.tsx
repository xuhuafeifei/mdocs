import { useEffect, useRef, useState } from "react";
import deepseekLogoUrl from "../../assets/deepseek.svg";
import { bindCodingSessionDocumentApi } from "../../services/endpoints";
import { AgentChatPanel } from "../AgentChatPanel";
import { AiWriteMarkdownPane } from "./AiWriteMarkdownPane";
import { computeLineHunks } from "./markdown-hunks";
import { ConfirmDialog } from "../ConfirmDialog";

/**
 * 帮写全屏层：左栏复用智能助手对话面板（mode=coding），右栏 MD + hunk 审阅。
 */
export function AiWriteWorkbench(props: {
  open: boolean;
  /** 进场 MD；新建可为空 */
  initialMarkdown: string;
  documentId: string | null;
  displayName: string;
  onClose: () => void;
  onComplete: (result: {
    markdown: string;
    documentId: string | null;
    displayName: string;
  }) => void | Promise<void | { documentId: string }>;
}) {
  const [currentMd, setCurrentMd] = useState(props.initialMarkdown);
  const [proposedMd, setProposedMd] = useState<string | null>(null);
  const [baseMd] = useState(props.initialMarkdown);
  const [title, setTitle] = useState(props.displayName || "未命名");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyComplete, setBusyComplete] = useState(false);
  const [confirmAsk, setConfirmAsk] = useState<{
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    danger: boolean;
  } | null>(null);
  const confirmResolveRef = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setCurrentMd(props.initialMarkdown);
    setProposedMd(null);
    setTitle(props.displayName || "未命名");
    setError(null);
  }, [props.open, props.initialMarkdown, props.displayName, props.documentId]);

  if (!props.open) return null;

  const pendingHunks =
    proposedMd != null && proposedMd !== currentMd
      ? computeLineHunks(currentMd, proposedMd)
      : [];

  function askConfirm(opts: {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmAsk({
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? "确定",
        cancelLabel: opts.cancelLabel ?? "返回",
        danger: opts.danger ?? false,
      });
    });
  }

  function settleConfirm(ok: boolean) {
    const resolve = confirmResolveRef.current;
    confirmResolveRef.current = null;
    setConfirmAsk(null);
    resolve?.(ok);
  }

  async function finish() {
    const ok = await askConfirm({
      message: "是否回写",
      confirmLabel: "确认",
      cancelLabel: "返回",
    });
    if (!ok) return;
    let md = currentMd;
    if (pendingHunks.length > 0) {
      md = proposedMd ?? currentMd;
      setCurrentMd(md);
      setProposedMd(null);
    }
    setBusyComplete(true);
    const startedBlank = !props.documentId;
    try {
      const out = await props.onComplete({
        markdown: md,
        documentId: props.documentId,
        displayName: title.trim() || "未命名",
      });
      const newDocId =
        out && typeof out === "object" && typeof out.documentId === "string"
          ? out.documentId.trim()
          : "";
      if (startedBlank && newDocId && sessionId) {
        try {
          await bindCodingSessionDocumentApi(sessionId, newDocId);
        } catch {
          /* 写回已成功，绑定失败不阻断关闭 */
        }
      }
      props.onClose();
    } catch (err) {
      if ((err as { silent?: boolean } | null)?.silent) return;
      if (err instanceof Error && err.message === "cancelled") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyComplete(false);
    }
  }

  async function onCancel() {
    if (currentMd !== baseMd || proposedMd != null) {
      const ok = await askConfirm({
        message: "取消帮写？未写回的修改将丢失。",
        confirmLabel: "放弃修改",
        danger: true,
      });
      if (!ok) return;
    }
    props.onClose();
  }

  return (
    <div className="mdocs-ai-write-overlay" role="dialog" aria-modal="true" aria-label="帮写">
      <header className="mdocs-ai-write-header">
        <div className="mdocs-ai-write-header-left">
          <img src={deepseekLogoUrl} alt="" className="mdocs-ai-write-title-logo" />
          <strong>帮写</strong>
          <input
            className="mdocs-ai-write-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="文档标题"
          />
        </div>
        <div className="mdocs-ai-write-header-actions">
          <button type="button" onClick={() => void onCancel()} disabled={busyComplete || confirmAsk != null}>
            取消
          </button>
          <button
            type="button"
            className="mdocs-ai-write-primary"
            onClick={() => void finish()}
            disabled={busyComplete || confirmAsk != null}
          >
            {busyComplete ? "写回中…" : "完成并写回"}
          </button>
        </div>
      </header>
      {error ? <p className="mdocs-ai-write-error">{error}</p> : null}
      <div className="mdocs-ai-write-body">
        <section className="mdocs-ai-write-chat">
          <AgentChatPanel
            embedded
            open
            mode="coding"
            documentId={props.documentId}
            workingMarkdown={currentMd}
            baseMarkdown={baseMd}
            onMarkdownSet={setProposedMd}
            onSendingChange={setChatSending}
            onSessionId={setSessionId}
            onClose={props.onClose}
          />
        </section>
        <AiWriteMarkdownPane
          currentMd={currentMd}
          proposedMd={proposedMd}
          sending={chatSending}
          onCurrentChange={setCurrentMd}
          onProposedChange={setProposedMd}
        />
      </div>
      {confirmAsk ? (
        <ConfirmDialog
          message={confirmAsk.message}
          confirmLabel={confirmAsk.confirmLabel}
          cancelLabel={confirmAsk.cancelLabel}
          danger={confirmAsk.danger}
          onConfirm={() => settleConfirm(true)}
          onCancel={() => settleConfirm(false)}
        />
      ) : null}
    </div>
  );
}
