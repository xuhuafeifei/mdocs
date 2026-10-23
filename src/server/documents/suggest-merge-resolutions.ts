/**
 * AI 行级 merge：完整 git 冲突 Markdown 进 → 定稿 Markdown 出。
 *
 * 实现策略（避免「模型未返回合并正文」）：
 * 1. 解析冲突块；一侧空白则自动取另一侧（无需 LLM）
 * 2. 其余冲突只把冲突块送给模型，要 JSON 字符串数组（短输出）
 * 3. 与无冲突原文拼回完整正文
 */
import { getDb } from "../db/connection.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { DocumentError } from "../access/access-control.js";
import { getVisitorAgentConfig } from "../agent/Config/config.js";
import { canAiMerge } from "../../shared/file-type-policy.js";
import type { AssistantMessage, Context, TextContent } from "@earendil-works/pi-ai";

const MARKED_MAX = 48_000;
const PER_CONFLICT_MAX = 6_000;

type MdPart =
  | { kind: "text"; text: string }
  | { kind: "conflict"; local: string; remote: string; base: string };

const SYSTEM = `你是文档合并助手。用户会给出若干编号的 git 冲突块（<<<<<<< local / ======= / >>>>>>> remote）。
对每个冲突选出应保留的正文（可拼接两侧），按编号顺序返回。
只输出 JSON 字符串数组，不要其它文字、不要代码围栏。
例：["第一段合并结果","第二段合并结果"]
数组长度必须等于冲突个数。`;

function extractAssistantText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as TextContent & { type?: string; text?: string };
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  return parts.join("\n").trim();
}

function hasThinkingOnly(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  let thinking = false;
  let text = false;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const t = (block as { type?: string }).type;
    if (t === "thinking") thinking = true;
    if (t === "text" && typeof (block as TextContent).text === "string" && (block as TextContent).text.trim()) {
      text = true;
    }
  }
  return thinking && !text;
}

function parseConflictMarkdown(md: string): MdPart[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const parts: MdPart[] = [];
  let textBuf: string[] = [];
  let mode: "text" | "local" | "base" | "remote" = "text";
  let local: string[] = [];
  let base: string[] = [];
  let remote: string[] = [];

  const flushText = (): void => {
    if (textBuf.length === 0) return;
    parts.push({ kind: "text", text: textBuf.join("\n") });
    textBuf = [];
  };

  const flushConflict = (): void => {
    parts.push({
      kind: "conflict",
      local: local.join("\n"),
      remote: remote.join("\n"),
      base: base.join("\n"),
    });
    local = [];
    base = [];
    remote = [];
    mode = "text";
  };

  for (const line of lines) {
    if (mode === "text" && /^<<<<<<< /.test(line)) {
      flushText();
      mode = "local";
      local = [];
      base = [];
      remote = [];
      continue;
    }
    if (mode !== "text" && /^\|{7}/.test(line)) {
      mode = "base";
      continue;
    }
    if (mode !== "text" && line === "=======") {
      mode = "remote";
      continue;
    }
    if (mode !== "text" && /^>>>>>>> /.test(line)) {
      flushConflict();
      continue;
    }
    if (mode === "local") local.push(line);
    else if (mode === "base") base.push(line);
    else if (mode === "remote") remote.push(line);
    else textBuf.push(line);
  }
  if (mode !== "text") flushConflict();
  flushText();
  return parts;
}

function isBlank(s: string): boolean {
  return s.trim().length === 0;
}

function tryAutoResolve(c: Extract<MdPart, { kind: "conflict" }>): string | null {
  if (isBlank(c.local) && !isBlank(c.remote)) return c.remote;
  if (isBlank(c.remote) && !isBlank(c.local)) return c.local;
  if (c.local === c.remote) return c.local;
  return null;
}

function parseJsonStringArray(text: string, expected: number): string[] | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fence?.[1] ?? trimmed).trim();
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start < 0 || end < start) return null;
  try {
    const raw = JSON.parse(body.slice(start, end + 1));
    if (!Array.isArray(raw) || raw.length !== expected) return null;
    if (!raw.every((x) => typeof x === "string")) return null;
    return raw as string[];
  } catch {
    return null;
  }
}

function formatConflictForLlm(index: number, c: Extract<MdPart, { kind: "conflict" }>): string {
  let local = c.local;
  let remote = c.remote;
  let base = c.base;
  if (local.length > PER_CONFLICT_MAX) local = `${local.slice(0, PER_CONFLICT_MAX)}\n…`;
  if (remote.length > PER_CONFLICT_MAX) remote = `${remote.slice(0, PER_CONFLICT_MAX)}\n…`;
  if (base.length > PER_CONFLICT_MAX) base = `${base.slice(0, PER_CONFLICT_MAX)}\n…`;
  const hasBase = !isBlank(base) && base !== local && base !== remote;
  const block = hasBase
    ? ["<<<<<<< local", local, "||||||| base", base, "=======", remote, ">>>>>>> remote"].join("\n")
    : ["<<<<<<< local", local, "=======", remote, ">>>>>>> remote"].join("\n");
  return `### 冲突 ${index + 1}\n${block}`;
}

export async function suggestMergeResolutions(params: {
  actorVisitorId: string;
  documentId: string;
  conflictMarkdown: string;
}): Promise<{ mergedMarkdown: string }> {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  if (!canAiMerge(row.file_type)) {
    throw new DocumentError("BAD_REQUEST", "该文件类型不支持 AI 行级合并", 400);
  }

  const cfg = getVisitorAgentConfig(params.actorVisitorId);
  if (!cfg?.apiKey) {
    throw new DocumentError("BAD_REQUEST", "未配置默认模型或 API Key，无法 AI 合并", 400);
  }

  let marked = params.conflictMarkdown.replace(/\r\n/g, "\n");
  if (!marked.trim()) {
    throw new DocumentError("BAD_REQUEST", "conflictMarkdown 不能为空", 400);
  }
  if (marked.length > MARKED_MAX) {
    marked = `${marked.slice(0, MARKED_MAX)}\n…`;
  }

  const parts = parseConflictMarkdown(marked);
  const conflictIndices: number[] = [];
  const resolvedByIndex = new Map<number, string>();

  parts.forEach((p, i) => {
    if (p.kind !== "conflict") return;
    conflictIndices.push(i);
    const auto = tryAutoResolve(p);
    if (auto != null) resolvedByIndex.set(i, auto);
  });

  const needLlm = conflictIndices.filter((i) => !resolvedByIndex.has(i));
  if (needLlm.length > 0) {
    const payload = needLlm
      .map((partIndex, n) => {
        const c = parts[partIndex] as Extract<MdPart, { kind: "conflict" }>;
        return formatConflictForLlm(n, c);
      })
      .join("\n\n");

    const { createAgentModel } = await import("../agent/Agent/run.js");
    const { models, model } = createAgentModel(cfg);
    const context: Context = {
      systemPrompt: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `文档「${row.display_name}」共 ${needLlm.length} 个待决冲突。` +
            `请按顺序返回长度为 ${needLlm.length} 的 JSON 字符串数组：\n\n${payload}`,
          timestamp: Date.now(),
        },
      ],
    };

    let result: AssistantMessage;
    try {
      result = await models.completeSimple(model, context, {
        maxTokens: 4096,
        temperature: 0.2,
        // 合并不需要长思考；否则易把输出额度耗在 thinking 上导致正文为空
        reasoning: "minimal",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new DocumentError("INTERNAL", `AI 合并失败：${msg}`, 502);
    }

    const text = extractAssistantText(result.content);
    if (!text) {
      const why = hasThinkingOnly(result.content)
        ? "模型只返回了思考过程、没有正文（可关掉思考档后重试）"
        : result.stopReason === "length"
          ? "模型输出被截断且无正文"
          : result.errorMessage
            ? `模型错误：${result.errorMessage}`
            : "模型未返回合并正文";
      throw new DocumentError("INTERNAL", why, 502);
    }

    const chosen = parseJsonStringArray(text, needLlm.length);
    if (!chosen) {
      throw new DocumentError(
        "INTERNAL",
        `模型返回无法解析为 ${needLlm.length} 段 JSON 数组，请重试`,
        502,
      );
    }
    needLlm.forEach((partIndex, n) => {
      resolvedByIndex.set(partIndex, chosen[n]!);
    });
  }

  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (p.kind === "text") {
      if (p.text.length > 0) out.push(p.text);
      continue;
    }
    out.push(resolvedByIndex.get(i) ?? p.remote);
  }
  return { mergedMarkdown: out.join("\n") };
}

/** 测试用 */
export const __test = { parseConflictMarkdown, tryAutoResolve, parseJsonStringArray };
