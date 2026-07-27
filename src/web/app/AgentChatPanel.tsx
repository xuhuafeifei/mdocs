import { History, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import deepseekLogoUrl from "../assets/deepseek.svg";
import {
  fetchAgentStatusApi,
  streamAgentChatApi,
  type AgentSourceRef,
  type AgentStatus,
} from "../services/endpoints";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AgentSourceRef[];
};

const SUGGESTIONS = ["如何发布文档？", "草稿是什么？", "如何创建域？"];

/**
 * 上手助手浮层：入口旁弹出；接 /api/agent/chat SSE。
 * 新会话 / 历史仍为假 UI。
 */
export function AgentChatPanel(props: {
  open: boolean;
  onClose: () => void;
  visitorName?: string;
}) {
  const { open, onClose, visitorName } = props;
  const userInitial = (visitorName?.trim().charAt(0) || "我").toUpperCase();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);

  function nextId(prefix: string) {
    idRef.current += 1;
    return `${prefix}-${idRef.current}`;
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
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    if (!status?.enabled) {
      setStreamError(status?.reason === "missing_api_key"
        ? "请先在设置 → AI 配置 DeepSeek API Key"
        : status?.reason === "skills_missing"
          ? "手册 skills 未就绪，请确认已构建 agent-skills"
          : "助手暂不可用");
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const userMsg: ChatMessage = { id: nextId("u"), role: "user", content: text };
    const assistantId = nextId("a");
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setSending(true);
    setStreamError(null);
    setHistoryOpen(false);

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
          } else if (event.type === "sources") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, sources: event.items } : m,
              ),
            );
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

  function onNewSession() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setStreamError(null);
    setHistoryOpen(false);
    setSending(false);
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
    <div ref={panelRef} className="mdocs-agent-panel" role="dialog" aria-label="mdocs 上手助手">
      <header className="mdocs-agent-panel-header">
        <div className="mdocs-agent-panel-title">
          <img src={deepseekLogoUrl} alt="" className="mdocs-agent-panel-title-logo" />
          <span>mdocs 上手助手</span>
        </div>
        <div className="mdocs-agent-panel-actions">
          <button
            type="button"
            className="mdocs-agent-panel-icon-btn"
            title="新会话"
            aria-label="新会话"
            onClick={onNewSession}
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
          <p className="mdocs-agent-panel-history-empty">暂无历史会话</p>
          <p className="mdocs-agent-panel-history-hint">多会话能力后续开放</p>
        </div>
      ) : (
        <div className="mdocs-agent-panel-body">
          <div className="mdocs-agent-panel-welcome" ref={listRef}>
            {messages.length === 0 ? (
              <>
                <p className="mdocs-agent-panel-hello">你好，我是 mdocs 上手助手</p>
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
                      (m.role === "user" ? " mdocs-agent-panel-msg-user" : " mdocs-agent-panel-msg-assistant")
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
                          <summary>
                            已阅读 {m.sources.length} 个页面
                          </summary>
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
                      {m.role === "assistant" ? (
                        m.content ? (
                          <div className="mdocs-agent-panel-md">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                          </div>
                        ) : sending ? (
                          "…"
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
