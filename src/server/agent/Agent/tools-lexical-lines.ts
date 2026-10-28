/**
 * 智能助手：按外层块读/写 md_format_lexical 提案（不写盘）。
 */
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { assertDocumentAccess, DocumentError } from "../../access/access-control.js";
import { getDocument } from "../../documents/document.service.js";
import { lexicalJsonToLexicalLines } from "../../documents/lexical-to-markdown.js";
import {
  validateBatchSlotRanges,
  type BatchSlotRange,
} from "../../../shared/batchSlotRanges.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";

const MAX_CHARS = 50_000;

export function getDocumentLexicalLinesTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "get_document_lexical_lines",
    label: "按块读取文档",
    description:
      "按 documentId 读取 .md 文档，将 Lexical 最外层块编成 1-based 门牌表（md_format_lexical）。" +
      "每条 value 是该块的 Markdown。改若干段时先调本工具，再用 set_document_lexical_lines 回传修改过的门牌。" +
      "与 get_document 同一读权限；不返回未应用的前端提案。",
    parameters: Type.Object({
      documentId: Type.String({ description: "文档 documentId" }),
    }),
    execute: async (_id, params) => {
      const documentId = String((params as { documentId?: string }).documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
      try {
        assertDocumentAccess(documentId, visitorId, "read");
        const doc = getDocument(documentId, visitorId, "json");
        if (doc.fileType && doc.fileType !== "md") {
          throw new Error(`unsupported fileType: ${doc.fileType} (only md)`);
        }
        const raw = doc.content ?? "";
        const lines = lexicalJsonToLexicalLines(raw);
        if (!lines) {
          throw new Error("document content is not Lexical JSON");
        }
        const serialized = JSON.stringify(lines);
        const truncated = serialized.length > MAX_CHARS;
        return asToolResult({
          documentId: doc.documentId,
          displayName: doc.displayName,
          format: "md_format_lexical",
          lineCount: Object.keys(lines).length,
          truncated,
          lines: truncated
            ? Object.fromEntries(
                Object.entries(lines).map(([k, v]) => [
                  k,
                  v.length > 4000 ? `${v.slice(0, 4000)}\n…(truncated)\n` : v,
                ]),
              )
            : lines,
        });
      } catch (err) {
        if (err instanceof DocumentError) {
          throw new Error(`${err.code}: ${err.message}`);
        }
        throw err;
      }
    },
  };
}

/** 只校验参数并回传；真正推前端靠 tool-ui-effects → SSE */
export function setDocumentLexicalLinesTool({ uiDocumentId }: ToolDeps): AgentTool {
  return {
    name: "set_document_lexical_lines",
    label: "按块设置提案",
    description:
      "向**当前打开**文档提交按块 Markdown 提案（md_format_lexical），**不写服务器**。" +
      "documentId 可省略（默认用 UI 当前打开文）。" +
      "mode=patch_lines：lines 只含要改的门牌；mode=replace_all：整篇新稿。" +
      "单槽改优先 update_slot / insert_after_slot / remove_slot；多段连续区间用 batch_update_slots；整篇也可用 overwrite_all。",
    parameters: Type.Object({
      documentId: Type.Optional(
        Type.String({ description: "可省略；默认当前 UI 打开文档" }),
      ),
      mode: Type.Union([Type.Literal("patch_lines"), Type.Literal("replace_all")], {
        description: "patch_lines=按门牌补丁；replace_all=整篇新稿",
      }),
      lines: Type.Optional(
        Type.Record(Type.String(), Type.String(), {
          description: "门牌→Markdown；patch 时只传改动的 key；replace_all 时可传全表",
        }),
      ),
      markdown: Type.Optional(
        Type.String({
          description: "replace_all 时可用完整 Markdown 代替 lines",
        }),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        mode?: "patch_lines" | "replace_all";
        lines?: Record<string, string>;
        markdown?: string;
      };
      const documentId = resolveDiffDocumentId(p.documentId, uiDocumentId);
      const mode = p.mode === "replace_all" ? "replace_all" : "patch_lines";
      const lines =
        p.lines && typeof p.lines === "object" && !Array.isArray(p.lines)
          ? (p.lines as Record<string, string>)
          : {};
      const markdown = typeof p.markdown === "string" ? p.markdown : undefined;
      if (mode === "patch_lines" && Object.keys(lines).length === 0) {
        throw new Error("patch_lines requires non-empty lines");
      }
      if (mode === "replace_all" && Object.keys(lines).length === 0 && !markdown) {
        throw new Error("replace_all requires lines or markdown");
      }
      return asToolResult({
        documentId,
        mode,
        lines,
        ...(markdown != null ? { markdown } : {}),
        queued: true,
      });
    },
  };
}

/** Diff 只能打当前打开文：优先 UI 上下文，其次模型传入 */
function resolveDiffDocumentId(
  raw: unknown,
  uiDocumentId: string | null | undefined,
): string {
  const fromUi = String(uiDocumentId ?? "").trim();
  const fromArg = String(raw ?? "").trim();
  const documentId = fromUi || fromArg;
  if (!documentId) {
    throw new Error("documentId is required (open a document in the UI, or pass documentId)");
  }
  return documentId;
}

function requireSlot(raw: unknown, { allowZero = false } = {}): number {
  const slot = Number(raw);
  if (!Number.isInteger(slot)) throw new Error("slot must be an integer");
  if (allowZero ? slot < 0 : slot < 1) {
    throw new Error(allowZero ? "slot must be >= 0 (0 = insert at start)" : "slot must be >= 1");
  }
  return slot;
}

function requireMarkdown(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("markdown is required");
  return raw;
}

/** 单槽改：SSE → 前端 Lobe updateSlot */
export function updateSlotTool({ uiDocumentId }: ToolDeps): AgentTool {
  return {
    name: "update_slot",
    label: "更新文档块",
    description:
      "对**当前打开** .md 的某一外层块（1-based slot）提交替换提案，**不写服务器**。" +
      "documentId 可省略（默认 UI 当前打开文）。markdown 须为单顶层块。" +
      "改前先 get_document_lexical_lines 看门牌。",
    parameters: Type.Object({
      documentId: Type.Optional(
        Type.String({ description: "可省略；默认当前 UI 打开文档" }),
      ),
      slot: Type.Integer({ description: "1-based 外层块门牌", minimum: 1 }),
      markdown: Type.String({ description: "替换该槽的 Markdown（单顶层块）" }),
    }),
    execute: async (_id, params) => {
      const p = params as { documentId?: string; slot?: number; markdown?: string };
      return asToolResult({
        documentId: resolveDiffDocumentId(p.documentId, uiDocumentId),
        op: "update_slot" as const,
        slot: requireSlot(p.slot),
        markdown: requireMarkdown(p.markdown),
        queued: true,
      });
    },
  };
}

/** 单槽后插入：SSE → 前端 Lobe insertAfterSlot */
export function insertAfterSlotTool({ uiDocumentId }: ToolDeps): AgentTool {
  return {
    name: "insert_after_slot",
    label: "在块后插入",
    description:
      "在**当前打开**文档指定外层块之后插入 Markdown 提案，**不写服务器**。" +
      "documentId 可省略。slot=0 插文首；slot≥1 插在该门牌之后。",
    parameters: Type.Object({
      documentId: Type.Optional(
        Type.String({ description: "可省略；默认当前 UI 打开文档" }),
      ),
      slot: Type.Integer({
        description: "锚点门牌：0=文首；≥1=插在该块之后",
        minimum: 0,
      }),
      markdown: Type.String({ description: "要插入的 Markdown（可含多个顶层块）" }),
    }),
    execute: async (_id, params) => {
      const p = params as { documentId?: string; slot?: number; markdown?: string };
      return asToolResult({
        documentId: resolveDiffDocumentId(p.documentId, uiDocumentId),
        op: "insert_after_slot" as const,
        slot: requireSlot(p.slot, { allowZero: true }),
        markdown: requireMarkdown(p.markdown),
        queued: true,
      });
    },
  };
}

/** 单槽删：SSE → 前端 Lobe removeSlot */
export function removeSlotTool({ uiDocumentId }: ToolDeps): AgentTool {
  return {
    name: "remove_slot",
    label: "删除文档块",
    description:
      "对**当前打开** .md 某一外层块提交删除提案，**不写服务器**。" +
      "documentId 可省略。改前先 get_document_lexical_lines。",
    parameters: Type.Object({
      documentId: Type.Optional(
        Type.String({ description: "可省略；默认当前 UI 打开文档" }),
      ),
      slot: Type.Integer({ description: "1-based 外层块门牌", minimum: 1 }),
    }),
    execute: async (_id, params) => {
      const p = params as { documentId?: string; slot?: number };
      return asToolResult({
        documentId: resolveDiffDocumentId(p.documentId, uiDocumentId),
        op: "remove_slot" as const,
        slot: requireSlot(p.slot),
        queued: true,
      });
    },
  };
}

/** 整篇 LCS Diff：SSE → 前端 Lobe overwriteAll */
export function overwriteAllTool({ uiDocumentId }: ToolDeps): AgentTool {
  return {
    name: "overwrite_all",
    label: "整篇 Diff 提案",
    description:
      "用完整 Markdown 对**当前打开** .md 做块级 LCS Diff 提案，**不写服务器**（≠ overwrite_document）。" +
      "documentId 可省略。有未决 Diff 时会被前端拒绝。",
    parameters: Type.Object({
      documentId: Type.Optional(
        Type.String({ description: "可省略；默认当前 UI 打开文档" }),
      ),
      markdown: Type.String({ description: "完整新稿 Markdown" }),
    }),
    execute: async (_id, params) => {
      const p = params as { documentId?: string; markdown?: string };
      return asToolResult({
        documentId: resolveDiffDocumentId(p.documentId, uiDocumentId),
        op: "overwrite_all" as const,
        markdown: requireMarkdown(p.markdown),
        queued: true,
      });
    },
  };
}

/**
 * 多段连续区间一次提案：SSE → 前端按 base 门牌 span 替换后 overwriteAll。
 * 区间必须不相交；md 块数不必与区间长度 1:1（可增删）。
 */
export function batchUpdateSlotsTool({ uiDocumentId }: ToolDeps): AgentTool {
  return {
    name: "batch_update_slots",
    label: "批量更新文档块",
    description:
      "对**当前打开** .md 一次提交多个**连续且互不相交**的外层块区间替换提案，**不写服务器**。" +
      "documentId 可省略。ranges 每项：start/end（1-based 闭区间）+ markdown；" +
      "markdown 按 Markdown 外层块拆分后整体替换该区间（块数可多于或少于原区间，空串=删除）。" +
      "所有门牌相对**本次调用前**的文档；改多处（如 3–8 与 10–25）必须放进同一次 ranges，禁止拆成两次工具调用。" +
      "改前先 get_document_lexical_lines。单块仍用 update_slot；整篇大改用 overwrite_all。",
    parameters: Type.Object({
      documentId: Type.Optional(
        Type.String({ description: "可省略；默认当前 UI 打开文档" }),
      ),
      ranges: Type.Array(
        Type.Object({
          start: Type.Integer({ description: "区间起点门牌（含）", minimum: 1 }),
          end: Type.Integer({ description: "区间终点门牌（含）", minimum: 1 }),
          markdown: Type.String({
            description: "替换该区间的 Markdown（可多块；空=删除）",
          }),
        }),
        { minItems: 1, description: "不相交的连续区间列表" },
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId?: string;
        ranges?: BatchSlotRange[];
      };
      const validated = validateBatchSlotRanges(p.ranges);
      if (!validated.ok) throw new Error(validated.error);
      return asToolResult({
        documentId: resolveDiffDocumentId(p.documentId, uiDocumentId),
        op: "batch_update_slots" as const,
        ranges: validated.sorted,
        queued: true,
      });
    },
  };
}

export function lexicalLinesTools(deps: ToolDeps): AgentTool[] {
  return [
    getDocumentLexicalLinesTool(deps),
    setDocumentLexicalLinesTool(deps),
    updateSlotTool(deps),
    insertAfterSlotTool(deps),
    removeSlotTool(deps),
    batchUpdateSlotsTool(deps),
    overwriteAllTool(deps),
  ];
}
