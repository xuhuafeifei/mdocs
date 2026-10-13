import { ArrowDown, Check, ChevronDown, ChevronRight, Copy, FileText, History, Maximize2, Minimize2, Network, Pencil, Pin, Plus, X } from "lucide-react";
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  pinAgentSessionApi,
  renameAgentSessionApi,
  streamAgentChatApi,
  submitAgentChoiceApi,
  expireAgentChoiceApi,
  cancelAgentChoiceApi,
  cancelAgentSkillFormApi,
  type AgentContextUsage,
  type AgentSessionSummary,
  type AgentSourceRef,
  type AgentStatus,
} from "../services/endpoints";
import { AgentSkillRefPicker } from "./AgentSkillRefPicker";
import { AgentApiKeyInlineSetup } from "./AgentApiKeyInlineSetup";
import {
  SkillFormCardBlock,
  type SkillFormCardState,
} from "./AgentSkillFormCard";
import { AgentMermaidBlock, extractMermaidFromPre } from "./AgentMermaidBlock";
import { AgentThinkingFold, sealThinking, useThinkClock } from "./AgentThinkingFold";
import { copyTextToClipboard } from "./copyText";
import type { DomainSummary } from "../../shared/types/domain";
import { DEFAULT_DOMAIN_ID } from "../../shared/domainUi";

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    return nodeText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function MarkdownPreWithCopy(props: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const textFromTree = nodeText(props.children).replace(/\n$/, "");

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function onCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const fromDom = wrapRef.current?.querySelector("pre")?.innerText?.replace(/\n$/, "") ?? "";
    const text = fromDom || textFromTree;
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mdocs-agent-panel-md-pre-wrap" ref={wrapRef}>
      <button
        type="button"
        className="mdocs-agent-panel-md-copy"
        onClick={(ev) => void onCopy(ev)}
        aria-label={copied ? "已复制" : "复制代码"}
        title={copied ? "已复制" : "复制"}
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
      <pre>{props.children}</pre>
    </div>
  );
}

function MarkdownPre(props: { children?: ReactNode }) {
  const mermaidSource = extractMermaidFromPre(props.children);
  if (mermaidSource != null) {
    return <AgentMermaidBlock source={mermaidSource} codeChildren={props.children} />;
  }
  return <MarkdownPreWithCopy>{props.children}</MarkdownPreWithCopy>;
}

/** 模块级稳定引用：避免输入框改 state 时 components 换新导致 Mermaid 卸载重挂 */
const agentMarkdownComponents = {
  pre: ({ children }: { children?: ReactNode }) => <MarkdownPre>{children}</MarkdownPre>,
};

const AgentMarkdown = memo(function AgentMarkdown(props: { children: string }) {
  return (
    <div className="mdocs-agent-panel-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={agentMarkdownComponents}>
        {props.children}
      </ReactMarkdown>
    </div>
  );
});

/** 当轮流式时间线；不落盘，历史重开无 blocks 则只显示 content */
type AssistantBlock =
  | { type: "thinking"; text: string; startedAt?: number; endedAt?: number }
  | { type: "text"; text: string }
  | { type: "document_table"; title: string; rows: AgentDocumentTableRow[] }
  | {
      type: "document_card";
      documentId: string;
      title: string;
      path: string;
      preview: string;
    }
  | { type: "tool_notice"; toolName: string; text: string }
  | {
      type: "tool_call";
      toolCallId: string;
      toolName: string;
      label: string;
      status: "running" | "done" | "error";
      detail?: string;
    }
  | {
      type: "choice_card";
      requestId: string;
      title: string;
      options: string[];
      expiresAt: string;
      status: "open" | "selected" | "cancelled" | "expired" | "failed";
      selected?: string;
    }
  | SkillFormCardState
  | { type: "sources"; items: AgentSourceRef[] };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  skillNames?: string[];
  /** 仅当轮 SSE；历史会话不恢复 */
  blocks?: AssistantBlock[];
};

const ASK_SUGGESTIONS = ["如何发布文档？", "草稿是什么？", "如何创建工作空间？"];

/** 帮写空态引导：偏改稿/写作，和 Ask 上手答疑区分开 */
const CODING_SUGGESTIONS = ["润色当前文稿", "补写开头引言", "把这段改得更简洁"];

function toChatMessages(
  sessionId: string,
  messages: {
    role: "user" | "assistant";
    content: string;
    skillNames?: string[];
    skillIds?: string[];
  }[],
): ChatMessage[] {
  return messages.map((m, i) => {
    const skillNames =
      m.skillNames && m.skillNames.length > 0
        ? m.skillNames
        : m.skillIds && m.skillIds.length > 0
          ? m.skillIds
          : undefined;
    return {
      id: `h-${sessionId}-${i}-${m.role}`,
      role: m.role,
      content: m.content,
      skillNames,
    };
  });
}

function appendTextDelta(blocks: AssistantBlock[], text: string): AssistantBlock[] {
  const next = sealThinking(blocks).slice();
  const last = next[next.length - 1];
  if (last?.type === "text") {
    next[next.length - 1] = { type: "text", text: last.text + text };
  } else {
    next.push({ type: "text", text });
  }
  return next;
}

function appendThinkingDelta(blocks: AssistantBlock[], text: string): AssistantBlock[] {
  const now = Date.now();
  const next = blocks.slice();
  const last = next[next.length - 1];
  if (last?.type === "thinking" && !last.endedAt) {
    next[next.length - 1] = {
      type: "thinking",
      text: last.text + text,
      startedAt: last.startedAt ?? now,
    };
  } else {
    next.push({ type: "thinking", text, startedAt: now });
  }
  return next;
}

function upsertToolCallBlock(
  blocks: AssistantBlock[],
  call: Extract<AssistantBlock, { type: "tool_call" }>,
): AssistantBlock[] {
  const next = sealThinking(blocks).slice();
  const idx = next.findIndex(
    (b) => b.type === "tool_call" && b.toolCallId === call.toolCallId,
  );
  if (idx >= 0) {
    const prev = next[idx] as Extract<AssistantBlock, { type: "tool_call" }>;
    next[idx] = {
      ...prev,
      ...call,
      detail: call.detail ?? prev.detail,
    };
  } else {
    next.push(call);
  }
  return next;
}

function textFromBlocks(blocks: AssistantBlock[] | undefined): string {
  if (!blocks?.length) return "";
  return blocks
    .filter((b): b is Extract<AssistantBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function hasThinkingText(blocks: AssistantBlock[] | undefined): boolean {
  return Boolean(blocks?.some((b) => b.type === "thinking" && b.text.length > 0));
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

function ChoiceCardBlock(props: {
  block: Extract<AssistantBlock, { type: "choice_card" }>;
  onResolved: (
    requestId: string,
    choice: string,
    status: "selected" | "cancelled" | "expired" | "failed",
  ) => void;
}) {
  const { block, onResolved } = props;
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [remainRatio, setRemainRatio] = useState(1);
  const expiredOnceRef = useRef(false);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;
  const open = block.status === "open";
  const totalMs = useRef(0);

  useEffect(() => {
    if (!open) return;
    expiredOnceRef.current = false;
    const end = new Date(block.expiresAt).getTime();
    const start = Date.now();
    const total = Math.max(end - start, 1);
    totalMs.current = total;
    setRemainRatio(1);

    const tick = () => {
      const left = end - Date.now();
      const ratio = Math.max(0, Math.min(1, left / total));
      setRemainRatio(ratio);
      if (left <= 0 && !expiredOnceRef.current) {
        expiredOnceRef.current = true;
        void expireAgentChoiceApi(block.requestId)
          .catch(() => undefined)
          .finally(() => {
            onResolvedRef.current(block.requestId, "", "expired");
          });
      }
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [open, block.expiresAt, block.requestId]);

  async function submit(choice: string) {
    const text = choice.trim();
    if (!text || busy || !open) return;
    setBusy(true);
    try {
      await submitAgentChoiceApi(block.requestId, text);
      onResolved(block.requestId, text, "selected");
    } catch {
      onResolved(block.requestId, text, "failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (busy || !open) return;
    setBusy(true);
    expiredOnceRef.current = true;
    try {
      await cancelAgentChoiceApi(block.requestId);
      onResolved(block.requestId, "", "cancelled");
    } catch {
      onResolved(block.requestId, "", "failed");
    } finally {
      setBusy(false);
    }
  }

  const remainSec = Math.max(0, Math.ceil((remainRatio * totalMs.current) / 1000));

  return (
    <div
      className={
        "mdocs-agent-choice-card" + (open ? "" : " mdocs-agent-choice-card-done")
      }
    >
      <div className="mdocs-agent-choice-head">
        <p className="mdocs-agent-choice-title">{block.title}</p>
        {open ? (
          <span className="mdocs-agent-choice-timer" aria-live="polite">
            {remainSec}s
          </span>
        ) : null}
      </div>
      {open ? (
        <div
          className="mdocs-agent-choice-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(remainRatio * 100)}
        >
          <div
            className="mdocs-agent-choice-progress-bar"
            style={{ transform: `scaleX(${remainRatio})` }}
          />
        </div>
      ) : null}
      {block.status === "selected" && block.selected ? (
        <p className="mdocs-agent-choice-result">已选择：{block.selected}</p>
      ) : null}
      {block.status === "cancelled" ? (
        <p className="mdocs-agent-choice-result muted">已取消</p>
      ) : null}
      {block.status === "expired" ? (
        <p className="mdocs-agent-choice-result muted">已超时，选择已失效</p>
      ) : null}
      {block.status === "failed" ? (
        <p className="mdocs-agent-choice-result muted">提交失败或已失效</p>
      ) : null}
      {open ? (
        <>
          <div className="mdocs-agent-choice-options">
            {block.options.map((opt) => (
              <button
                key={opt}
                type="button"
                className="mdocs-agent-choice-option"
                disabled={busy}
                onClick={() => void submit(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="mdocs-agent-choice-custom">
            <input
              value={custom}
              disabled={busy}
              placeholder="或输入自己的内容…"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit(custom);
                }
              }}
            />
            <button
              type="button"
              disabled={busy || !custom.trim()}
              onClick={() => void submit(custom)}
            >
              提交
            </button>
          </div>
          <div className="mdocs-agent-choice-footer">
            <button
              type="button"
              className="mdocs-agent-choice-cancel"
              disabled={busy}
              onClick={() => void cancel()}
            >
              取消
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
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
 * 关闭时若有倒计时卡（选择 / skill 表单），先确认是否强制退出。
 */
export type AgentChatPanelHandle = {
  requestClose: () => void;
};

function hasOpenCountdown(messages: ChatMessage[]): boolean {
  for (const m of messages) {
    if (m.role !== "assistant" || !m.blocks?.length) continue;
    for (const b of m.blocks) {
      if (
        (b.type === "choice_card" || b.type === "skill_form_card") &&
        b.status === "open"
      ) {
        return true;
      }
    }
  }
  return false;
}

export const AgentChatPanel = forwardRef<
  AgentChatPanelHandle,
  {
    open: boolean;
    onClose: () => void;
    visitorName?: string;
    /** 跟随 FAB 的定位（left / bottom）；全屏时忽略 */
    anchorStyle?: React.CSSProperties;
    /** 窄屏全屏铺满；PC 可手动切换 */
    fullscreen?: boolean;
    /** PC：切换全屏；窄屏不传则不显示按钮 */
    onToggleFullscreen?: () => void;
    /** 当前域 / 打开文，每轮 Ask 作为 references 发给后端 */
    domainId?: string | null;
    /** 工作空间列表（历史按域分组折叠用） */
    domains?: DomainSummary[];
    localizeDomainName?: (name: string) => string;
    documentId?: string | null;
    documentTitle?: string | null;
    documentPath?: string | null;
    /** 图谱焦点：引用图谱隐藏文件（与 documentId 互斥） */
    graphFileId?: string | null;
    graphLabel?: string | null;
    onOpenDocument?: (documentId: string) => void | Promise<void>;
    /** Agent 建文/建文件夹/移动等改树后回调，用于刷新侧栏 */
    onTreeChanged?: () => void | Promise<void>;
    /** AI 覆写文档成功回调，刷新当前打开文档的内容 */
    onDocumentOverwritten?: (payload: {
      documentId: string;
      headCommitId: string;
    }) => void | Promise<void>;
    /** 有正文时用户选「打开帮写」→ 打开帮写全屏层 */
    onOpenCoding?: (payload: {
      documentId: string;
      displayName: string;
    }) => void | Promise<void>;
    /** 嵌在帮写左栏：去掉浮层定位和关闭 */
    embedded?: boolean;
    mode?: "normal" | "coding";
    workingMarkdown?: string;
    baseMarkdown?: string;
    onMarkdownSet?: (markdown: string) => void;
    onSendingChange?: (sending: boolean) => void;
    onSessionId?: (sessionId: string | null) => void;
  }
>(function AgentChatPanel(props, ref) {
  const {
    open,
    onClose,
    visitorName,
    anchorStyle,
    fullscreen,
    onToggleFullscreen,
    domainId,
    domains = [],
    localizeDomainName,
    documentId,
    documentTitle,
    documentPath,
    graphFileId,
    graphLabel,
    onOpenDocument,
    onTreeChanged,
    onDocumentOverwritten,
    onOpenCoding,
    embedded = false,
    mode = "normal",
    workingMarkdown,
    baseMarkdown,
    onMarkdownSet,
    onSendingChange,
    onSessionId,
  } = props;
  const sessionMode = mode === "coding" ? "coding" : "normal";
  const coding = sessionMode === "coding";
  const userInitial = (visitorName?.trim().charAt(0) || "我").toUpperCase();
  const [historyOpen, setHistoryOpen] = useState(false);
  /** 历史列表：当前工作空间 / 全部 */
  const [historyScope, setHistoryScope] = useState<"current" | "all">("current");
  /** 折叠的工作空间 id；未出现在 map 时：全部模式下仅展开当前空间 */
  const [domainCollapsed, setDomainCollapsed] = useState<Record<string, boolean>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [selectedSkillNames, setSelectedSkillNames] = useState<string[]>([]);
  /** 用户点右侧取消后，本轮不再带 documentId；换一篇文自动恢复 */
  const [docRefDismissed, setDocRefDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [contextUsage, setContextUsage] = useState<AgentContextUsage | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [forceClosing, setForceClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  /** 用户是否贴在底部；上滑阅读时为 false，不再强制滚 */
  const stickToBottomRef = useRef(true);
  const [showJumpBottom, setShowJumpBottom] = useState(false);
  const thinkNow = useThinkClock(sending);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const docRefActive = Boolean(documentId?.trim()) && !docRefDismissed;
  const docRefTitle = documentTitle?.trim() || "当前文档";
  const docRefPath = documentPath?.trim() || "";
  /** 图谱引用：graphFileId 存在且未取消时激活（与 docRef 互斥） */
  const graphRefActive = Boolean(graphFileId?.trim()) && !docRefDismissed;
  const graphRefTitle = graphLabel?.trim() || "当前图谱";

  useEffect(() => {
    setDocRefDismissed(false);
  }, [documentId, graphFileId]);

  function nextId(prefix: string) {
    idRef.current += 1;
    return `${prefix}-${idRef.current}`;
  }

  /** 距底部超过该像素时显示「置底」 */
  const JUMP_BOTTOM_GAP = 120;

  function distanceFromBottom(el: HTMLElement): number {
    return el.scrollHeight - el.scrollTop - el.clientHeight;
  }

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setShowJumpBottom(false);
  }

  function scrollToBottomIfStuck() {
    if (!stickToBottomRef.current) return;
    scrollToBottom();
  }

  function onListScroll() {
    const el = listRef.current;
    if (!el) return;
    const gap = distanceFromBottom(el);
    stickToBottomRef.current = gap <= 48;
    setShowJumpBottom(gap > JUMP_BOTTOM_GAP);
  }

  function jumpToBottom() {
    stickToBottomRef.current = true;
    scrollToBottom();
  }

  /** 消息更新后立刻贴底（回车发送 / 流式增量） */
  useLayoutEffect(() => {
    scrollToBottomIfStuck();
    const el = listRef.current;
    if (!el) return;
    setShowJumpBottom(distanceFromBottom(el) > JUMP_BOTTOM_GAP);
  }, [messages]);

  async function refreshSessions() {
    setSessionsLoading(true);
    try {
      const list = await fetchAgentSessionsApi(
        sessionMode,
        coding ? documentId : undefined,
      );
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

  async function refreshAgentStatus() {
    try {
      const s = await fetchAgentStatusApi();
      setStatus(s);
      setStatusError(null);
    } catch (err) {
      setStatus(null);
      setStatusError(err instanceof Error ? err.message : String(err));
    }
  }

  const onSendingChangeRef = useRef(onSendingChange);
  onSendingChangeRef.current = onSendingChange;
  const onSessionIdRef = useRef(onSessionId);
  onSessionIdRef.current = onSessionId;

  useEffect(() => {
    onSendingChangeRef.current?.(sending);
  }, [sending]);

  useEffect(() => {
    onSessionIdRef.current?.(sessionId);
  }, [sessionId]);

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

  const sessionScope = coding ? `coding:${documentId ?? ""}` : "normal";
  const sessionScopeRef = useRef(sessionScope);

  useEffect(() => {
    if (!open) return;
    const scopeChanged = sessionScopeRef.current !== sessionScope;
    sessionScopeRef.current = sessionScope;
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchAgentSessionApi(
          sessionMode,
          coding ? documentId : undefined,
        );
        if (cancelled) return;
        setSessionId(s.sessionId);
        setMessages((prev) => {
          if (!scopeChanged && prev.length > 0) return prev;
          return toChatMessages(s.sessionId, s.messages);
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sessionScope]);

  useEffect(() => {
    if (!open || !historyOpen) return;
    void refreshSessions();
  }, [open, historyOpen]);

  function requestClose() {
    if (forceClosing) return;
    if (hasOpenCountdown(messagesRef.current)) {
      setCloseConfirmOpen(true);
      return;
    }
    setCloseConfirmOpen(false);
    onClose();
  }

  async function forceCloseAndExit() {
    if (forceClosing) return;
    setForceClosing(true);
    const snapshot = messagesRef.current;
    const tasks: Promise<unknown>[] = [];
    for (const m of snapshot) {
      if (m.role !== "assistant" || !m.blocks) continue;
      for (const b of m.blocks) {
        if (b.type === "choice_card" && b.status === "open") {
          tasks.push(cancelAgentChoiceApi(b.requestId).catch(() => undefined));
        }
        if (b.type === "skill_form_card" && b.status === "open") {
          tasks.push(cancelAgentSkillFormApi(b.requestId).catch(() => undefined));
        }
      }
    }
    await Promise.all(tasks);
    abortRef.current?.abort();
    setMessages((prev) =>
      prev.map((m) => {
        if (m.role !== "assistant" || !m.blocks) return m;
        return {
          ...m,
          blocks: m.blocks.map((b) => {
            if (b.type === "choice_card" && b.status === "open") {
              return { ...b, status: "cancelled" as const };
            }
            if (b.type === "skill_form_card" && b.status === "open") {
              return { ...b, status: "cancelled" as const };
            }
            return b;
          }),
        };
      }),
    );
    setCloseConfirmOpen(false);
    setForceClosing(false);
    onClose();
  }

  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useImperativeHandle(
    ref,
    () => ({
      requestClose: () => requestCloseRef.current(),
    }),
    [],
  );

  useEffect(() => {
    if (!open) {
      setCloseConfirmOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (closeConfirmOpen) {
        if (!forceClosing) setCloseConfirmOpen(false);
        return;
      }
      if (historyOpen) {
        setHistoryOpen(false);
        return;
      }
      requestCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, historyOpen, closeConfirmOpen, forceClosing]);

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    if (!status?.enabled) {
      setStreamError(
        status?.reason === "missing_api_key"
          ? "请先配置 API Key"
          : status?.reason === "skills_missing"
            ? "手册 skills 未就绪，请确认已构建 agent-skills"
            : "助手暂不可用",
      );
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const userMsg: ChatMessage = {
      id: nextId("u"),
      role: "user",
      content: text,
      skillNames: selectedSkillNames.length > 0 ? [...selectedSkillNames] : undefined,
    };
    const assistantId = nextId("a");
    stickToBottomRef.current = true;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setSending(true);
    setStreamError(null);
    setHistoryOpen(false);
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });

    try {
      let hadError = false;
      await streamAgentChatApi(text, {
        mode: sessionMode,
        skillNames: selectedSkillNames.length > 0 ? selectedSkillNames : undefined,
        ...(coding
          ? {
              documentId: documentId ?? null,
              workingMarkdown,
              baseMarkdown,
            }
          : {
              references: {
                domainId: domainId?.trim() || undefined,
                documentId: !graphRefActive && docRefActive ? documentId!.trim() : undefined,
                graphFileId: graphRefActive ? graphFileId!.trim() : undefined,
              },
            }),
        signal: ac.signal,
        onEvent: (event) => {
          if (event.type === "text_delta") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const blocks = appendTextDelta(m.blocks ?? [], event.text);
                return { ...m, blocks, content: textFromBlocks(blocks) };
              }),
            );
            requestAnimationFrame(() => scrollToBottomIfStuck());
          } else if (event.type === "thinking_delta") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const blocks = appendThinkingDelta(m.blocks ?? [], event.text);
                return { ...m, blocks };
              }),
            );
            requestAnimationFrame(() => scrollToBottomIfStuck());
          } else if (event.type === "sources") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const blocks = (m.blocks ?? []).slice();
                const last = blocks[blocks.length - 1];
                // 连续 sources 更新合并为同一块，避免手册多章时堆多份
                if (last?.type === "sources") {
                  blocks[blocks.length - 1] = { type: "sources", items: event.items };
                } else {
                  blocks.push({ type: "sources", items: event.items });
                }
                return { ...m, blocks };
              }),
            );
            requestAnimationFrame(() => scrollToBottomIfStuck());
          } else if (event.type === "document_table") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const blocks = [
                  ...(m.blocks ?? []),
                  {
                    type: "document_table" as const,
                    title: event.title,
                    rows: event.rows,
                  },
                ];
                return { ...m, blocks };
              }),
            );
            requestAnimationFrame(() => scrollToBottomIfStuck());
          } else if (event.type === "document_card") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const blocks = [
                  ...(m.blocks ?? []),
                  {
                    type: "document_card" as const,
                    documentId: event.documentId,
                    title: event.title,
                    path: event.path,
                    preview: event.preview,
                  },
                ];
                return { ...m, blocks };
              }),
            );
            requestAnimationFrame(() => scrollToBottomIfStuck());
          } else if (event.type === "tool_notice") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const blocks = [
                  ...(m.blocks ?? []),
                  {
                    type: "tool_notice" as const,
                    toolName: event.toolName,
                    text: event.text,
                  },
                ];
                return { ...m, blocks };
              }),
            );
            requestAnimationFrame(() => scrollToBottomIfStuck());
          } else if (event.type === "tool_call") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const blocks = upsertToolCallBlock(m.blocks ?? [], {
                  type: "tool_call",
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  label: event.label,
                  status: event.status,
                  detail: event.detail,
                });
                return { ...m, blocks };
              }),
            );
            requestAnimationFrame(() => scrollToBottomIfStuck());
          } else if (event.type === "choice_card") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const blocks = [
                  ...(m.blocks ?? []),
                  {
                    type: "choice_card" as const,
                    requestId: event.requestId,
                    title: event.title,
                    options: event.options,
                    expiresAt: event.expiresAt,
                    status: "open" as const,
                  },
                ];
                return { ...m, blocks };
              }),
            );
            requestAnimationFrame(() => scrollToBottomIfStuck());
          } else if (event.type === "choice_expired") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId || !m.blocks) return m;
                return {
                  ...m,
                  blocks: m.blocks.map((b) =>
                    b.type === "choice_card" &&
                    b.requestId === event.requestId &&
                    b.status === "open"
                      ? { ...b, status: "expired" as const }
                      : b,
                  ),
                };
              }),
            );
          } else if (event.type === "skill_form_card") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const blocks = [
                  ...(m.blocks ?? []),
                  {
                    type: "skill_form_card" as const,
                    requestId: event.requestId,
                    mode: event.mode,
                    title: event.title,
                    currentName: event.currentName,
                    initialName: event.initialName,
                    initialDescription: event.initialDescription,
                    initialBody: event.initialBody,
                    expiresAt: event.expiresAt,
                    status: "open" as const,
                  },
                ];
                return { ...m, blocks };
              }),
            );
            requestAnimationFrame(() => scrollToBottomIfStuck());
          } else if (event.type === "skill_form_expired") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId || !m.blocks) return m;
                return {
                  ...m,
                  blocks: m.blocks.map((b) =>
                    b.type === "skill_form_card" &&
                    b.requestId === event.requestId &&
                    b.status === "open"
                      ? { ...b, status: "expired" as const }
                      : b,
                  ),
                };
              }),
            );
          } else if (event.type === "markdown_set") {
            onMarkdownSet?.(event.markdown);
          } else if (event.type === "tree_changed") {
            void onTreeChanged?.();
          } else if (event.type === "document_overwritten") {
            void onDocumentOverwritten?.({
              documentId: event.documentId,
              headCommitId: event.headCommitId,
            });
          } else if (event.type === "open_coding") {
            void onOpenCoding?.({
              documentId: event.documentId,
              displayName: event.displayName,
            });
          } else if (event.type === "context_usage") {
            setContextUsage({
              percent: event.percent,
              used: event.used,
              limit: event.limit,
            });
          } else if (event.type === "error") {
            hadError = true;
            setStreamError(event.message);
          }
        },
      });
      if (!ac.signal.aborted && !hadError) {
        setSelectedSkillNames([]);
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      setStreamError(err instanceof Error ? err.message : String(err));
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.blocks
            ? { ...m, blocks: sealThinking(m.blocks) }
            : m,
        ),
      );
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
      const created = await createAgentSessionApi(
        sessionMode,
        coding ? documentId : undefined,
        domainId ?? null,
      );
      setSessionId(created.sessionId);
      setMessages([]);
      setInput("");
      stickToBottomRef.current = true;
      void refreshContextUsage();
      void refreshSessions();
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
      const opened = await openAgentSessionApi(
        id,
        sessionMode,
        coding ? documentId : undefined,
      );
      setSessionId(opened.sessionId);
      setMessages(toChatMessages(opened.sessionId, opened.messages));
      setInput("");
      setHistoryOpen(false);
      setRenamingId(null);
      stickToBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottomIfStuck());
      void refreshContextUsage();
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }

  function patchSessionLocal(next: AgentSessionSummary) {
    setSessions((prev) => {
      const list = prev.map((s) => (s.id === next.id ? { ...s, ...next } : s));
      list.sort((a, b) => {
        const ap = a.pinned === true;
        const bp = b.pinned === true;
        if (ap !== bp) return ap ? -1 : 1;
        return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
      });
      return list;
    });
  }

  async function onTogglePin(s: AgentSessionSummary) {
    if (sending) return;
    try {
      const next = await pinAgentSessionApi(s.id, !(s.pinned === true), sessionMode);
      patchSessionLocal(next);
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }

  function startRename(s: AgentSessionSummary) {
    setRenamingId(s.id);
    setRenameDraft(s.title);
  }

  async function commitRename(id: string) {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!title) return;
    try {
      const next = await renameAgentSessionApi(id, title, sessionMode);
      patchSessionLocal(next);
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    }
  }

  const domainLabel = (id: string) => {
    const d = domains.find((x) => x.domainId === id);
    if (!d) return id === DEFAULT_DOMAIN_ID ? "default" : id;
    return localizeDomainName ? localizeDomainName(d.domainName) : d.domainName;
  };

  const visibleSessions = useMemo(() => {
    if (historyScope === "all" || !domainId) return sessions;
    return sessions.filter(
      (s) => (s.domainId || DEFAULT_DOMAIN_ID) === domainId,
    );
  }, [sessions, historyScope, domainId]);

  const pinnedSessions = useMemo(
    () => visibleSessions.filter((s) => s.pinned === true),
    [visibleSessions],
  );

  /** 按工作空间分组；置顶只是顶栏多一份入口，原分组里仍保留 */
  const domainGroups = useMemo(() => {
    const map = new Map<string, AgentSessionSummary[]>();
    for (const s of visibleSessions) {
      const key = s.domainId?.trim() || DEFAULT_DOMAIN_ID;
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    const current = domainId?.trim() || DEFAULT_DOMAIN_ID;
    return Array.from(map.entries())
      .map(([id, items]) => ({ id, items, label: domainLabel(id) }))
      .sort((a, b) => {
        if (a.id === current) return -1;
        if (b.id === current) return 1;
        return a.label.localeCompare(b.label, "zh");
      });
  }, [visibleSessions, domains, localizeDomainName, domainId]);

  function isDomainExpanded(id: string): boolean {
    if (domainCollapsed[id] !== undefined) return !domainCollapsed[id];
    if (historyScope === "all") {
      return id === (domainId?.trim() || DEFAULT_DOMAIN_ID);
    }
    return true;
  }

  function toggleDomainFolder(id: string) {
    setDomainCollapsed((prev) => {
      const expanded = isDomainExpanded(id);
      return { ...prev, [id]: expanded };
    });
  }

  function openDocumentFromTable(documentId: string) {
    if (!documentId || !onOpenDocument) return;
    void onOpenDocument(documentId);
  }

  function renderHistoryRow(s: AgentSessionSummary) {
    const renaming = renamingId === s.id;
    return (
      <div
        className={
          "mdocs-agent-panel-history-item" + (s.id === sessionId ? " active" : "")
        }
      >
        {renaming ? (
          <input
            className="mdocs-agent-panel-history-rename"
            value={renameDraft}
            autoFocus
            maxLength={80}
            aria-label="重命名会话"
            onChange={(e) => setRenameDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitRename(s.id);
              } else if (e.key === "Escape") {
                setRenamingId(null);
              }
            }}
            onBlur={() => void commitRename(s.id)}
          />
        ) : (
          <button
            type="button"
            className="mdocs-agent-panel-history-open"
            disabled={sending}
            onClick={() => void onOpenSession(s.id)}
          >
            <span className="mdocs-agent-panel-history-title">{s.title}</span>
            <span className="mdocs-agent-panel-history-time">
              {formatSessionTime(s.updatedAt)}
            </span>
          </button>
        )}
        <div className="mdocs-agent-panel-history-actions">
          <button
            type="button"
            className={
              "mdocs-agent-panel-history-action" + (s.pinned ? " pinned" : "")
            }
            title={s.pinned ? "取消置顶" : "置顶"}
            aria-label={s.pinned ? "取消置顶" : "置顶"}
            disabled={sending}
            onClick={(e) => {
              e.stopPropagation();
              void onTogglePin(s);
            }}
          >
            <Pin size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="mdocs-agent-panel-history-action"
            title="重命名"
            aria-label="重命名"
            disabled={sending || renaming}
            onClick={(e) => {
              e.stopPropagation();
              startRename(s);
            }}
          >
            <Pencil size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    );
  }

  if (!open) return null;

  const needsApiKey = status?.reason === "missing_api_key";
  const unavailableHint =
    statusError ??
    (status && !status.enabled && !needsApiKey
      ? status.reason === "skills_missing"
        ? "skills 未就绪"
        : "助手暂不可用"
      : null);

  return (
    <div
      ref={panelRef}
      className={
        "mdocs-agent-panel" +
        (embedded
          ? " mdocs-agent-panel--embedded"
          : fullscreen
            ? " mdocs-agent-panel--fullscreen"
            : "")
      }
      role={embedded ? undefined : "dialog"}
      aria-label={coding ? "mdocs 帮写助手" : "mdocs 智能助手"}
      aria-modal={embedded ? undefined : fullscreen ? true : undefined}
      style={embedded || fullscreen ? undefined : anchorStyle}
    >
      <header className="mdocs-agent-panel-header">
        <div className="mdocs-agent-panel-title">
          <img src={deepseekLogoUrl} alt="" className="mdocs-agent-panel-title-logo" />
          <span>{coding ? "mdocs 帮写助手" : "mdocs 智能助手"}</span>
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
          {embedded || !onToggleFullscreen ? null : (
            <button
              type="button"
              className="mdocs-agent-panel-icon-btn"
              title={fullscreen ? "退出全屏" : "全屏"}
              aria-label={fullscreen ? "退出全屏" : "全屏"}
              onClick={onToggleFullscreen}
            >
              {fullscreen ? (
                <Minimize2 size={16} strokeWidth={1.8} />
              ) : (
                <Maximize2 size={16} strokeWidth={1.8} />
              )}
            </button>
          )}
          {embedded ? null : (
            <button
              type="button"
              className="mdocs-agent-panel-icon-btn"
              title="关闭"
              aria-label="关闭"
              onClick={requestClose}
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </header>

      {historyOpen ? (
        <div className="mdocs-agent-panel-history">
          <div className="mdocs-agent-panel-history-head">
            <span>历史会话</span>
            <button
              type="button"
              className="mdocs-agent-panel-history-back"
              onClick={() => {
                setHistoryOpen(false);
                setRenamingId(null);
              }}
            >
              返回对话
            </button>
          </div>
          <div className="mdocs-agent-panel-history-filters" role="tablist" aria-label="按工作空间筛选">
            <button
              type="button"
              role="tab"
              aria-selected={historyScope === "current"}
              className={
                "mdocs-agent-panel-history-filter" +
                (historyScope === "current" ? " active" : "")
              }
              onClick={() => setHistoryScope("current")}
            >
              当前工作空间
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={historyScope === "all"}
              className={
                "mdocs-agent-panel-history-filter" +
                (historyScope === "all" ? " active" : "")
              }
              onClick={() => setHistoryScope("all")}
            >
              全部
            </button>
          </div>
          {sessionsLoading ? (
            <p className="mdocs-agent-panel-history-hint">加载中…</p>
          ) : sessions.length === 0 ? (
            <>
              <p className="mdocs-agent-panel-history-empty">暂无历史会话</p>
              <p className="mdocs-agent-panel-history-hint">发一条消息后会出现在这里</p>
            </>
          ) : visibleSessions.length === 0 ? (
            <p className="mdocs-agent-panel-history-empty">此工作空间暂无会话</p>
          ) : (
            <div className="mdocs-agent-panel-history-list">
              {pinnedSessions.length > 0 ? (
                <section className="mdocs-agent-panel-history-section">
                  <div className="mdocs-agent-panel-history-section-label">Pinned</div>
                  <ul>
                    {pinnedSessions.map((s) => (
                      <li key={s.id}>{renderHistoryRow(s)}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {domainGroups.map((g) => {
                const expanded = isDomainExpanded(g.id);
                return (
                  <section key={g.id} className="mdocs-agent-panel-history-folder">
                    <button
                      type="button"
                      className="mdocs-agent-panel-history-folder-head"
                      aria-expanded={expanded}
                      onClick={() => toggleDomainFolder(g.id)}
                    >
                      {expanded ? (
                        <ChevronDown size={14} strokeWidth={1.8} />
                      ) : (
                        <ChevronRight size={14} strokeWidth={1.8} />
                      )}
                      <span className="mdocs-agent-panel-history-folder-name">{g.label}</span>
                      <span className="mdocs-agent-panel-history-folder-count">{g.items.length}</span>
                    </button>
                    {expanded ? (
                      <ul>
                        {g.items.map((s) => (
                          <li key={s.id}>{renderHistoryRow(s)}</li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="mdocs-agent-panel-body">
          <div className="mdocs-agent-panel-scroll-wrap">
            <div
              className="mdocs-agent-panel-welcome"
              ref={listRef}
              onScroll={onListScroll}
            >
            {messages.length === 0 ? (
              <>
                <p className="mdocs-agent-panel-hello">
                  {coding ? "你好，我是 mdocs 帮写助手" : "你好，我是 mdocs 智能助手"}
                </p>
                <p className="mdocs-agent-panel-desc">
                  {coding
                    ? "这里专注改稿：你说怎么写，我更新右侧提案；按段接受或拒绝后，再点「完成并写回」。答疑、建目录、搜文档请用右下角「智能助手」。"
                    : "我能答疑、搜文档、整理结构，也能帮你写全文；需要按段精细改稿，请点文档顶栏「帮写」。"}
                </p>
                {needsApiKey ? (
                  <AgentApiKeyInlineSetup onConfigured={refreshAgentStatus} />
                ) : unavailableHint ? (
                  <p className="mdocs-agent-panel-status-warn">{unavailableHint}</p>
                ) : (
                  <div className="mdocs-agent-panel-chips">
                    {(coding ? CODING_SUGGESTIONS : ASK_SUGGESTIONS).map((q) => (
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
                      {m.role === "user" && m.skillNames && m.skillNames.length > 0 ? (
                        <div className="mdocs-agent-msg-skills">Skill ×{m.skillNames.length}</div>
                      ) : null}
                      {m.role === "assistant" ? (
                        m.blocks && m.blocks.length > 0 ? (
                          <div className="mdocs-agent-panel-timeline">
                            {m.blocks.map((block, bi) => {
                              if (block.type === "thinking") {
                                return (
                                  <AgentThinkingFold
                                    key={`${m.id}-th-${bi}`}
                                    block={block}
                                    live={sending && !block.endedAt}
                                    now={thinkNow}
                                  />
                                );
                              }
                              if (block.type === "text") {
                                if (!block.text) return null;
                                return (
                                  <div key={`${m.id}-t-${bi}`} className="mdocs-agent-panel-block">
                                    <AgentMarkdown>{block.text}</AgentMarkdown>
                                  </div>
                                );
                              }
                              if (block.type === "sources") {
                                if (block.items.length === 0) return null;
                                return (
                                  <div key={`${m.id}-s-${bi}`} className="mdocs-agent-panel-block">
                                    <details className="mdocs-agent-panel-tool-fold">
                                      <summary>已阅读 {block.items.length} 个页面</summary>
                                      <ol className="mdocs-agent-panel-sources-list">
                                        {block.items.map((s) => (
                                          <li key={s.id}>
                                            <a href={s.url} target="_blank" rel="noreferrer">
                                              {s.name}
                                            </a>
                                          </li>
                                        ))}
                                      </ol>
                                    </details>
                                  </div>
                                );
                              }
                              if (block.type === "tool_call") {
                                const statusLabel =
                                  block.status === "running"
                                    ? "进行中"
                                    : block.status === "error"
                                      ? "失败"
                                      : "完成";
                                return (
                                  <div
                                    key={`${m.id}-tc-${block.toolCallId}`}
                                    className={`mdocs-agent-panel-block mdocs-agent-tool-call mdocs-agent-tool-call-${block.status}`}
                                  >
                                    <div className="mdocs-agent-tool-call-head">
                                      <span
                                        className="mdocs-agent-tool-call-status"
                                        aria-hidden
                                      />
                                      <span className="mdocs-agent-tool-call-label">
                                        {block.label}
                                      </span>
                                      <span className="mdocs-agent-tool-call-badge">
                                        {statusLabel}
                                      </span>
                                    </div>
                                    {block.detail ? (
                                      <p className="mdocs-agent-tool-call-detail">{block.detail}</p>
                                    ) : null}
                                  </div>
                                );
                              }
                              if (block.type === "tool_notice") {
                                return (
                                  <div key={`${m.id}-n-${bi}`} className="mdocs-agent-panel-block">
                                    <p className="mdocs-agent-panel-tool-notice">{block.text}</p>
                                  </div>
                                );
                              }
                              if (block.type === "choice_card") {
                                return (
                                  <div key={`${m.id}-ch-${bi}`} className="mdocs-agent-panel-block">
                                    <ChoiceCardBlock
                                      block={block}
                                      onResolved={(requestId, choice, status) => {
                                        setMessages((prev) =>
                                          prev.map((msg) => {
                                            if (msg.id !== m.id || !msg.blocks) return msg;
                                            return {
                                              ...msg,
                                              blocks: msg.blocks.map((b) =>
                                                b.type === "choice_card" &&
                                                b.requestId === requestId
                                                  ? {
                                                      ...b,
                                                      status,
                                                      selected:
                                                        status === "selected" ? choice : b.selected,
                                                    }
                                                  : b,
                                              ),
                                            };
                                          }),
                                        );
                                      }}
                                    />
                                  </div>
                                );
                              }
                              if (block.type === "skill_form_card") {
                                return (
                                  <div key={`${m.id}-sf-${bi}`} className="mdocs-agent-panel-block">
                                    <SkillFormCardBlock
                                      block={block}
                                      onResolved={(requestId, status, submittedName) => {
                                        setMessages((prev) =>
                                          prev.map((msg) => {
                                            if (msg.id !== m.id || !msg.blocks) return msg;
                                            return {
                                              ...msg,
                                              blocks: msg.blocks.map((b) =>
                                                b.type === "skill_form_card" &&
                                                b.requestId === requestId
                                                  ? {
                                                      ...b,
                                                      status,
                                                      submittedName:
                                                        status === "submitted"
                                                          ? submittedName
                                                          : b.submittedName,
                                                    }
                                                  : b,
                                              ),
                                            };
                                          }),
                                        );
                                      }}
                                    />
                                  </div>
                                );
                              }
                              if (block.type === "document_card") {
                                const docHref = `${window.location.origin}${window.location.pathname}#/doc/${block.documentId}`;
                                return (
                                  <div key={`${m.id}-c-${bi}`} className="mdocs-agent-panel-block">
                                    <details className="mdocs-agent-panel-tool-fold" open>
                                      <summary>
                                        <button
                                          type="button"
                                          className="mdocs-agent-panel-doc-link"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            void openDocumentFromTable(block.documentId);
                                          }}
                                        >
                                          《{block.title}》
                                        </button>
                                        <span className="mdocs-agent-panel-tool-fold-hint">打开文档</span>
                                      </summary>
                                      <div className="mdocs-agent-panel-doc-card-body">
                                        {block.path ? (
                                          <p className="mdocs-agent-panel-doc-card-path">{block.path}</p>
                                        ) : null}
                                        <p className="mdocs-agent-panel-doc-card-path">
                                          <a
                                            href={docHref}
                                            className="mdocs-agent-panel-doc-link"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              void openDocumentFromTable(block.documentId);
                                            }}
                                          >
                                            {docHref}
                                          </a>
                                        </p>
                                        {block.preview ? (
                                          <p className="mdocs-agent-panel-doc-card-preview">{block.preview}</p>
                                        ) : (
                                          <p className="mdocs-agent-panel-doc-card-preview muted">（无正文预览）</p>
                                        )}
                                      </div>
                                    </details>
                                  </div>
                                );
                              }
                              return (
                                <div key={`${m.id}-d-${bi}`} className="mdocs-agent-panel-block">
                                  <details className="mdocs-agent-panel-tool-fold">
                                    <summary>
                                      {block.title}
                                      <span className="mdocs-agent-panel-tool-fold-hint">
                                        {block.rows.length === 0 ? "无结果" : `${block.rows.length} 条`}
                                      </span>
                                    </summary>
                                    <div className="mdocs-agent-panel-doc-table-wrap">
                                      {block.rows.length === 0 ? (
                                        <p className="mdocs-agent-panel-doc-table-empty">无结果</p>
                                      ) : (
                                        <table className="mdocs-agent-panel-doc-table">
                                          <thead>
                                            <tr>
                                              <th>文章名字</th>
                                              <th>文章内容</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {block.rows.map((row) => (
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
                                      )}
                                    </div>
                                  </details>
                                </div>
                              );
                            })}
                            {sending &&
                            m.id === messages[messages.length - 1]?.id &&
                            !textFromBlocks(m.blocks) &&
                            !hasThinkingText(m.blocks) ? (
                              <span className="mdocs-agent-panel-thinking" aria-label="思考中">
                                <span />
                                <span />
                                <span />
                              </span>
                            ) : null}
                          </div>
                        ) : m.content ? (
                          <AgentMarkdown>{m.content}</AgentMarkdown>
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
            {showJumpBottom ? (
              <button
                type="button"
                className="mdocs-chat-jump-bottom"
                onClick={jumpToBottom}
                title="回到底部"
                aria-label="回到底部"
              >
                <ArrowDown size={14} strokeWidth={2} aria-hidden />
                <span>置底</span>
              </button>
            ) : null}
          </div>
          {streamError ? (
            <p className="mdocs-agent-panel-status-warn">{streamError}</p>
          ) : null}
          {needsApiKey && messages.length > 0 ? (
            <AgentApiKeyInlineSetup onConfigured={refreshAgentStatus} />
          ) : null}
          <AgentSkillRefPicker
            selectedNames={selectedSkillNames}
            onChange={setSelectedSkillNames}
            disabled={sending || !status?.enabled}
          />
          <div className="mdocs-agent-panel-input-wrap">
            {coding ? null : graphRefActive ? (
              <div className="mdocs-agent-doc-ref mdocs-agent-graph-ref">
                <Network size={15} strokeWidth={1.75} className="mdocs-agent-doc-ref-icon" aria-hidden />
                <div className="mdocs-agent-doc-ref-text">
                  <span className="mdocs-agent-doc-ref-title">{graphRefTitle}</span>
                  <span className="mdocs-agent-doc-ref-path">图谱（只读）</span>
                </div>
                <button
                  type="button"
                  className="mdocs-agent-doc-ref-unlink"
                  title="取消引用"
                  aria-label="取消引用当前图谱"
                  disabled={sending}
                  onClick={() => setDocRefDismissed(true)}
                >
                  <X size={14} strokeWidth={2} aria-hidden />
                </button>
              </div>
            ) : docRefActive ? (
              <div className="mdocs-agent-doc-ref">
                <FileText size={15} strokeWidth={1.75} className="mdocs-agent-doc-ref-icon" aria-hidden />
                <div className="mdocs-agent-doc-ref-text">
                  <span className="mdocs-agent-doc-ref-title">{docRefTitle}</span>
                  {docRefPath ? (
                    <span className="mdocs-agent-doc-ref-path">{docRefPath}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="mdocs-agent-doc-ref-unlink"
                  title="取消引用"
                  aria-label="取消引用当前文档"
                  disabled={sending}
                  onClick={() => setDocRefDismissed(true)}
                >
                  <X size={14} strokeWidth={2} aria-hidden />
                </button>
              </div>
            ) : null}
            <div className="mdocs-agent-panel-input-body">
            <textarea
              className="mdocs-agent-panel-input"
              rows={2}
              placeholder={
                status?.enabled
                  ? coding
                    ? "说说要写什么…"
                    : "把你的问题告诉我…"
                  : "请先配置 API Key"
              }
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
              className={
                sending
                  ? "mdocs-agent-panel-send mdocs-agent-panel-send-stop"
                  : "mdocs-agent-panel-send"
              }
              disabled={
                sending
                  ? false
                  : !status?.enabled || !input.trim()
              }
              onClick={() => {
                if (sending) {
                  abortRef.current?.abort();
                  return;
                }
                void sendMessage(input);
              }}
              title={sending ? "停止" : "发送"}
              aria-label={sending ? "停止" : "发送"}
            >
              {sending ? "■" : "↑"}
            </button>
            </div>
          </div>
          <p className="mdocs-agent-panel-footnote">内容由 AI 生成，仅供参考</p>
        </div>
      )}

      {closeConfirmOpen ? (
        <div
          className="mdocs-agent-close-confirm-backdrop"
          role="presentation"
          onClick={() => {
            if (!forceClosing) setCloseConfirmOpen(false);
          }}
        >
          <div
            className="mdocs-message-dialog mdocs-agent-close-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mdocs-agent-close-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="mdocs-agent-close-confirm-title" className="mdocs-message-dialog-title">
              有待处理的倒计时
            </h3>
            <p className="mdocs-message-dialog-body">
              当前还有选择卡或 Skill 表单在倒计时。强制关闭会取消这些操作并退出助手；也可以继续等待完成后再关。
            </p>
            <div className="mdocs-message-dialog-actions mdocs-agent-close-confirm-actions">
              <button
                type="button"
                className="secondary"
                disabled={forceClosing}
                onClick={() => setCloseConfirmOpen(false)}
              >
                继续等待
              </button>
              <button
                type="button"
                disabled={forceClosing}
                onClick={() => void forceCloseAndExit()}
              >
                {forceClosing ? "关闭中…" : "强制关闭并退出"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});
