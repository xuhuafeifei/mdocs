/**
 * Agent / CLI：从 local 正文 + tip/base 构建冲突 md，再跑 AI merge / merge-message。
 */
import { getDb } from "../db/connection.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { DocumentError } from "../access/access-control.js";
import { canAiMerge } from "../../shared/file-type-policy.js";
import { getDocument, getDocumentMergeContext } from "./document.service.js";
import { contentToDiffText } from "./suggest-commit-message.js";
import { buildConflictMarkdownFromTexts } from "./build-conflict-markdown.js";
import { suggestMergeResolutions } from "./suggest-merge-resolutions.js";
import { suggestMergeMessage } from "./suggest-merge-message.js";
import { lexicalJsonToMarkdown } from "./lexical-to-markdown.js";

function toMergeText(
  content: string,
  fileType: string,
  contentFormat?: "markdown" | "lexical" | "plain",
): string {
  if (contentFormat === "markdown" || contentFormat === "plain") {
    return content.replace(/\r\n/g, "\n");
  }
  if (contentFormat === "lexical") {
    try {
      return lexicalJsonToMarkdown(content).replace(/\r\n/g, "\n");
    } catch {
      return contentToDiffText(content, fileType);
    }
  }
  return contentToDiffText(content, fileType);
}

function tipToMergeText(content: string, fileType: string): string {
  return contentToDiffText(content, fileType);
}

export async function suggestDocumentMerge(params: {
  actorVisitorId: string;
  documentId: string;
  localContent: string;
  localBaseCommitId?: string;
  contentFormat?: "markdown" | "lexical" | "plain";
}): Promise<{
  mergedMarkdown: string;
  localContent: string;
  remoteContent: string;
  baseContent: string | null;
  conflictMarkdown: string;
  unresolvedCount: number;
  headCommitId: string | null;
}> {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  if (!canAiMerge(row.file_type)) {
    throw new DocumentError("BAD_REQUEST", "该文件类型不支持 AI 行级合并", 400);
  }

  const tip = getDocument(params.documentId, params.actorVisitorId, "json");
  const remoteContent = tipToMergeText(tip.content, row.file_type);
  const localContent = toMergeText(params.localContent, row.file_type, params.contentFormat);

  const remoteCommitId = tip.headCommitId;
  if (!remoteCommitId) {
    throw new DocumentError("BAD_REQUEST", "文档尚无 head，无法 merge", 400);
  }

  const localBaseCommitId = params.localBaseCommitId?.trim() || remoteCommitId;
  let baseContent = "";
  try {
    const ctx = getDocumentMergeContext(
      params.documentId,
      localBaseCommitId,
      remoteCommitId,
    );
    if (ctx.mode === "three_way" && ctx.mergeBaseContent) {
      baseContent = tipToMergeText(ctx.mergeBaseContent, row.file_type);
    }
  } catch {
    baseContent = "";
  }

  const { conflictMarkdown, unresolvedCount } = buildConflictMarkdownFromTexts({
    localMd: localContent,
    baseMd: baseContent,
    remoteMd: remoteContent,
  });

  if (unresolvedCount === 0) {
    // 无未决议块时 serialize 结果已是无标记的全文
    return {
      mergedMarkdown: conflictMarkdown,
      localContent,
      remoteContent,
      baseContent: baseContent || null,
      conflictMarkdown,
      unresolvedCount: 0,
      headCommitId: remoteCommitId,
    };
  }

  const { mergedMarkdown } = await suggestMergeResolutions({
    actorVisitorId: params.actorVisitorId,
    documentId: params.documentId,
    conflictMarkdown,
  });

  return {
    mergedMarkdown,
    localContent,
    remoteContent,
    baseContent: baseContent || null,
    conflictMarkdown,
    unresolvedCount,
    headCommitId: remoteCommitId,
  };
}

export async function suggestDocumentMergeMessage(params: {
  actorVisitorId: string;
  documentId: string;
  localContent: string;
  remoteContent: string;
  mergedContent: string;
  baseContent?: string;
  contentFormat?: "markdown" | "lexical" | "plain";
}): Promise<{ message: string }> {
  return suggestMergeMessage({
    actorVisitorId: params.actorVisitorId,
    documentId: params.documentId,
    localContent: params.localContent,
    remoteContent: params.remoteContent,
    mergedContent: params.mergedContent,
    baseContent: params.baseContent,
    contentFormat: params.contentFormat ?? "markdown",
  });
}
