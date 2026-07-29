import { History, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import deepseekLogoUrl from "../assets/deepseek.svg";
import {
  type AgentDocumentTableRow,
  createAgentSessionApi,
  fetchAgentContextUsageApi,
  fetchAgentSessionApi,
  fetchAgentSessionsApi,
  fetchAgentStatusApi,
  openAgentSessionApi,
  streamAgentChatApi,
  type AgentContextUsage,
  type AgentSessionSummary,
  type AgentSourceRef,
  type AgentStatus,
} from "../services/endpoints";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AgentSourceRef[];
  documentTable?: {
    title: string;
    rows: AgentDocumentTableRow[];
  };
};

const SUGGESTIONS = ["如何发布文档？", "草稿是什么？", "如何创建域？"];

function toChatMessages(sessionId: string, messages: { role: "user" | "assistant"; content: string }[]): ChatMessage[] {
  return messages.map((m, i) => ({
    id: `h-${sessionId}-${i}-${m.role}`,
    role: m.role,
    content: m.content,
  }));
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

function formatTokenCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}K`;
  }
  return String(n);
}

function ContextUsageRing(props: { percent: number; used: number; limit: number }) {
  const size = 20;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, props.percent));
  const offset = c * (1 - pct / 100);
  const level = pct >= 90 ? "danger" : pct >= 70 ? "warn" : "ok";
  const tip = `上下文 ${pct}% · 已用 ${formatTokenCount(props.used)} / ${formatTokenCount(props.limit)} tokens`;
  return (
    <span
      className={"mdocs-agent-panel-context mdocs-agent-panel-context-" + level}
      data-tooltip={tip}
      aria-label={tip}
      role="img"
      tabIndex={0}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="mdocs-agent-panel-context-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="mdocs-agent-panel-context-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </span>
  );
}

/**
 * mdocs 智能助手 浮层：入口旁弹出；接 /api/agent/chat SSE。
 * 「+」新建 session；历史图标列出并切换 lastOpened。
 */
export function AgentChatPanel(props: {
  open: boolean;
  onClose: () => void;
  visitorName?: string;
  /** 跟随 FAB 的定位（left / bottom） */
  anchorStyle?: React.CSSProperties;
  onOpenDocument?: (documentId: string) => void | Promise<void>;
  /** Agent 建文/建文件夹/移动等改树后回调，用于刷新侧栏 */
  onTreeChanged?: () => void | Promise<void>;
}) {
  const { open, onClose, visitorName, anchorStyle, onOpenDocument, onTreeChanged } = props;
  const userInitial = (visitorName?.trim().charAt(0) || "我").toUpperCase();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [contextUsage, setContextUsage] = useState<AgentContextUsage | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  /** 用户是否贴在底部；上滑阅读时为 false，不再强制滚 */
  const stickToBottomRef = useRef(true);

  function nextId(prefix: string) {
    idRef.current += 1;
    return `${prefix}-${idRef.current}`;
  }

  function isNearBottom(el: HTMLElement, threshold = 48): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }

  function scrollToBottomIfStuck() {
    const el = listRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }

  function onListScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottomRef.current = isNearBottom(el);
  }

  async function refreshSessions() {
    setSessionsLoading(true);
    try {
      const list = await fetchAgentSessionsApi();
      setSessions(list.sessions);
      if (!sessionId) setSessionId(list.lastOpenedSessionId);
    } catch {
      /* ignore */
    } finally {
      setSessionsLoading(false);
    }
  }

  async function refreshContextUsage() {
    try {
      const usage = await fetchAgentContextUsageApi();
      setContextUsage(usage);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!open) {
      setHistoryOpen(false);
      abortRef.current?.abort();
      abortRef.current = null;
      setSending(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchAgentStatusApi();
        if (!cancelled) {
          setStatus(s);
          setStatusError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(null);
          setStatusError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    void refreshContextUsage();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchAgentSessionApi();
        if (cancelled) return;
        setSessionId(s.sessionId);
        setMessages((prev) => {
          // 避免用户刚发送消息时，异步回放覆盖 UI
          if (prev.length > 0) return prev;
          return toChatMessages(s.sessionId, s.messages);
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !historyOpen) return;
    void refreshSessions();
  }, [open, historyOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (historyOpen) {
          setHistoryOpen(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, historyOpen]);

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    if (!status?.enabled) {
      setStreamError(
        status?.reason === "missing_api_key"
          ? "请先在设置 → AI 配置 DeepSeek API Key"
          : status?.reason === "skills_missing"
            ? "手册 skills 未就绪，请确认已构建 agent-skills"
            : "助手暂不可用",
      );
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const userMsg: ChatMessage = { id: nextId("u"), role: "user", content: text };
    const assistantId = nextId("a");
    stickToBottomRef.current = true;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setSending(true);
    setStreamError(null);
    setHistoryOpen(false);
    requestAnimationFrame(() => scrollToBottomIfStuck());

    try {
      await streamAgentChatApi(text, {
        signal: ac.signal,
        onEvent: (event) => {
          if (event.type === "text_delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.text } : m,
              ),
            );
            requestAnimationFrame(() => scrollToBottomIfStuck());
          } else if (event.type === "sources") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, sources: event.items } : m,
              ),
            );
          } else if (event.type === "document_table") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      documentTable: {
                        title: event.title,
                        rows: event.rows,
                      },
                    }
                  : m,
              ),
            );
          } else if (event.type === "tree_changed") {
            void onTreeChanged?.();
          } else if (event.type === "context_usage") {
            setContextUsage({
              percent: event.percent,
              used: event.used,
              limit: event.limit,
            });
          } else if (event.type === "error") {
            setStreamError(event.message);
          }
        },
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      setStreamError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setSending(false);
    }
  }

  async function onNewSession() {
    if (sending) return;
    abortRef.current?.abort();
    setStreamError(null);
    setHistoryOpen(false);
    setSending(false);
    try {
      const created = await createAgentSessionApi();
      setSessionId(created.sessionId);
      setMessages([]);
      setInput("");
      stickToBottomRef.current = true;
      void refreshContextUsage();
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onOpenSession(id: string) {
    if (sending) return;
    if (id === sessionId) {
      setHistoryOpen(false);
      return;
    }
    abortRef.current?.abort();
    setStreamError(null);
    try {
      const opened = await openAgentSessionApi(id);
      setSessionId(opened.sessionId);
      setMessages(toChatMessages(opened.sessionId, opened.messages));
      setInput("");
      setHistoryOpen(false);
      stickToBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottomIfStuck());
      void refreshContextUsage();
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }

  function openDocumentFromTable(documentId: string) {
    if (!documentId || !onOpenDocument) return;
    void onOpenDocument(documentId);
  }

  if (!open) return null;

  const unavailableHint =
    statusError ??
    (status && !status.enabled
      ? status.reason === "missing_api_key"
        ? "未配置 API Key：请打开设置 → AI"
        : status.reason === "skills_missing"
          ? "skills 未就绪"
          : "助手暂不可用"
      : null);

  return (
    <div
      ref={panelRef}
      className="mdocs-agent-panel"
      role="dialog"
      aria-label="mdocs 智能助手"
      style={anchorStyle}
    >
      <header className="mdocs-agent-panel-header">
        <div className="mdocs-agent-panel-title">
          <img src={deepseekLogoUrl} alt="" className="mdocs-agent-panel-title-logo" />
          <span>mdocs 智能助手</span>
        </div>
        <div className="mdocs-agent-panel-actions">
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
            className={"mdocs-agent-panel-icon-btn" + (historyOpen ? " active" : "")}
            title="历史会话"
            aria-label="历史会话"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <History size={16} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="mdocs-agent-panel-icon-btn"
            title="关闭"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {historyOpen ? (
        <div className="mdocs-agent-panel-history">
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
        <div className="mdocs-agent-panel-body">
          <div
            className="mdocs-agent-panel-welcome"
            ref={listRef}
            onScroll={onListScroll}
          >
            {messages.length === 0 ? (
              <>
                <p className="mdocs-agent-panel-hello">你好，我是 mdocs 智能助手</p>
                <p className="mdocs-agent-panel-desc">
                  可以问我域、草稿、发布、权限等怎么用。本期不协助写作。
                </p>
                {unavailableHint ? (
                  <p className="mdocs-agent-panel-status-warn">{unavailableHint}</p>
                ) : (
                  <div className="mdocs-agent-panel-chips">
                    {SUGGESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="mdocs-agent-panel-chip"
                        onClick={() => void sendMessage(q)}
                        disabled={sending || !status?.enabled}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mdocs-agent-panel-messages">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      "mdocs-agent-panel-msg" +
                      (m.role === "user"
                        ? " mdocs-agent-panel-msg-user"
                        : " mdocs-agent-panel-msg-assistant")
                    }
                  >
                    {m.role === "assistant" ? (
                      <div className="mdocs-agent-panel-avatar mdocs-agent-panel-avatar-ai" aria-hidden>
                        <img src={deepseekLogoUrl} alt="" />
                      </div>
                    ) : null}
                    <div className="mdocs-agent-panel-msg-bubble">
                      {m.role === "assistant" && m.sources && m.sources.length > 0 ? (
                        <details className="mdocs-agent-panel-sources" open>
                          <summary>已阅读 {m.sources.length} 个页面</summary>
                          <ol>
                            {m.sources.map((s) => (
                              <li key={s.id}>
                                <a href={s.url} target="_blank" rel="noreferrer">
                                  {s.name}
                                </a>
                              </li>
                            ))}
                          </ol>
                        </details>
                      ) : null}
                      {m.role === "assistant" && m.documentTable && m.documentTable.rows.length > 0 ? (
                        <div className="mdocs-agent-panel-doc-table-wrap">
                          <p className="mdocs-agent-panel-doc-table-title">{m.documentTable.title}</p>
                          <table className="mdocs-agent-panel-doc-table">
                            <thead>
                              <tr>
                                <th>文章名字</th>
                                <th>文章内容</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.documentTable.rows.map((row) => (
                                <tr key={row.documentId}>
                                  <td>
                                    <button
                                      type="button"
                                      className="mdocs-agent-panel-doc-link"
                                      onClick={() => openDocumentFromTable(row.documentId)}
                                    >
                                      {row.title}
                                    </button>
                                  </td>
                                  <td>{row.summary || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
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
                    {m.role === "user" ? (
                      <div className="mdocs-agent-panel-avatar mdocs-agent-panel-avatar-user" aria-hidden>
                        {userInitial}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          {streamError ? (
            <p className="mdocs-agent-panel-status-warn">{streamError}</p>
          ) : null}
          <div className="mdocs-agent-panel-input-wrap">
            <textarea
              className="mdocs-agent-panel-input"
              rows={2}
              placeholder={status?.enabled ? "把你的问题告诉我…" : "请先配置 API Key"}
              value={input}
              disabled={sending || !status?.enabled}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
            />
            {contextUsage ? (
              <ContextUsageRing
                percent={contextUsage.percent}
                used={contextUsage.used}
                limit={contextUsage.limit}
              />
            ) : null}
            <button
              type="button"
              className="mdocs-agent-panel-send"
              disabled={sending || !status?.enabled || !input.trim()}
              onClick={() => void sendMessage(input)}
              title="发送"
            >
              ↑
            </button>
          </div>
          <p className="mdocs-agent-panel-footnote">内容由 AI 生成，仅供参考</p>
        </div>
      )}
    </div>
  );
}
