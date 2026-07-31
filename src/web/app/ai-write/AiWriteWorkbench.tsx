import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  fetchAgentStatusApi,
  streamAgentChatApi,
  type AgentStatus,
} from "../../services/endpoints";
import { AiWriteMarkdownPane } from "./AiWriteMarkdownPane";
import { computeLineHunks } from "./markdown-hunks";

type ChatLine = { id: string; role: "user" | "assistant"; content: string };

let seq = 0;
function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

/**
 * 帮写全屏层：左 coding chat，右 MD + hunk 审阅。
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
  }) => void | Promise<void>;
}) {
  const [currentMd, setCurrentMd] = useState(props.initialMarkdown);
  const [proposedMd, setProposedMd] = useState<string | null>(null);
  const [baseMd] = useState(props.initialMarkdown);
  const [title, setTitle] = useState(props.displayName || "未命名");
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyComplete, setBusyComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setCurrentMd(props.initialMarkdown);
    setProposedMd(null);
    setTitle(props.displayName || "未命名");
    setMessages([]);
    setInput("");
    setError(null);
    void fetchAgentStatusApi()
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, skillsReady: false, model: null }));
  }, [props.open, props.initialMarkdown, props.displayName]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!props.open) return null;

  const pendingHunks =
    proposedMd != null && proposedMd !== currentMd
      ? computeLineHunks(currentMd, proposedMd)
      : [];

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    if (!status?.enabled) {
      setError("请先在设置 → AI 配置 API Key");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const userId = nextId("u");
    const asstId = nextId("a");
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: text },
      { id: asstId, role: "assistant", content: "" },
    ]);
    setInput("");
    setSending(true);
    setError(null);
    try {
      await streamAgentChatApi(text, {
        mode: "coding",
        documentId: props.documentId,
        workingMarkdown: currentMd,
        baseMarkdown: baseMd,
        signal: ac.signal,
        onEvent: (event) => {
          if (event.type === "text_delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId ? { ...m, content: m.content + event.text } : m,
              ),
            );
          } else if (event.type === "markdown_set") {
            setProposedMd(event.markdown);
          } else if (event.type === "error") {
            setError(event.message);
          }
        },
      });
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setSending(false);
    }
  }

  async function finish() {
    let md = currentMd;
    if (pendingHunks.length > 0) {
      const ok = window.confirm(
        `还有 ${pendingHunks.length} 段未审阅，将全部接受后写回。继续？`,
      );
      if (!ok) return;
      md = proposedMd ?? currentMd;
      setCurrentMd(md);
      setProposedMd(null);
    }
    setBusyComplete(true);
    try {
      await props.onComplete({
        markdown: md,
        documentId: props.documentId,
        displayName: title.trim() || "未命名",
      });
      props.onClose();
    } catch (err) {
      if ((err as { silent?: boolean } | null)?.silent) return;
      if (err instanceof Error && err.message === "cancelled") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyComplete(false);
    }
  }

  function onCancel() {
    if (currentMd !== baseMd || proposedMd != null) {
      const ok = window.confirm("取消帮写？未写回的修改将丢失。");
      if (!ok) return;
    }
    abortRef.current?.abort();
    props.onClose();
  }

  return (
    <div className="mdocs-ai-write-overlay" role="dialog" aria-modal="true" aria-label="帮写">
      <header className="mdocs-ai-write-header">
        <div className="mdocs-ai-write-header-left">
          <strong>帮写</strong>
          <input
            className="mdocs-ai-write-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="文档标题"
          />
        </div>
        <div className="mdocs-ai-write-header-actions">
          <button type="button" onClick={onCancel} disabled={busyComplete}>
            取消
          </button>
          <button
            type="button"
            className="mdocs-ai-write-primary"
            onClick={() => void finish()}
            disabled={busyComplete}
          >
            {busyComplete ? "写回中…" : "完成并写回"}
          </button>
        </div>
      </header>
      <div className="mdocs-ai-write-body">
        <section className="mdocs-ai-write-chat">
          <div className="mdocs-ai-write-chat-messages">
            {messages.length === 0 ? (
              <p className="mdocs-ai-write-hint">
                描述你想写或改的内容。助手可读取右侧当前稿与进场快照，再更新提案；请按段接受或拒绝后完成写回。
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    "mdocs-ai-write-msg" +
                    (m.role === "user" ? " mdocs-ai-write-msg-user" : "")
                  }
                >
                  {m.role === "assistant" ? (
                    m.content ? (
                      <div className="mdocs-agent-panel-md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    ) : sending ? (
                      <span className="mdocs-agent-panel-thinking" aria-label="思考中">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : null
                  ) : (
                    m.content
                  )}
                </div>
              ))
            )}
          </div>
          {error ? <p className="mdocs-ai-write-error">{error}</p> : null}
          <div className="mdocs-ai-write-input-row">
            <textarea
              rows={2}
              value={input}
              disabled={sending || !status?.enabled}
              placeholder={status?.enabled ? "说说要写什么…" : "请先配置 API Key"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button type="button" disabled={sending || !status?.enabled} onClick={() => void send()}>
              发送
            </button>
          </div>
        </section>
        <AiWriteMarkdownPane
          currentMd={currentMd}
          proposedMd={proposedMd}
          onCurrentChange={setCurrentMd}
          onProposedChange={setProposedMd}
        />
      </div>
    </div>
  );
}
