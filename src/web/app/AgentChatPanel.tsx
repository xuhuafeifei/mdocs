import { ArrowDown, Check, ChevronDown, ChevronRight, Copy, History, Link2, Maximize2, Minimize2, Network, PanelLeft, PanelLeftClose, Pencil, Pin, Plus, X } from "lucide-react";
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import deepseekLogoUrl from "../assets/deepseek.svg";
import {
  clampAgentDockWidth,
  clampAgentPanelWidth,
  loadAgentPanelWidth,
  saveAgentPanelWidth,
} from "./AgentFab";
import {
  dataTransferHasFiles,
  filesFromDataTransfer,
  nameFilesForUpload,
} from "./agent-composer-files";
import { documentIdFromAgentHref } from "./agent-doc-link";
import { fileMarkKind, fileMarkLabel } from "./agent-file-mark";
import {
  type AgentDocumentTableRow,
  compactAgentSessionApi,
  createAgentSessionApi,
  fetchAgentContextUsageApi,
  fetchAgentSessionApi,
  fetchAgentSessionsApi,
  fetchAgentStatusApi,
  openAgentSessionApi,
  pinAgentSessionApi,
  renameAgentSessionApi,
  streamAgentChatApi,
  streamAgentRunApi,
  cancelAgentRunApi,
  submitAgentChoiceApi,
  submitAgentEditorDraftApi,
  expireAgentChoiceApi,
  cancelAgentChoiceApi,
  cancelAgentSkillFormApi,
  uploadAgentAttachmentApi,
  type AgentAttachmentUpload,
  type AgentContextUsage,
  type AgentRunPublic,
  type AgentSessionSummary,
  type AgentSourceRef,
  type AgentStatus,
  type AgentStreamEvent,
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

const openAgentDocumentRef: { current: (documentId: string) => void } = {
  current: () => {},
};

function reactNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeText).join("");
  return "";
}

function FileTypeMark(props: { name: string; mime?: string; inline?: boolean }) {
  const kind = fileMarkKind(props.name, props.mime ?? "");
  if (props.inline && kind === "file") return null;
  return (
    <span
      className={
        "mdocs-agent-file-mark mdocs-agent-file-mark-" +
        kind +
        (props.inline ? " is-inline" : "")
      }
      aria-hidden
    >
      {fileMarkLabel(kind)}
    </span>
  );
}

function ImagePreviewDialog(props: { src: string; name: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onClose]);

  return createPortal(
    <div className="mdocs-agent-image-preview" role="dialog" aria-modal="true" aria-label={props.name}>
      <button
        type="button"
        className="mdocs-agent-image-preview-backdrop"
        aria-label="关闭预览"
        onClick={props.onClose}
      />
      <div className="mdocs-agent-image-preview-frame">
        <button
          type="button"
          className="mdocs-agent-image-preview-close"
          aria-label="关闭"
          onClick={props.onClose}
        >
          <X size={16} aria-hidden />
        </button>
        <img src={props.src} alt={props.name} />
        <p>{props.name}</p>
      </div>
    </div>,
    document.body,
  );
}

function AgentAssetChip(props: {
  id: string;
  name: string;
  mime: string;
  previewUrl?: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const [thumbBroken, setThumbBroken] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const kind = fileMarkKind(props.name, props.mime);
  const thumb =
    kind === "image" && !thumbBroken
      ? props.previewUrl || `/api/agent/attachments/${props.id}`
      : "";
  return (
    <span className={"mdocs-agent-msg-asset-chip" + (thumb ? " has-thumb" : "")} title={props.name}>
      {thumb ? (
        <button
          type="button"
          className="mdocs-agent-file-thumb-btn"
          aria-label={`预览 ${props.name}`}
          title="点击查看大图"
          onClick={() => setPreviewOpen(true)}
        >
          <img
            className="mdocs-agent-file-thumb"
            src={thumb}
            alt=""
            onError={() => setThumbBroken(true)}
          />
        </button>
      ) : (
        <FileTypeMark name={props.name} mime={props.mime} />
      )}
      <span className="mdocs-agent-msg-asset-chip-name">{props.name}</span>
      {props.onRemove ? (
        <button
          type="button"
          className="mdocs-agent-pending-asset-remove"
          aria-label={`移除 ${props.name}`}
          disabled={props.removeDisabled}
          onClick={props.onRemove}
        >
          <X size={12} aria-hidden />
        </button>
      ) : null}
      {previewOpen && thumb ? (
        <ImagePreviewDialog src={thumb} name={props.name} onClose={() => setPreviewOpen(false)} />
      ) : null}
    </span>
  );
}

function AgentMarkdownLink(props: { href?: string; children?: ReactNode }) {
  const documentId = documentIdFromAgentHref(props.href);
  const label = reactNodeText(props.children);
  const mark = label ? <FileTypeMark name={label} inline /> : null;
  if (!documentId) {
    const external = props.href?.startsWith("http://") || props.href?.startsWith("https://");
    return (
      <a href={props.href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {mark}
        {props.children}
      </a>
    );
  }
  return (
    <a
      href={`#/doc/${documentId}`}
      className="mdocs-agent-panel-doc-link"
      onClick={(ev) => {
        ev.preventDefault();
        openAgentDocumentRef.current(documentId);
      }}
    >
      {mark}
      {props.children}
    </a>
  );
}

/** 模块级稳定引用：避免输入框改 state 时 components 换新导致 Mermaid 卸载重挂 */
const agentMarkdownComponents = {
  pre: ({ children }: { children?: ReactNode }) => <MarkdownPre>{children}</MarkdownPre>,
  a: AgentMarkdownLink,
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
      status: "preparing" | "running" | "done" | "error";
      detail?: string;
      webResults?: {
        query: string;
        items: Array<{
          title: string;
          url: string;
          snippet: string;
          summary?: string;
          content?: string;
          siteName?: string | null;
          siteIcon?: string | null;
          date?: string | null;
        }>;
      };
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
  assets?: Array<{ id: string; name: string; mime: string; bytes: number; previewUrl?: string }>;
  /** 仅当轮 SSE；历史会话不恢复 */
  blocks?: AssistantBlock[];
};

const ASK_SUGGESTIONS = ["如何发布文档？", "草稿是什么？", "如何创建工作空间？"];

/** 帮写空态引导：偏改稿/写作，和 Ask 上手答疑区分开 */
const CODING_SUGGESTIONS = ["润色当前文稿", "补写开头引言", "把这段改得更简洁"];

const CONTEXT_COMPACT_PREFIX = "【系统·上下文压缩】";

function isContextCompactSummary(content: string): boolean {
  return content.startsWith(CONTEXT_COMPACT_PREFIX);
}

function toChatMessages(
  sessionId: string,
  messages: {
    role: "user" | "assistant";
    content: string;
    skillNames?: string[];
    skillIds?: string[];
    assets?: Array<{ id: string; name: string; mime: string; bytes: number; previewUrl?: string }>;
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
      assets: m.assets && m.assets.length > 0 ? m.assets : undefined,
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

const TOOL_CALL_STATUS_RANK: Record<
  Extract<AssistantBlock, { type: "tool_call" }>["status"],
  number
> = {
  preparing: 0,
  running: 1,
  done: 2,
  error: 2,
};

function upsertToolCallBlock(
  blocks: AssistantBlock[],
  call: Extract<AssistantBlock, { type: "tool_call" }>,
): AssistantBlock[] {
  const next = sealThinking(blocks).slice();
  let idx = next.findIndex(
    (b) => b.type === "tool_call" && b.toolCallId === call.toolCallId,
  );
  // preparing 可能用 pending:N，running 起用真实 toolCallId —— 合并到同名准备卡
  if (idx < 0 && call.status !== "preparing") {
    const preparing = next
      .map((b, i) => ({ b, i }))
      .filter(
        ({ b }) =>
          b.type === "tool_call" &&
          b.status === "preparing" &&
          (b.toolName === call.toolName ||
            b.toolName === "tool" ||
            b.toolCallId.startsWith("pending:")),
      );
    const byName = preparing.filter(({ b }) =>
      b.type === "tool_call" ? b.toolName === call.toolName : false,
    );
    const pool = byName.length > 0 ? byName : preparing;
    if (pool.length > 0) idx = pool[pool.length - 1]!.i;
  }
  if (idx >= 0) {
    const prev = next[idx] as Extract<AssistantBlock, { type: "tool_call" }>;
    if (TOOL_CALL_STATUS_RANK[call.status] < TOOL_CALL_STATUS_RANK[prev.status]) {
      return next;
    }
    next[idx] = {
      ...prev,
      ...call,
      toolCallId: call.toolCallId || prev.toolCallId,
      label: call.label || prev.label,
      detail: call.detail ?? prev.detail,
      webResults: call.webResults ?? prev.webResults,
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

/** 用户 / Agent 消息正文可复制文本（不含思考与工具卡） */
function messageCopyText(m: ChatMessage): string {
  if (m.role === "user") return (m.content ?? "").trim();
  if (m.blocks && m.blocks.length > 0) {
    return m.blocks
      .filter((b): b is Extract<AssistantBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n\n")
      .trim();
  }
  return (m.content ?? "").trim();
}

function MessageCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);
  if (!text) return null;
  return (
    <button
      type="button"
      className="mdocs-agent-panel-msg-copy"
      aria-label={copied ? "已复制" : "复制"}
      title={copied ? "已复制" : "复制"}
      onClick={() => {
        void copyTextToClipboard(text).then((ok) => {
          if (!ok) return;
          setCopied(true);
          if (timerRef.current != null) window.clearTimeout(timerRef.current);
          timerRef.current = window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
    </button>
  );
}

type WebSearchResultItem = {
  title: string;
  url: string;
  snippet: string;
  summary?: string;
  content?: string;
  siteName?: string | null;
  siteIcon?: string | null;
  date?: string | null;
};

function WebSearchResultItemRow({ item }: { item: WebSearchResultItem }) {
  const body = (item.content || item.summary || "").trim();
  const canExpand = Boolean(body && body !== item.snippet.trim());
  const meta = [item.siteName, item.date ? item.date.slice(0, 10) : ""]
    .filter(Boolean)
    .join(" · ");

  const titleLink = (
    <a
      className="mdocs-agent-web-results-title"
      href={item.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {item.siteIcon ? (
        <img
          className="mdocs-agent-web-results-icon"
          src={item.siteIcon}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="mdocs-agent-web-results-icon-fallback" aria-hidden />
      )}
      <span>{item.title}</span>
    </a>
  );

  if (!canExpand) {
    return (
      <li className="mdocs-agent-web-results-item">
        {titleLink}
        {meta ? <div className="mdocs-agent-web-results-meta">{meta}</div> : null}
        {item.snippet ? (
          <p className="mdocs-agent-web-results-snippet">{item.snippet}</p>
        ) : null}
      </li>
    );
  }

  return (
    <li className="mdocs-agent-web-results-item">
      <details className="mdocs-agent-web-result-item-fold">
        <summary>
          <ChevronRight
            size={14}
            strokeWidth={1.8}
            className="mdocs-agent-web-result-item-chevron"
          />
          <span className="mdocs-agent-web-result-item-summary">
            {titleLink}
            {meta ? <span className="mdocs-agent-web-results-meta inline">{meta}</span> : null}
            {item.snippet ? (
              <span className="mdocs-agent-web-results-snippet inline">{item.snippet}</span>
            ) : null}
          </span>
        </summary>
        <div className="mdocs-agent-web-result-item-body">
          {body}
        </div>
      </details>
    </li>
  );
}

/** 网页搜索结果：外层折叠列表；单条可再展开长摘要/正文 */
function WebSearchResultsFold({
  query,
  items,
}: {
  query: string;
  items: WebSearchResultItem[];
}) {
  const [open, setOpen] = useState(true);
  const q = query.trim();
  const foldLabel = q
    ? `网页结果 · ${items.length} 条 · 「${q.length > 36 ? `${q.slice(0, 36)}…` : q}」`
    : `网页结果 · ${items.length} 条`;

  return (
    <details
      className="mdocs-agent-tool-call-fold mdocs-agent-web-results-fold"
      open={open}
      onToggle={(e) => {
        setOpen((e.currentTarget as HTMLDetailsElement).open);
      }}
    >
      <summary>
        <span className="mdocs-agent-tool-call-fold-label">{foldLabel}</span>
        <ChevronRight
          size={14}
          strokeWidth={1.8}
          className="mdocs-agent-tool-call-fold-chevron"
        />
      </summary>
      <div className="mdocs-agent-web-results">
        <ol className="mdocs-agent-web-results-list">
          {items.map((item) => (
            <WebSearchResultItemRow key={item.url} item={item} />
          ))}
        </ol>
      </div>
    </details>
  );
}

/** 写工具 detail：可折叠；输出中 summary 波浪，展开后正文增量跟滚 */
function ToolCallDetailScroll({
  detail,
  followTail,
  grow,
  error,
}: {
  detail: string;
  followTail: boolean;
  grow?: boolean;
  /** 失败态：红字展示错误原文 */
  error?: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const animRef = useRef(0);
  const [open, setOpen] = useState(Boolean(error));
  const nl = detail.indexOf("\n");
  const meta = nl >= 0 ? detail.slice(0, nl) : detail;
  const body = nl >= 0 ? detail.slice(nl + 1) : "";
  const scrollable = body.length > 0;
  const detailClass =
    "mdocs-agent-tool-call-detail" +
    (error ? " mdocs-agent-tool-call-detail--error" : "");

  useLayoutEffect(() => {
    if (!open || !followTail || !scrollable || !bodyRef.current) return;
    if (!stickRef.current) return;
    const el = bodyRef.current;
    cancelAnimationFrame(animRef.current);
    if (!grow) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    const step = () => {
      const target = el.scrollHeight - el.clientHeight;
      const cur = el.scrollTop;
      const delta = target - cur;
      if (delta <= 1) {
        el.scrollTop = target;
        return;
      }
      el.scrollTop = cur + Math.max(1.5, delta * 0.28);
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [body, followTail, scrollable, grow, open]);

  if (!scrollable) {
    return (
      <p className={detailClass}>
        <span
          className={
            "mdocs-agent-tool-call-fold-label" + (followTail ? " live" : "")
          }
        >
          {meta}
        </span>
      </p>
    );
  }

  return (
    <details
      className={
        "mdocs-agent-tool-call-fold" +
        (error ? " mdocs-agent-tool-call-fold--error" : "")
      }
      open={open}
      onToggle={(e) => {
        setOpen((e.currentTarget as HTMLDetailsElement).open);
      }}
    >
      <summary>
        <span
          className={
            "mdocs-agent-tool-call-fold-label" + (followTail ? " live" : "")
          }
        >
          {meta}
        </span>
        <ChevronRight
          size={14}
          strokeWidth={1.8}
          className="mdocs-agent-tool-call-fold-chevron"
        />
      </summary>
      <div
        ref={bodyRef}
        className={
          detailClass +
          " scrollable" +
          (grow ? " grow" : "") +
          (followTail ? " live" : "")
        }
        onScroll={() => {
          const el = bodyRef.current;
          if (!el) return;
          const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
          stickRef.current = gap < 28;
        }}
      >
        {body}
        {followTail && grow ? (
          <span className="mdocs-agent-tool-call-caret" aria-hidden />
        ) : null}
      </div>
    </details>
  );
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

type ComposerPageRef = {
  key: string;
  variant: "page" | "graph";
  kind: string;
  name: string;
  title: string;
};

function PageRefChip(props: {
  item: ComposerPageRef;
  disabled?: boolean;
  onDismiss: () => void;
}) {
  const Icon = props.item.variant === "graph" ? Network : Link2;
  return (
    <div className="mdocs-agent-page-chip" title={props.item.title}>
      <Icon
        className={
          "mdocs-agent-page-chip-icon" +
          (props.item.variant === "graph" ? " mdocs-agent-page-chip-icon-graph" : "")
        }
        size={14}
        strokeWidth={2}
        aria-hidden
      />
      <span className="mdocs-agent-page-chip-text">
        <span className="mdocs-agent-page-chip-kind">{props.item.kind}</span>
        <span className="mdocs-agent-page-chip-dot" aria-hidden>
          ·
        </span>
        <span className="mdocs-agent-page-chip-name">{props.item.name}</span>
      </span>
      <button
        type="button"
        className="mdocs-agent-page-chip-x"
        title="取消引用"
        aria-label={`取消引用 ${props.item.name}`}
        disabled={props.disabled}
        onClick={props.onDismiss}
      >
        <X size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

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

type OpenInteraction =
  | {
      kind: "choice";
      messageId: string;
      block: Extract<AssistantBlock, { type: "choice_card" }>;
    }
  | {
      kind: "skill_form";
      messageId: string;
      block: SkillFormCardState;
    };

/** 打开的选择卡 / Skill 表单：提到输入框上方吸底，避免埋进长 thinking */
function collectOpenInteractions(messages: ChatMessage[]): OpenInteraction[] {
  const out: OpenInteraction[] = [];
  for (const m of messages) {
    if (m.role !== "assistant" || !m.blocks?.length) continue;
    for (const b of m.blocks) {
      if (b.type === "choice_card" && b.status === "open") {
        out.push({ kind: "choice", messageId: m.id, block: b });
      } else if (b.type === "skill_form_card" && b.status === "open") {
        out.push({ kind: "skill_form", messageId: m.id, block: b });
      }
    }
  }
  return out;
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
    /**
     * get_editor_draft：收到 SSE 后静默取主栏草稿（MD/HTML），无确认卡。
     * 未传则回传 unavailable。
     */
    onProvideEditorDraft?: (documentId: string) => Promise<
      | {
          status: "ok";
          documentId: string;
          content: string;
          contentFormat: "markdown" | "html" | "plain";
          source: "editor" | "indexeddb";
          localBaseCommitId?: string | null;
          displayName?: string;
        }
      | { status: "unavailable"; reason: string }
    >;
    /** 嵌在帮写左栏或 PC 贴左列：去掉浮层定位 */
    embedded?: boolean;
    /** PC 贴左（embedded 于主壳左列）；与帮写 embedded 区分 */
    docked?: boolean;
    /** PC：浮窗 ↔ 贴左 */
    onToggleDock?: () => void;
    /** 贴左栏当前宽度（px） */
    dockWidth?: number;
    onDockWidthChange?: (width: number) => void;
    mode?: "normal" | "coding";
    workingMarkdown?: string;
    baseMarkdown?: string;
    onMarkdownSet?: (markdown: string) => void;
    onLexicalLinesSet?: (payload: {
      documentId: string;
      mode: "patch_lines" | "replace_all";
      lines: Record<string, string>;
      markdown?: string;
    }) => void;
    onDiffSlotOp?: (payload: {
      documentId: string;
      op: "update_slot" | "insert_after_slot" | "remove_slot" | "overwrite_all";
      slot?: number;
      markdown?: string;
    }) => void;
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
    onProvideEditorDraft,
    embedded = false,
    docked = false,
    onToggleDock,
    dockWidth,
    onDockWidthChange,
    mode = "normal",
    workingMarkdown,
    baseMarkdown,
    onMarkdownSet,
    onLexicalLinesSet,
    onDiffSlotOp,
    onSendingChange,
    onSessionId,
  } = props;
  const onProvideEditorDraftRef = useRef(onProvideEditorDraft);
  onProvideEditorDraftRef.current = onProvideEditorDraft;
  const sessionMode = mode === "coding" ? "coding" : "normal";
  const coding = sessionMode === "coding";
  const showClose = !embedded || docked;
  const showDockToggle = Boolean(onToggleDock) && !coding;
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
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<AgentAttachmentUpload & { previewUrl?: string }>
  >([]);
  const previewUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [composerDragOver, setComposerDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** 用户点右侧取消后，本轮不再带 documentId；换一篇文自动恢复 */
  const [docRefDismissed, setDocRefDismissed] = useState(false);
  const [pageRefsExpanded, setPageRefsExpanded] = useState(false);
  const [panelWidth, setPanelWidth] = useState(loadAgentPanelWidth);
  /** 拖宽时临时改 left，避免贴右边时被挤出视口；松手后仍跟这次拖动，直到 FAB 再移动 */
  const [panelLeft, setPanelLeft] = useState<number | null>(null);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;
  const resizeDragRef = useRef<{
    edge: "left" | "right";
    startX: number;
    startW: number;
    startLeft: number;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [contextUsage, setContextUsage] = useState<AgentContextUsage | null>(null);
  const [contextCompacting, setContextCompacting] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [forceClosing, setForceClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** 当前后台 run；关闭面板只断 SSE，不 clear */
  const activeRunIdRef = useRef<string | null>(null);
  const streamAssistantIdRef = useRef<string | null>(null);
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

  const pageRefs = useMemo((): ComposerPageRef[] => {
    if (coding) return [];
    if (graphRefActive) {
      return [
        {
          key: "graph",
          variant: "graph",
          kind: "图谱引用",
          name: graphRefTitle,
          title: "图谱 · 只读",
        },
      ];
    }
    if (docRefActive) {
      const fileName = docRefPath.split("/").pop()?.trim() || docRefTitle;
      return [
        {
          key: documentId?.trim() || "doc",
          variant: "page",
          kind: "文章引用",
          name: fileName,
          title: docRefPath || docRefTitle,
        },
      ];
    }
    return [];
  }, [
    coding,
    graphRefActive,
    docRefActive,
    graphRefTitle,
    docRefTitle,
    docRefPath,
    documentId,
  ]);

  useEffect(() => {
    setDocRefDismissed(false);
  }, [documentId, graphFileId]);

  useEffect(() => {
    if (pageRefs.length < 2) setPageRefsExpanded(false);
  }, [pageRefs.length]);

  useEffect(() => {
    setPanelLeft(null);
  }, [anchorStyle?.left, anchorStyle?.bottom]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const body = el.closest(".mdocs-agent-panel-input-body");
    el.style.height = "auto";
    const tall = el.scrollHeight > 44;
    el.style.height = tall ? `${Math.min(160, el.scrollHeight)}px` : "";
    body?.classList.toggle("is-tall", tall);
  }, [input]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = resizeDragRef.current;
      if (!drag) return;
      // 贴左：只拖右缘，宽度交给父组件
      if (docked && onDockWidthChange) {
        if (drag.edge !== "right") return;
        onDockWidthChange(
          clampAgentDockWidth(drag.startW + (e.clientX - drag.startX)),
        );
        return;
      }
      const dx = e.clientX - drag.startX;
      let nextW = drag.edge === "right" ? drag.startW + dx : drag.startW - dx;
      nextW = clampAgentPanelWidth(nextW);
      let nextLeft = drag.edge === "left" ? drag.startLeft + (drag.startW - nextW) : drag.startLeft;
      if (nextLeft < 8) {
        nextW = clampAgentPanelWidth(nextW - (8 - nextLeft));
        nextLeft = 8;
      }
      const overflow = nextLeft + nextW - (window.innerWidth - 8);
      if (overflow > 0) {
        if (drag.edge === "right") {
          nextLeft = Math.max(8, nextLeft - overflow);
        } else {
          nextW = clampAgentPanelWidth(nextW - overflow);
        }
      }
      panelWidthRef.current = nextW;
      setPanelWidth(nextW);
      setPanelLeft(nextLeft);
    }
    function onUp() {
      if (!resizeDragRef.current) return;
      resizeDragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (!docked) saveAgentPanelWidth(panelWidthRef.current);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [docked, onDockWidthChange]);

  function onResizePointerDown(edge: "left" | "right", e: ReactPointerEvent<HTMLDivElement>) {
    if (fullscreen) return;
    if (embedded && !docked) return;
    if (docked && edge !== "right") return;
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    resizeDragRef.current = {
      edge,
      startX: e.clientX,
      startW: docked && dockWidth != null ? dockWidth : rect.width,
      startLeft: rect.left,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

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

  /** 选择卡等需用户操作：无视 stick，强制贴底，避免埋在长思考下面 */
  function forceScrollToBottom() {
    stickToBottomRef.current = true;
    requestAnimationFrame(() => {
      scrollToBottom();
      setShowJumpBottom(false);
    });
  }

  const openInteractions = useMemo(
    () => collectOpenInteractions(messages),
    [messages],
  );

  function resolveChoiceCard(
    messageId: string,
    requestId: string,
    choice: string,
    status: "selected" | "cancelled" | "expired" | "failed",
  ): void {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.blocks) return msg;
        return {
          ...msg,
          blocks: msg.blocks.map((b) =>
            b.type === "choice_card" && b.requestId === requestId
              ? {
                  ...b,
                  status,
                  selected: status === "selected" ? choice : b.selected,
                }
              : b,
          ),
        };
      }),
    );
  }

  function resolveSkillFormCard(
    messageId: string,
    requestId: string,
    status: "submitted" | "cancelled" | "expired" | "failed",
    submittedName?: string,
  ): void {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.blocks) return msg;
        return {
          ...msg,
          blocks: msg.blocks.map((b) =>
            b.type === "skill_form_card" && b.requestId === requestId
              ? {
                  ...b,
                  status,
                  submittedName:
                    status === "submitted" ? submittedName : b.submittedName,
                }
              : b,
          ),
        };
      }),
    );
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

  async function onCompactContext() {
    if (contextCompacting || sending || !status?.enabled) return;
    setContextCompacting(true);
    setStreamError(null);
    try {
      const result = await compactAgentSessionApi(sessionMode, {
        sessionId: sessionId ?? undefined,
        documentId: coding ? documentId : undefined,
      });
      setContextUsage({
        percent: result.percent,
        used: result.used,
        limit: result.limit,
      });
      if (result.compacted) {
        const opened = await openAgentSessionApi(
          result.sessionId,
          sessionMode,
          coding ? documentId : undefined,
        );
        setSessionId(opened.sessionId);
        setMessages(toChatMessages(opened.sessionId, opened.messages));
      } else if (result.reason === "nothing_to_compact") {
        setStreamError("暂无可压缩的更早对话");
      } else if (result.reason === "llm_failed" || result.reason === "missing_api_key") {
        setStreamError("压缩失败，请稍后重试");
      }
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: unknown }).code ?? "")
          : "";
      setStreamError(
        code === "SESSION_COMPACTING"
          ? "正在压缩上下文，请稍后再试"
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setContextCompacting(false);
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
      // 关闭面板：只取消 SSE 订阅，后台 run 继续
      abortRef.current?.abort();
      abortRef.current = null;
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
          if (!scopeChanged && prev.length > 0 && !s.activeRun) return prev;
          return toChatMessages(s.sessionId, s.messages);
        });
        if (
          s.activeRun &&
          (s.activeRun.status === "running" || s.activeRun.status === "waiting_user")
        ) {
          void resumeActiveRun(s.activeRun);
        }
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

  // 关闭/卸载只断 SSE 订阅，不 cancel 服务端 run
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

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
    const runId = activeRunIdRef.current;
    if (runId) tasks.push(cancelAgentRunApi(runId).catch(() => undefined));
    await Promise.all(tasks);
    abortRef.current?.abort();
    activeRunIdRef.current = null;
    setSending(false);
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

  function applyStreamEvent(assistantId: string, event: AgentStreamEvent): boolean {
    let hadError = false;
    if (event.type === "run_started") {
      activeRunIdRef.current = event.runId;
      setSessionId(event.sessionId);
      return false;
    }
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
            webResults: event.webResults,
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
      forceScrollToBottom();
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
    } else if (event.type === "editor_draft_request") {
      // 静默：立刻取稿并 POST，无确认卡
      void (async () => {
        const provide = onProvideEditorDraftRef.current;
        try {
          if (!provide) {
            await submitAgentEditorDraftApi({
              requestId: event.requestId,
              status: "unavailable",
              reason: "no_provider",
            });
            return;
          }
          const snap = await provide(event.documentId);
          if (snap.status === "unavailable") {
            await submitAgentEditorDraftApi({
              requestId: event.requestId,
              status: "unavailable",
              reason: snap.reason,
            });
            return;
          }
          await submitAgentEditorDraftApi({
            requestId: event.requestId,
            status: "ok",
            documentId: snap.documentId,
            content: snap.content,
            contentFormat: snap.contentFormat,
            source: snap.source,
            localBaseCommitId: snap.localBaseCommitId,
            displayName: snap.displayName,
          });
        } catch {
          try {
            await submitAgentEditorDraftApi({
              requestId: event.requestId,
              status: "unavailable",
              reason: "provide_failed",
            });
          } catch {
            /* 后端可能已超时 */
          }
        }
      })();
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
      forceScrollToBottom();
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
    } else if (event.type === "lexical_lines_set") {
      onLexicalLinesSet?.({
        documentId: event.documentId,
        mode: event.mode,
        lines: event.lines ?? {},
        ...(event.markdown != null ? { markdown: event.markdown } : {}),
      });
    } else if (event.type === "diff_slot_op") {
      onDiffSlotOp?.({
        documentId: event.documentId,
        op: event.op,
        ...(event.slot != null ? { slot: event.slot } : {}),
        ...(event.markdown != null ? { markdown: event.markdown } : {}),
      });
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
    } else if (event.type === "context_compacting") {
      setContextCompacting(true);
    } else if (event.type === "context_compacted") {
      setContextCompacting(false);
      setContextUsage({
        percent: event.percent,
        used: event.used,
        limit: event.limit,
      });
    } else if (event.type === "error") {
      hadError = true;
      setContextCompacting(false);
      setStreamError(event.message);
    } else if (event.type === "done") {
      setContextCompacting(false);
      activeRunIdRef.current = null;
    }
    return hadError;
  }

  async function resumeActiveRun(run: AgentRunPublic) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    activeRunIdRef.current = run.runId;
    const assistantId = nextId("a");
    streamAssistantIdRef.current = assistantId;
    stickToBottomRef.current = true;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && !last.content && !(last.blocks?.length)) {
        streamAssistantIdRef.current = last.id;
        return prev;
      }
      return [...prev, { id: assistantId, role: "assistant", content: "" }];
    });
    const aid = streamAssistantIdRef.current ?? assistantId;
    setSending(true);
    setStreamError(null);
    try {
      let hadError = false;
      await streamAgentRunApi(run.runId, {
        afterSeq: 0,
        signal: ac.signal,
        onEvent: (event) => {
          if (applyStreamEvent(aid, event)) hadError = true;
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
          m.id === aid && m.blocks ? { ...m, blocks: sealThinking(m.blocks) } : m,
        ),
      );
      if (abortRef.current === ac) abortRef.current = null;
      if (!activeRunIdRef.current) setSending(false);
    }
  }

  async function ensureSessionIdForUpload(): Promise<string | null> {
    if (sessionId) return sessionId;
    try {
      const created = await createAgentSessionApi(
        sessionMode,
        coding ? documentId ?? null : undefined,
      );
      setSessionId(created.sessionId);
      return created.sessionId;
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  async function uploadFiles(incoming: File[]) {
    const files = nameFilesForUpload(
      incoming,
      pendingAttachments.map((a) => a.name),
    );
    if (files.length === 0 || sending || uploadingAttachment || !status?.enabled) return;
    const sid = await ensureSessionIdForUpload();
    if (!sid) return;
    setUploadingAttachment(true);
    setStreamError(null);
    try {
      for (const file of files) {
        const uploaded = await uploadAgentAttachmentApi(sid, file);
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        if (previewUrl) previewUrlsRef.current.push(previewUrl);
        setPendingAttachments((prev) => [...prev, { ...uploaded, previewUrl }]);
      }
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function onPickAttachment(fileList: FileList | null) {
    void uploadFiles(fileList ? Array.from(fileList) : []);
  }

  function onComposerPaste(e: ReactClipboardEvent) {
    const files = filesFromDataTransfer(e.clipboardData);
    if (files.length === 0) return;
    e.preventDefault();
    void uploadFiles(files);
  }

  function onComposerDragOver(e: ReactDragEvent) {
    if (!dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setComposerDragOver(true);
  }

  function onComposerDragLeave(e: ReactDragEvent) {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    setComposerDragOver(false);
  }

  function onComposerDrop(e: ReactDragEvent) {
    e.preventDefault();
    setComposerDragOver(false);
    void uploadFiles(filesFromDataTransfer(e.dataTransfer));
  }

  async function sendMessage(raw: string) {
    const text = raw.trim();
    const assetIds = pendingAttachments.map((a) => a.id);
    if ((!text && assetIds.length === 0) || sending || contextCompacting) return;
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

    const assetsForBubble = pendingAttachments.map((a) => ({
      id: a.id,
      name: a.name,
      mime: a.mime,
      bytes: a.bytes,
      previewUrl: a.previewUrl,
    }));
    const userMsg: ChatMessage = {
      id: nextId("u"),
      role: "user",
      content: text || (assetsForBubble[0] ? `(附件 ${assetsForBubble.map((a) => a.name).join(", ")})` : ""),
      skillNames: selectedSkillNames.length > 0 ? [...selectedSkillNames] : undefined,
      assets: assetsForBubble.length > 0 ? assetsForBubble : undefined,
    };
    const assistantId = nextId("a");
    streamAssistantIdRef.current = assistantId;
    stickToBottomRef.current = true;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setPendingAttachments([]);
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
        assetIds: assetIds.length > 0 ? assetIds : undefined,
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
          if (applyStreamEvent(assistantId, event)) hadError = true;
        },
      });
      if (!ac.signal.aborted && !hadError) {
        setSelectedSkillNames([]);
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      setContextCompacting(false);
      const code =
        err instanceof Error ? (err as Error & { code?: string }).code : undefined;
      setStreamError(
        code === "SESSION_COMPACTING"
          ? "正在压缩上下文，请稍后再试"
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.blocks
            ? { ...m, blocks: sealThinking(m.blocks) }
            : m,
        ),
      );
      if (abortRef.current === ac) abortRef.current = null;
      // done / 失败会清 activeRunId；仅断订阅时保留，重开后 resume
      if (!activeRunIdRef.current) setSending(false);
    }
  }

  async function onNewSession() {
    abortRef.current?.abort();
    const runId = activeRunIdRef.current;
    activeRunIdRef.current = null;
    setSending(false);
    if (runId) void cancelAgentRunApi(runId).catch(() => undefined);
    setStreamError(null);
    setHistoryOpen(false);
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
    if (id === sessionId) {
      setHistoryOpen(false);
      return;
    }
    abortRef.current?.abort();
    const runId = activeRunIdRef.current;
    activeRunIdRef.current = null;
    setSending(false);
    if (runId) void cancelAgentRunApi(runId).catch(() => undefined);
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
  openAgentDocumentRef.current = openDocumentFromTable;

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
      style={
        embedded || fullscreen
          ? undefined
          : {
              ...anchorStyle,
              width: panelWidth,
              ...(panelLeft != null ? { left: panelLeft } : {}),
            }
      }
    >
      {fullscreen || (embedded && !docked) ? null : docked ? (
        <div
          className="mdocs-agent-panel-resize mdocs-agent-panel-resize-right"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整贴左栏宽度"
          aria-valuenow={dockWidth ?? 360}
          aria-valuemin={280}
          aria-valuemax={560}
          onPointerDown={(e) => onResizePointerDown("right", e)}
        />
      ) : (
        <>
          <div
            className="mdocs-agent-panel-resize mdocs-agent-panel-resize-left"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整面板宽度"
            aria-valuenow={panelWidth}
            aria-valuemin={400}
            aria-valuemax={960}
            onPointerDown={(e) => onResizePointerDown("left", e)}
          />
          <div
            className="mdocs-agent-panel-resize mdocs-agent-panel-resize-right"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整面板宽度"
            aria-valuenow={panelWidth}
            aria-valuemin={400}
            aria-valuemax={960}
            onPointerDown={(e) => onResizePointerDown("right", e)}
          />
        </>
      )}
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
          {showDockToggle ? (
            <button
              type="button"
              className={"mdocs-agent-panel-icon-btn" + (docked ? " active" : "")}
              title={docked ? "浮窗（恢复目录）" : "贴左（替换目录）"}
              aria-label={docked ? "浮窗（恢复目录）" : "贴左（替换目录）"}
              onClick={onToggleDock}
            >
              {docked ? (
                <PanelLeftClose size={16} strokeWidth={1.8} />
              ) : (
                <PanelLeft size={16} strokeWidth={1.8} />
              )}
            </button>
          ) : null}
          {onToggleFullscreen && !docked && !embedded ? (
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
          ) : null}
          {showClose ? (
            <button
              type="button"
              className="mdocs-agent-panel-icon-btn"
              title="关闭"
              aria-label="关闭"
              onClick={requestClose}
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          ) : null}
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
        <div
          className="mdocs-agent-panel-body"
          onPaste={onComposerPaste}
          onDragOver={onComposerDragOver}
          onDragLeave={onComposerDragLeave}
          onDrop={onComposerDrop}
        >
          <div className="mdocs-agent-panel-scroll-wrap">
            {contextCompacting ? (
              <div className="mdocs-agent-panel-compacting" role="status" aria-live="polite">
                正在压缩上下文…
              </div>
            ) : null}
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
                    <div className="mdocs-agent-panel-msg-main">
                    <div className="mdocs-agent-panel-msg-bubble">
                      {m.role === "user" && m.skillNames && m.skillNames.length > 0 ? (
                        <div className="mdocs-agent-msg-skills">Skill ×{m.skillNames.length}</div>
                      ) : null}
                      {m.role === "user" && m.assets && m.assets.length > 0 ? (
                        <div className="mdocs-agent-msg-assets">
                          {m.assets.map((a) => (
                            <AgentAssetChip
                              key={a.id}
                              id={a.id}
                              name={a.name}
                              mime={a.mime}
                              previewUrl={a.previewUrl}
                            />
                          ))}
                        </div>
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
                                const live =
                                  block.status === "preparing" ||
                                  block.status === "running";
                                const statusLabel =
                                  block.status === "preparing"
                                    ? "准备中"
                                    : block.status === "running"
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
                                      <span
                                        className={
                                          "mdocs-agent-tool-call-label" +
                                          (live ? " live" : "")
                                        }
                                      >
                                        {block.label}
                                      </span>
                                      <span className="mdocs-agent-tool-call-badge">
                                        {statusLabel}
                                      </span>
                                    </div>
                                    {block.detail || block.status === "error" ? (
                                      <ToolCallDetailScroll
                                        detail={
                                          block.detail ||
                                          (block.status === "error"
                                            ? "工具执行失败（无详细信息）"
                                            : "")
                                        }
                                        followTail={
                                          block.status === "preparing" ||
                                          block.status === "running"
                                        }
                                        grow={
                                          (block.status === "preparing" ||
                                            block.status === "running") &&
                                          (block.toolName ===
                                            "set_markdown_document" ||
                                            block.toolName ===
                                              "overwrite_document" ||
                                            block.toolName === "web_fetch")
                                        }
                                        error={block.status === "error"}
                                      />
                                    ) : null}
                                    {block.webResults &&
                                    block.webResults.items.length > 0 ? (
                                      <WebSearchResultsFold
                                        query={block.webResults.query}
                                        items={block.webResults.items}
                                      />
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
                                // 打开中的卡吸底展示，时间线只留提示，避免长 thinking 把卡顶没
                                if (block.status === "open") {
                                  return (
                                    <div
                                      key={`${m.id}-ch-${bi}`}
                                      className="mdocs-agent-panel-block mdocs-agent-choice-docked-hint"
                                    >
                                      <p>等待你选择（已置顶到输入框上方）</p>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={`${m.id}-ch-${bi}`} className="mdocs-agent-panel-block">
                                    <ChoiceCardBlock
                                      block={block}
                                      onResolved={(requestId, choice, status) => {
                                        resolveChoiceCard(m.id, requestId, choice, status);
                                      }}
                                    />
                                  </div>
                                );
                              }
                              if (block.type === "skill_form_card") {
                                if (block.status === "open") {
                                  return (
                                    <div
                                      key={`${m.id}-sf-${bi}`}
                                      className="mdocs-agent-panel-block mdocs-agent-choice-docked-hint"
                                    >
                                      <p>等待你填写（已置顶到输入框上方）</p>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={`${m.id}-sf-${bi}`} className="mdocs-agent-panel-block">
                                    <SkillFormCardBlock
                                      block={block}
                                      onResolved={(requestId, status, submittedName) => {
                                        resolveSkillFormCard(
                                          m.id,
                                          requestId,
                                          status,
                                          submittedName,
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
                      ) : isContextCompactSummary(m.content) ? (
                        <details className="mdocs-agent-panel-compact-summary">
                          <summary>上下文已压缩</summary>
                          <pre className="mdocs-agent-panel-compact-summary-body">
                            {m.content.slice(CONTEXT_COMPACT_PREFIX.length).trim()}
                          </pre>
                        </details>
                      ) : (
                        m.content
                      )}
                    </div>
                    <MessageCopyButton text={messageCopyText(m)} />
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
          {openInteractions.length > 0 ? (
            <div className="mdocs-agent-interaction-dock" aria-live="polite">
              {openInteractions.map((item) =>
                item.kind === "choice" ? (
                  <ChoiceCardBlock
                    key={`dock-ch-${item.block.requestId}`}
                    block={item.block}
                    onResolved={(requestId, choice, status) => {
                      resolveChoiceCard(item.messageId, requestId, choice, status);
                    }}
                  />
                ) : (
                  <SkillFormCardBlock
                    key={`dock-sf-${item.block.requestId}`}
                    block={item.block}
                    onResolved={(requestId, status, submittedName) => {
                      resolveSkillFormCard(
                        item.messageId,
                        requestId,
                        status,
                        submittedName,
                      );
                    }}
                  />
                ),
              )}
            </div>
          ) : null}
          {streamError ? (
            <p className="mdocs-agent-panel-status-warn">{streamError}</p>
          ) : null}
          {needsApiKey && messages.length > 0 ? (
            <AgentApiKeyInlineSetup onConfigured={refreshAgentStatus} />
          ) : null}
          <div className="mdocs-agent-composer-tools">
            <AgentSkillRefPicker
              selectedNames={selectedSkillNames}
              onChange={setSelectedSkillNames}
              disabled={sending || contextCompacting || !status?.enabled}
            />
            <button
              type="button"
              className="mdocs-agent-skill-ref-toggle"
              disabled={sending || contextCompacting || !status?.enabled}
              title="把更早的对话压成摘要，腾出上下文空间"
              onClick={() => void onCompactContext()}
            >
              {contextCompacting ? "压缩中…" : "压缩上下文"}
            </button>
          </div>
          <div
            className={
              "mdocs-agent-panel-input-wrap" + (composerDragOver ? " is-dragover" : "")
            }
          >
            {composerDragOver ? (
              <div className="mdocs-agent-composer-drop">松开以添加</div>
            ) : null}
            {pageRefs.length > 0 || pendingAttachments.length > 0 ? (
              <div className="mdocs-agent-composer-refs">
                {pageRefs.length > 1 ? (
                  <button
                    type="button"
                    className="mdocs-agent-page-refs-summary"
                    aria-expanded={pageRefsExpanded}
                    onClick={() => setPageRefsExpanded((open) => !open)}
                  >
                    <Link2 size={14} strokeWidth={2} aria-hidden />
                    <span>已引用 {pageRefs.length} 篇文章</span>
                    {pageRefsExpanded ? (
                      <ChevronDown size={14} strokeWidth={2} aria-hidden />
                    ) : (
                      <ChevronRight size={14} strokeWidth={2} aria-hidden />
                    )}
                  </button>
                ) : null}
                {pageRefs.length < 2 || pageRefsExpanded
                  ? pageRefs.map((item) => (
                      <PageRefChip
                        key={item.key}
                        item={item}
                        disabled={sending}
                        onDismiss={() => setDocRefDismissed(true)}
                      />
                    ))
                  : null}
                {pendingAttachments.length > 0 ? (
                  <div className="mdocs-agent-composer-files">
                    {pendingAttachments.map((a) => (
                      <AgentAssetChip
                        key={a.id}
                        id={a.id}
                        name={a.name}
                        mime={a.mime}
                        previewUrl={a.previewUrl}
                        removeDisabled={sending}
                        onRemove={() => {
                          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
                          setPendingAttachments((prev) => prev.filter((x) => x.id !== a.id));
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mdocs-agent-panel-input-body">
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.json,.pdf"
                hidden
                onChange={(e) => void onPickAttachment(e.target.files)}
              />
              <button
                type="button"
                className="mdocs-agent-panel-attach"
                disabled={sending || contextCompacting || uploadingAttachment || !status?.enabled}
                title="上传附件，也可粘贴或拖入"
                aria-label="上传附件"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={18} strokeWidth={2} aria-hidden />
              </button>
              <textarea
                ref={inputRef}
                className="mdocs-agent-panel-input"
                rows={1}
                placeholder={
                  status?.enabled
                    ? coding
                      ? "说说要写什么…"
                      : "告诉 Agent 你想做什么…"
                    : "请先配置 API Key"
                }
                value={input}
                disabled={sending || contextCompacting || !status?.enabled}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
              />
              <div className="mdocs-agent-panel-input-actions">
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
                      : contextCompacting ||
                        !status?.enabled ||
                        (!input.trim() && pendingAttachments.length === 0)
                  }
                  onClick={() => {
                    if (sending) {
                      const runId = activeRunIdRef.current;
                      abortRef.current?.abort();
                      activeRunIdRef.current = null;
                      setSending(false);
                      if (runId) void cancelAgentRunApi(runId).catch(() => undefined);
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
