/**
 * 智能助手：按外层块读/写 md_format_lexical 提案（不写盘）。
 */
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { assertDocumentAccess, DocumentError } from "../../access/access-control.js";
import { getDocument } from "../../documents/document.service.js";
import { lexicalJsonToLexicalLines } from "../../documents/lexical-to-markdown.js";
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
export function setDocumentLexicalLinesTool(_deps: ToolDeps): AgentTool {
  return {
    name: "set_document_lexical_lines",
    label: "按块设置提案",
    description:
      "向当前打开文档提交按块 Markdown 提案（md_format_lexical），**不写服务器**。" +
      "用户在前端 LexicalDiff 上 Accept/Reject 后再应用。" +
      "mode=patch_lines：lines 只含要改的门牌（相对 get_document_lexical_lines）；" +
      "mode=replace_all：整篇覆写，传完整 lines 表或 markdown 全文。" +
      "新提案会覆盖未应用的旧提案。改前先 get_document_lexical_lines。",
    parameters: Type.Object({
      documentId: Type.String({ description: "目标文档 documentId（应与用户当前打开文一致）" }),
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
      const documentId = String(p.documentId ?? "").trim();
      if (!documentId) throw new Error("documentId is required");
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
        applied: true,
      });
    },
  };
}

export function lexicalLinesTools(deps: ToolDeps): AgentTool[] {
  return [getDocumentLexicalLinesTool(deps), setDocumentLexicalLinesTool(deps)];
}
