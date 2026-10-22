/**
 * 根据「当前待发正文」相对「最近一次非 auto commit」的增量，用访客默认模型生成短 message。
 */
import { getDb } from "../db/connection.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { findLatestNonAutoCommit } from "../db/repositories/commit.repo.js";
import { DocumentError } from "../access/access-control.js";
import { readCommitBlob } from "../storage/file-store.js";
import { getVisitorAgentConfig } from "../agent/Config/config.js";
import { lexicalJsonToMarkdown } from "./lexical-to-markdown.js";
import { getPolicy } from "../../shared/file-type-policy.js";
import { PUBLISH_MESSAGE_MAX_LENGTH } from "../../shared/publish-meta.js";
import type { TextContent } from "@earendil-works/pi-ai";
import type { Context } from "@earendil-works/pi-ai";

const DIFF_MAX_CHARS = 12_000;
const SUGGEST_MAX_CHARS = 80;

const SYSTEM = `你是文档版本说明助手。根据 unified diff（相对上一有意发布版本）写一句中文发布说明，类似 git commit message。
要求：只输出说明本身，不要引号/前缀/列表；不超过 ${SUGGEST_MAX_CHARS} 字；概括改了什么，勿复述全文。`;

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

/** 将存盘正文转为可 diff 的纯文本。 */
export function contentToDiffText(content: string, fileType: string): string {
  const policy = getPolicy(fileType as any);
  if (policy.writeNormalize === "raw") {
    return content.replace(/\r\n/g, "\n");
  }
  const trimmed = content.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(content) as { root?: unknown };
    if (parsed && typeof parsed === "object" && parsed.root) {
      return lexicalJsonToMarkdown(content).replace(/\r\n/g, "\n");
    }
  } catch {
    /* plain / markdown */
  }
  return content.replace(/\r\n/g, "\n");
}

/** 简易按行对齐 diff（非 Myers）；够给 LLM 用。 */
export function roughUnifiedDiff(before: string, after: string, maxChars: number): string {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const out: string[] = ["--- base", "+++ current"];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) continue;
    if (o !== undefined) out.push(`- ${o}`);
    if (n !== undefined) out.push(`+ ${n}`);
    if (out.join("\n").length >= maxChars) break;
  }
  let text = out.join("\n");
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}\n…`;
  return text;
}

export async function suggestCommitMessage(params: {
  actorVisitorId: string;
  documentId: string;
  content: string;
  contentFormat?: "markdown" | "lexical";
}): Promise<{ message: string; baseCommitId: string | null }> {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);

  const cfg = getVisitorAgentConfig(params.actorVisitorId);
  if (!cfg?.apiKey) {
    throw new DocumentError("BAD_REQUEST", "未配置默认模型或 API Key，无法生成发布说明", 400);
  }

  const base = findLatestNonAutoCommit(db, params.documentId);
  let baseText = "";
  if (base) {
    try {
      baseText = contentToDiffText(readCommitBlob(base.blob_ref), row.file_type);
    } catch {
      baseText = "";
    }
  }

  // 请求体可能是 markdown；存盘侧多为 lexical。按 format 与 fileType 规范当前侧。
  let currentRaw = params.content;
  if (params.contentFormat === "markdown" && getPolicy(row.file_type as any).writeNormalize !== "raw") {
    // diff 用 markdown 原文即可，不必先转 lexical
    currentRaw = params.content;
  }
  const currentText =
    params.contentFormat === "markdown" && getPolicy(row.file_type as any).writeNormalize !== "raw"
      ? params.content.replace(/\r\n/g, "\n")
      : contentToDiffText(currentRaw, row.file_type);

  const diff = roughUnifiedDiff(baseText, currentText, DIFF_MAX_CHARS);
  if (diff === "--- base\n+++ current") {
    return { message: "无内容变更", baseCommitId: base?.commit_id ?? null };
  }

  const { createAgentModel } = await import("../agent/Agent/run.js");
  const { models, model } = createAgentModel(cfg);
  const context: Context = {
    systemPrompt: SYSTEM,
    messages: [
      {
        role: "user",
        content: `文档「${row.display_name}」发布说明，请根据 diff 生成：\n\n${diff}`,
        timestamp: Date.now(),
      },
    ],
  };

  let text: string;
  try {
    const result = await models.completeSimple(model, context, {
      maxTokens: 128,
      temperature: 0.3,
    });
    text = extractAssistantText(result.content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DocumentError("INTERNAL", `生成发布说明失败：${msg}`, 502);
  }

  if (!text) {
    throw new DocumentError("INTERNAL", "模型未返回发布说明", 502);
  }
  // 去掉可能的引号包裹
  text = text.replace(/^["「『]+|["」』]+$/g, "").trim();
  if (text.length > SUGGEST_MAX_CHARS) text = `${text.slice(0, SUGGEST_MAX_CHARS)}…`;
  if (text.length > PUBLISH_MESSAGE_MAX_LENGTH) {
    text = text.slice(0, PUBLISH_MESSAGE_MAX_LENGTH);
  }
  return { message: text, baseCommitId: base?.commit_id ?? null };
}
