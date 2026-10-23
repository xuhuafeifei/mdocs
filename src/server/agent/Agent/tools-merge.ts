/**
 * 文档冲突 AI merge / 合并说明（对应 HTTP suggest-merge-*）。
 */
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { DocumentError, assertDocumentAccess } from "../../access/access-control.js";
import {
  suggestDocumentMerge,
  suggestDocumentMergeMessage,
} from "../../documents/ai-merge.service.js";
import { asToolResult, type ToolDeps } from "./tool-deps.js";

export function suggestDocumentMergeTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "suggest_document_merge",
    label: "AI 合并文档冲突",
    description:
      "当本地草稿与云端 tip 冲突时，用三路/两路 diff 生成 git 冲突 Markdown，再 AI 消冲突，返回定稿 Markdown。" +
      "不写库；发布请再用 overwrite_document / replace_document_markdown，或带 version.merge 的更新。" +
      "仅 md/html。浏览器未发布稿须先 get_editor_draft，把返回的 content / localBaseCommitId 传入本工具。",
    parameters: Type.Object({
      documentId: Type.String({ description: "文档 documentId" }),
      localContent: Type.String({
        description: "本地侧正文（Markdown；html 文档可传 HTML 原文）",
      }),
      localBaseCommitId: Type.Optional(
        Type.String({
          description: "本地编辑基于的 commitId（分叉点）；缺省用当前 tip（退化为两方）",
        }),
      ),
      contentFormat: Type.Optional(
        Type.Union(
          [Type.Literal("markdown"), Type.Literal("lexical"), Type.Literal("plain")],
          { description: "localContent 格式，默认 markdown" },
        ),
      ),
    }),
    execute: async (_id, params) => {
      const {
        documentId: rawId,
        localContent,
        localBaseCommitId,
        contentFormat,
      } = params as {
        documentId: string;
        localContent: string;
        localBaseCommitId?: string;
        contentFormat?: "markdown" | "lexical" | "plain";
      };
      const documentId = rawId?.trim();
      if (!documentId) throw new Error("documentId is required");
      if (typeof localContent !== "string") throw new Error("localContent is required");
      try {
        assertDocumentAccess(documentId, visitorId, "edit");
        const data = await suggestDocumentMerge({
          actorVisitorId: visitorId,
          documentId,
          localContent,
          localBaseCommitId,
          contentFormat: contentFormat ?? "markdown",
        });
        return asToolResult({
          status: "ok",
          documentId,
          mergedMarkdown: data.mergedMarkdown,
          unresolvedCount: data.unresolvedCount,
          headCommitId: data.headCommitId,
          // 供下一步 suggest_document_merge_message / 发布使用
          localContent: data.localContent,
          remoteContent: data.remoteContent,
          baseContent: data.baseContent,
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

export function suggestDocumentMergeMessageTool({ visitorId }: ToolDeps): AgentTool {
  return {
    name: "suggest_document_merge_message",
    label: "生成合并说明",
    description:
      "根据 local / remote / merged（可选 base）生成一句中文合并说明（类似 git merge message）。" +
      "通常在 suggest_document_merge 之后调用；不写库。",
    parameters: Type.Object({
      documentId: Type.String({ description: "文档 documentId" }),
      localContent: Type.String({ description: "合并前本地正文" }),
      remoteContent: Type.String({ description: "合并前远端（tip）正文" }),
      mergedContent: Type.String({ description: "合并后的定稿正文" }),
      baseContent: Type.Optional(Type.String({ description: "共同祖先正文，可选" })),
      contentFormat: Type.Optional(
        Type.Union(
          [Type.Literal("markdown"), Type.Literal("lexical"), Type.Literal("plain")],
          { description: "各侧格式，默认 markdown" },
        ),
      ),
    }),
    execute: async (_id, params) => {
      const p = params as {
        documentId: string;
        localContent: string;
        remoteContent: string;
        mergedContent: string;
        baseContent?: string;
        contentFormat?: "markdown" | "lexical" | "plain";
      };
      const documentId = p.documentId?.trim();
      if (!documentId) throw new Error("documentId is required");
      try {
        assertDocumentAccess(documentId, visitorId, "edit");
        const data = await suggestDocumentMergeMessage({
          actorVisitorId: visitorId,
          documentId,
          localContent: p.localContent,
          remoteContent: p.remoteContent,
          mergedContent: p.mergedContent,
          baseContent: p.baseContent,
          contentFormat: p.contentFormat ?? "markdown",
        });
        return asToolResult({ status: "ok", documentId, message: data.message });
      } catch (err) {
        if (err instanceof DocumentError) {
          throw new Error(`${err.code}: ${err.message}`);
        }
        throw err;
      }
    },
  };
}

export function documentMergeTools(deps: ToolDeps): AgentTool[] {
  return [suggestDocumentMergeTool(deps), suggestDocumentMergeMessageTool(deps)];
}
