/**
 * 上下文诊断：与圆环同源（system + tools + history），并带上可展开正文。
 */
import { getVisitorAgentConfig, DEFAULT_AGENT_CONTEXT_WINDOW } from "../Config/config";
import { getSkillLoader } from "../Skill/skill-loader";
import { createToolsForMode } from "./tools-registry";
import { assembleSystemPrompt } from "./system-prompt";
import { estimateTokens, summarizePrompt } from "./prompt-stats";
import { loadSoulPromptSection } from "../../soul/load-for-agent";
import { buildSkillMetaSection } from "./skill-meta-prompt";
import { buildMemeCatalogSection } from "../../memes/prompt";
import {
  AgentSessionManager,
  type AgentSessionMessage,
  type AgentSessionKind,
} from "./session-manager";
import type { AgentMode } from "./system-prompt";

export type ContextBucketId = "system" | "tools" | "history";

export type ContextInspectorItem = {
  id: string;
  bucket: ContextBucketId;
  label: string;
  role?: string;
  chars: number;
  tokens: number;
  windowPercent: number;
  content: string;
};

export type ContextBucketStat = {
  id: ContextBucketId;
  label: string;
  chars: number;
  tokens: number;
  /** 占窗口 */
  windowPercent: number;
  /** 占「已用」三桶之和（对齐圆环构成） */
  shareOfUsedPercent: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return round2((part / whole) * 100);
}

function messageContent(m: AgentSessionMessage): string {
  if (m.role === "tool") {
    const args = (() => {
      try {
        return JSON.stringify(m.arguments ?? {}, null, 2);
      } catch {
        return String(m.arguments ?? "");
      }
    })();
    return [
      `tool: ${m.toolName}`,
      `callId: ${m.toolCallId}`,
      m.isError ? "isError: true" : null,
      "--- arguments ---",
      args,
      "--- result ---",
      m.resultText ?? "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return m.content ?? "";
}

function messageLabel(m: AgentSessionMessage, index: number): string {
  if (m.role === "tool") return `#${index + 1} tool · ${m.toolName}`;
  if (m.role === "user") return `#${index + 1} user`;
  return `#${index + 1} assistant`;
}

function listToolItems(visitorId: string, window: number): ContextInspectorItem[] {
  const skills = getSkillLoader();
  const cfg = getVisitorAgentConfig(visitorId);
  // 诊断只统计 Ask 工具集；coding 需要 coding ctx，缺依赖会抛错
  const tools = createToolsForMode("normal", {
    visitorId,
    onEvent: () => {},
    skills: skills.isReady() ? skills : null,
    ...(cfg?.kind === "deepseek" && cfg.apiKey
      ? { deepseekWeb: { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl || undefined } }
      : {}),
  });
  return tools.map((t, i) => {
    let params = "";
    try {
      params = JSON.stringify(t.parameters ?? {}, null, 2);
    } catch {
      params = String(t.parameters ?? "");
    }
    const content = [
      `name: ${t.name}`,
      `description: ${t.description ?? ""}`,
      "--- parameters ---",
      params,
    ].join("\n");
    const tokens = estimateTokens(content);
    return {
      id: `tool:${t.name}:${i}`,
      bucket: "tools" as const,
      label: t.name,
      chars: content.length,
      tokens,
      windowPercent: pct(tokens, window),
      content,
    };
  });
}

export async function buildContextInspector(opts: {
  visitorId: string;
  mode: AgentMode;
  sessionId?: string | null;
  domainId?: string | null;
  documentId?: string | null;
}): Promise<{
  mode: AgentMode;
  sessionId: string | null;
  window: number;
  used: number;
  limit: number;
  buckets: ContextBucketStat[];
  items: ContextInspectorItem[];
  sections: ReturnType<typeof summarizePrompt>["sections"];
  total: ReturnType<typeof summarizePrompt>["total"];
  prompt: string;
  notes: string[];
}> {
  const mode = opts.mode === "coding" ? "coding" : "normal";
  const kind: AgentSessionKind = mode === "coding" ? "coding" : "normal";
  const window =
    getVisitorAgentConfig(opts.visitorId)?.contextWindow ?? DEFAULT_AGENT_CONTEXT_WINDOW;

  const refs =
    mode === "normal" && (opts.domainId || opts.documentId)
      ? {
          ...(opts.domainId ? { domainId: opts.domainId } : {}),
          ...(opts.documentId ? { documentId: opts.documentId } : {}),
        }
      : null;

  const cfg = getVisitorAgentConfig(opts.visitorId);
  const assembled = assembleSystemPrompt(mode, refs, {
    hasMcpTools: false,
    hasWebTools: cfg?.kind === "deepseek" && Boolean(cfg.apiKey),
    soulSection: loadSoulPromptSection(opts.visitorId),
    skillMetaSection: buildSkillMetaSection(opts.visitorId),
    memeCatalogSection: buildMemeCatalogSection(opts.visitorId),
  });
  const promptStats = summarizePrompt(assembled, window);

  const systemItems: ContextInspectorItem[] = assembled.sections.map((section, i) => {
    const tokens = estimateTokens(section.text);
    return {
      id: `system:${section.id}:${i}`,
      bucket: "system" as const,
      label: section.label,
      chars: section.text.length,
      tokens,
      windowPercent: pct(tokens, window),
      content: section.text,
    };
  });

  const toolItems = listToolItems(opts.visitorId, window);

  const mgr = new AgentSessionManager(opts.visitorId, { kind });
  let sessionId: string | null = opts.sessionId?.trim() || null;
  let messages: AgentSessionMessage[] = [];
  try {
    if (sessionId) {
      messages = await mgr.loadMessages(sessionId);
    } else {
      const opened = await mgr.loadLastOpenedMessages(
        kind === "coding" ? opts.documentId : undefined,
      );
      sessionId = opened.sessionId;
      messages = opened.messages;
    }
  } catch {
    sessionId = sessionId ?? null;
    messages = [];
  }

  const historyItems: ContextInspectorItem[] = messages.map((m, i) => {
    const content = messageContent(m);
    const tokens = estimateTokens(content);
    return {
      id: `history:${i}:${m.role}`,
      bucket: "history" as const,
      label: messageLabel(m, i),
      role: m.role,
      chars: content.length,
      tokens,
      windowPercent: pct(tokens, window),
      content,
    };
  });

  const systemTokens = systemItems.reduce((s, x) => s + x.tokens, 0);
  const toolsTokens = toolItems.reduce((s, x) => s + x.tokens, 0);
  const historyTokens = historyItems.reduce((s, x) => s + x.tokens, 0);
  const systemChars = systemItems.reduce((s, x) => s + x.chars, 0);
  const toolsChars = toolItems.reduce((s, x) => s + x.chars, 0);
  const historyChars = historyItems.reduce((s, x) => s + x.chars, 0);
  const used = Math.min(window, systemTokens + toolsTokens + historyTokens);
  const usedDenom = Math.max(used, 1);

  const buckets: ContextBucketStat[] = [
    {
      id: "system",
      label: "系统提示词",
      chars: systemChars,
      tokens: systemTokens,
      windowPercent: pct(systemTokens, window),
      shareOfUsedPercent: pct(systemTokens, usedDenom),
    },
    {
      id: "tools",
      label: "工具定义",
      chars: toolsChars,
      tokens: toolsTokens,
      windowPercent: pct(toolsTokens, window),
      shareOfUsedPercent: pct(toolsTokens, usedDenom),
    },
    {
      id: "history",
      label: "会话历史",
      chars: historyChars,
      tokens: historyTokens,
      windowPercent: pct(historyTokens, window),
      shareOfUsedPercent: pct(historyTokens, usedDenom),
    },
  ];

  return {
    mode,
    sessionId,
    window,
    used,
    limit: window,
    buckets,
    items: [...systemItems, ...toolItems, ...historyItems],
    sections: promptStats.sections,
    total: promptStats.total,
    prompt: assembled.prompt,
    notes: [
      "三桶与圆环同源：系统提示词 + 工具定义 + 当前会话历史",
      "预览不含本轮 MCP 工具提示与多模态附件二进制",
      sessionId ? `会话 ${sessionId}` : "无会话",
    ],
  };
}
