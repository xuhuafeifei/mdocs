/**
 * 合并发布说明：根据 local / remote / merged（可选 base）用默认模型生成短 message。
 */
import { getDb } from "../db/connection.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { DocumentError } from "../access/access-control.js";
import { getVisitorAgentConfig } from "../agent/Config/config.js";
import { PUBLISH_MESSAGE_MAX_LENGTH } from "../../shared/publish-meta.js";
import { contentToDiffText, roughUnifiedDiff } from "./suggest-commit-message.js";
import type { TextContent } from "@earendil-works/pi-ai";
import type { Context } from "@earendil-works/pi-ai";

const DIFF_MAX = 8_000;
const SUGGEST_MAX_CHARS = 80;

const SYSTEM = `你是文档合并说明助手。用户刚完成一次冲突合并，会提供「我的」「别人的」「合并结果」（可能还有祖先 base）。
写一句中文合并说明，类似 git merge commit message。
要求：只输出说明本身，不要引号/前缀/列表；不超过 ${SUGGEST_MAX_CHARS} 字；概括保留了哪边、合入了什么，勿复述全文。`;

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

function toText(
  content: string,
  fileType: string,
  contentFormat?: "markdown" | "lexical" | "plain",
): string {
  if (contentFormat === "markdown" || contentFormat === "plain") {
    return content.replace(/\r\n/g, "\n");
  }
  return contentToDiffText(content, fileType);
}

export async function suggestMergeMessage(params: {
  actorVisitorId: string;
  documentId: string;
  localContent: string;
  remoteContent: string;
  mergedContent: string;
  baseContent?: string;
  contentFormat?: "markdown" | "lexical" | "plain";
}): Promise<{ message: string }> {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);

  const cfg = getVisitorAgentConfig(params.actorVisitorId);
  if (!cfg?.apiKey) {
    throw new DocumentError("BAD_REQUEST", "未配置默认模型或 API Key，无法生成合并说明", 400);
  }

  const fmt = params.contentFormat;
  const local = toText(params.localContent, row.file_type, fmt);
  const remote = toText(params.remoteContent, row.file_type, fmt);
  const merged = toText(params.mergedContent, row.file_type, fmt);
  const base =
    typeof params.baseContent === "string" && params.baseContent.length > 0
      ? toText(params.baseContent, row.file_type, fmt)
      : "";

  const localDiff = roughUnifiedDiff(local, merged, DIFF_MAX);
  const remoteDiff = roughUnifiedDiff(remote, merged, DIFF_MAX);
  const basePart = base
    ? `\n\n--- vs base ---\n${roughUnifiedDiff(base, merged, Math.floor(DIFF_MAX / 2))}`
    : "";

  const { createAgentModel } = await import("../agent/Agent/run.js");
  const { models, model } = createAgentModel(cfg);
  const context: Context = {
    systemPrompt: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `文档「${row.display_name}」合并说明：\n\n` +
          `=== local → merged ===\n${localDiff}\n\n` +
          `=== remote → merged ===\n${remoteDiff}${basePart}`,
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
    throw new DocumentError("INTERNAL", `生成合并说明失败：${msg}`, 502);
  }

  if (!text) {
    throw new DocumentError("INTERNAL", "模型未返回合并说明", 502);
  }
  text = text.replace(/^["「『]+|["」』]+$/g, "").trim();
  if (text.length > SUGGEST_MAX_CHARS) text = `${text.slice(0, SUGGEST_MAX_CHARS)}…`;
  if (text.length > PUBLISH_MESSAGE_MAX_LENGTH) {
    text = text.slice(0, PUBLISH_MESSAGE_MAX_LENGTH);
  }
  return { message: text };
}
