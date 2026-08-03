import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { History, Plus } from "lucide-react";
import deepseekLogoUrl from "../../assets/deepseek.svg";
import {
  bindCodingSessionDocumentApi,
  createAgentSessionApi,
  fetchAgentSessionApi,
  fetchAgentSessionsApi,
  fetchAgentStatusApi,
  openAgentSessionApi,
  streamAgentChatApi,
  type AgentSessionSummary,
  type AgentStatus,
} from "../../services/endpoints";
import { AiWriteMarkdownPane } from "./AiWriteMarkdownPane";
import { computeLineHunks } from "./markdown-hunks";

/** 助手时间线：正文 + 工具用途说明（不展示英文 tool name） */
type AssistantBlock =
  | { type: "text"; text: string }
  | { type: "tool"; text: string };

type ChatLine =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; blocks: AssistantBlock[] };

let seq = 0;
function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

function appendTextDelta(blocks: AssistantBlock[], text: string): AssistantBlock[] {
  const next = blocks.slice();
  const last = next[next.length - 1];
  if (last?.type === "text") {
    next[next.length - 1] = { type: "text", text: last.text + text };
  } else {
    next.push({ type: "text", text });
  }
  return next;
}

function appendTool(blocks: AssistantBlock[], text: string): AssistantBlock[] {
  const trimmed = text.trim();
  if (!trimmed) return blocks;
  return [...blocks, { type: "tool", text: trimmed }];
}

function hasVisibleAssistant(blocks: AssistantBlock[]): boolean {
  return blocks.some((b) => (b.type === "text" ? b.text.length > 0 : true));
}

function formatSessionTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" });
}

/** 历史只恢复文本；tool UI 块不落盘 */
function toChatLines(
  sessionId: string,
  messages: { role: "user" | "assistant"; content: string }[],
): ChatLine[] {
  return messages.map((m, i) => {
    const id = `h-${sessionId}-${i}-${m.role}`;
    if (m.role === "user") return { id, role: "user", content: m.content };
    return {
      id,
      role: "assistant",
      blocks: m.content ? [{ type: "text", text: m.content }] : [],
    };
  });
}

/**
 * 帮写全屏层：左 coding chat（含 session），右 MD + hunk 审阅。
 * Session 与 normal 隔离；历史只回放对话，不恢复右侧稿。
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
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyComplete, setBusyComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function refreshSessions() {
    setSessionsLoading(true);
    try {
      const list = await fetchAgentSessionsApi("coding", props.documentId);
      setSessions(list.sessions);
      if (!sessionId) setSessionId(list.lastOpenedSessionId);
    } catch {
      /* ignore */
    } finally {
      setSessionsLoading(false);
    }
  }

  useEffect(() => {
    if (!props.open) {
      setHistoryOpen(false);
      abortRef.current?.abort();
      return;
    }
    setCurrentMd(props.initialMarkdown);
    setProposedMd(null);
    setTitle(props.displayName || "未命名");
    setInput("");
    setError(null);
    setHistoryOpen(false);
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchAgentStatusApi();
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) setStatus({ enabled: false, skillsReady: false, model: null });
      }
      try {
        const sess = await fetchAgentSessionApi("coding", props.documentId);
        if (cancelled) return;
        setSessionId(sess.sessionId);
        setMessages(toChatLines(sess.sessionId, sess.messages));
      } catch {
        if (!cancelled) {
          setSessionId(null);
          setMessages([]);
        }
      }
      void refreshSessions();
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.initialMarkdown, props.displayName, props.documentId]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (props.open && historyOpen) void refreshSessions();
  }, [historyOpen, props.open, props.documentId]);

  if (!props.open) return null;

  const pendingHunks =
    proposedMd != null && proposedMd !== currentMd
      ? computeLineHunks(currentMd, proposedMd)
      : [];

  async function onNewSession() {
    if (sending) return;
    abortRef.current?.abort();
    setError(null);
    setHistoryOpen(false);
    setSending(false);
    try {
      const created = await createAgentSessionApi("coding", props.documentId);
      setSessionId(created.sessionId);
      setMessages([]);
      setInput("");
      void refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onOpenSession(id: string) {
    if (sending) return;
    if (id === sessionId) {
      setHistoryOpen(false);
      return;
    }
    abortRef.current?.abort();
    setError(null);
    try {
      const opened = await openAgentSessionApi(id, "coding", props.documentId);
      setSessionId(opened.sessionId);
      setMessages(toChatLines(opened.sessionId, opened.messages));
      setInput("");
      setHistoryOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

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
      { id: asstId, role: "assistant", blocks: [] },
    ]);
    setInput("");
    setSending(true);
    setError(null);

    const patchAssistant = (fn: (blocks: AssistantBlock[]) => AssistantBlock[]) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId && m.role === "assistant" ? { ...m, blocks: fn(m.blocks) } : m,
        ),
      );
    };

    try {
      await streamAgentChatApi(text, {
        mode: "coding",
        documentId: props.documentId,
        workingMarkdown: currentMd,
        baseMarkdown: baseMd,
        signal: ac.signal,
        onEvent: (event) => {
          if (event.type === "text_delta") {
            patchAssistant((blocks) => appendTextDelta(blocks, event.text));
          } else if (event.type === "markdown_set") {
            setProposedMd(event.markdown);
          } else if (event.type === "tool_notice") {
            patchAssistant((blocks) => appendTool(blocks, event.text));
          } else if (event.type === "document_table") {
            patchAssistant((blocks) => appendTool(blocks, event.title));
          } else if (event.type === "document_card") {
            patchAssistant((blocks) =>
              appendTool(blocks, `读取文档「${event.title}」`),
            );
          } else if (event.type === "sources") {
            if (event.items.length > 0) {
              patchAssistant((blocks) =>
                appendTool(blocks, `已阅读 ${event.items.length} 个手册页面`),
              );
            }
          } else if (event.type === "error") {
            setError(event.message);
          }
        },
      });
      void refreshSessions();
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
          <div className="mdocs-ai-write-chat-toolbar">
            <span className="mdocs-ai-write-chat-toolbar-label">对话</span>
            <div className="mdocs-ai-write-chat-toolbar-actions">
              <button
                type="button"
                className="mdocs-agent-panel-icon-btn"
                title="新会话"
                aria-label="新会话"
                disabled={sending}
                onClick={() => void onNewSession()}
              >
                <Plus size={16} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className={
                  "mdocs-agent-panel-icon-btn" + (historyOpen ? " active" : "")
                }
                title="历史会话"
                aria-label="历史会话"
                onClick={() => setHistoryOpen((v) => !v)}
              >
                <History size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {historyOpen ? (
            <div className="mdocs-ai-write-history mdocs-agent-panel-history">
              <div className="mdocs-agent-panel-history-head">
                <span>历史会话</span>
                <button
                  type="button"
                  className="mdocs-agent-panel-history-back"
                  onClick={() => setHistoryOpen(false)}
                >
                  返回对话
                </button>
              </div>
              {sessionsLoading ? (
                <p className="mdocs-agent-panel-history-hint">加载中…</p>
              ) : sessions.length === 0 ? (
                <>
                  <p className="mdocs-agent-panel-history-empty">暂无历史会话</p>
                  <p className="mdocs-agent-panel-history-hint">发一条消息后会出现在这里</p>
                </>
              ) : (
                <ul className="mdocs-agent-panel-history-list">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={
                          "mdocs-agent-panel-history-item" +
                          (s.id === sessionId ? " active" : "")
                        }
                        disabled={sending}
                        onClick={() => void onOpenSession(s.id)}
                      >
                        <span className="mdocs-agent-panel-history-title">{s.title}</span>
                        <span className="mdocs-agent-panel-history-time">
                          {formatSessionTime(s.updatedAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
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
                      {m.role === "user" ? (
                        m.content
                      ) : hasVisibleAssistant(m.blocks) ? (
                        <div className="mdocs-ai-write-timeline">
                          {m.blocks.map((block, bi) =>
                            block.type === "tool" ? (
                              <p
                                key={`${m.id}-tool-${bi}`}
                                className="mdocs-agent-panel-tool-notice"
                              >
                                {block.text}
                              </p>
                            ) : block.text ? (
                              <div
                                key={`${m.id}-text-${bi}`}
                                className="mdocs-agent-panel-md"
                              >
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {block.text}
                                </ReactMarkdown>
                              </div>
                            ) : null,
                          )}
                        </div>
                      ) : sending ? (
                        <span className="mdocs-agent-panel-thinking" aria-label="思考中">
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : null}
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
                <button
                  type="button"
                  disabled={sending || !status?.enabled}
                  onClick={() => void send()}
                >
                  发送
                </button>
              </div>
            </>
          )}
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
