/**
 * 附件 → session 工具行（供下一轮 hydrate 重建）。
 *
 * 首轮：附件已内嵌进 prompt，模型直接看见内容；同时把这次「读取」落成一条 tool 行，
 *       让历史重放时模型仍能看到表格内容 / 至少知道有图可读。
 * 图片：永不落字节（每轮重放视觉 token 太贵），只落一句带 assetId 的可操作提示。
 * 超大：落「数据过大，请自行调用工具」。
 */
import type { AgentSessionToolMessage } from "../Agent/session-manager.js";
import {
  PERSIST_PREVIEW_MIN_CHARS,
  PERSIST_TEXT_MAX_CHARS,
  assetParseTypeOf,
  shouldPersistAssetBody,
} from "./types.js";

/** 历史重放时用于「假装读过附件」的工具名，与真实工具同名，保证 tools 里一定存在 */
export const ATTACHMENT_READ_TOOL = "read_attachment";

/** 单条 tool 行里最多塞多少字符；超过截断（正常 1MB 文件早在上面被挡） */
const MAX_ROW_TEXT = 400_000;

export function attachmentToolCallId(assetId: string): string {
  return `uattach-${assetId}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

export type AttachmentRowInput = {
  asset: { id: string; name: string; mime: string; bytes: number };
  /** 首轮解析出的文本（图片为 undefined） */
  parsedText?: string;
  /** 首轮是否已把内容内嵌进 prompt（仅用于调用方语义；当前不影响落盘格式） */
  embeddedInPrompt?: boolean;
  /** 解析失败原因 */
  parseError?: string;
};

/** 首轮/重放共用的「请自行读取」提示，唯一可操作入口是 assetId */
export function attachmentToolHint(asset: {
  id: string;
  name: string;
  mime: string;
  bytes: number;
}): string {
  const type = assetParseTypeOf(asset.name);
  const where = `assetId=${asset.id}（${asset.name}，${asset.mime}，${formatBytes(asset.bytes)}）`;
  if (type === "image") {
    return (
      `[图片附件未内嵌] ${where}。图片不会随历史自动重放；需要看图时调用工具 ` +
      `${ATTACHMENT_READ_TOOL}，参数 { "assetId": "${asset.id}" }，会直接返回图像。`
    );
  }
  if (type === "pdf") {
    return (
      `[PDF 附件未内嵌] ${where}。需要正文时调用工具 ` +
      `${ATTACHMENT_READ_TOOL}，参数 { "assetId": "${asset.id}" }。`
    );
  }
  return (
    `[附件正文未内嵌] ${where}。需要内容时调用工具 ` +
    `${ATTACHMENT_READ_TOOL}，参数 { "assetId": "${asset.id}" }；` +
    `大文件可传 offset/limit 分段读取。`
  );
}

/**
 * 为一次上传生成 session 工具行。
 * - 文本类且解析后 ≤20,000 字符：tool 行正文 = 完整解析结果（下一轮直接可见）
 * - 文本类但解析后更长：落「表头 + 前若干行」预览 + 用 offset 读剩余
 * - 图片 / PDF：只写提示，不落字节
 *
 * 判断依据是**解析后字符数**而非文件字节：Excel 展开成 JSON 通常膨胀 5 倍以上，
 * 按字节判断会让一张 67KB 的表在每轮对话里吃掉十万级 token。
 */
export function buildAttachmentToolRow(
  input: AttachmentRowInput,
): AgentSessionToolMessage {
  const { asset, parsedText, parseError } = input;
  const type = assetParseTypeOf(asset.name);
  const toolCallId = attachmentToolCallId(asset.id);
  const parsedChars = typeof parsedText === "string" ? parsedText.length : 0;

  let resultText: string;
  if (parseError) {
    resultText = `[附件读取失败] ${parseError}\n${attachmentToolHint(asset)}`;
  } else if (type === "image" || type === "pdf") {
    resultText = attachmentToolHint(asset);
  } else if (parsedChars > 0 && !shouldPersistAssetBody(type, parsedChars)) {
    resultText = buildLargeAttachmentPreview(asset, parsedText!, parsedChars);
  } else if (parsedChars > 0) {
    resultText =
      parsedChars > MAX_ROW_TEXT
        ? `${parsedText!.slice(0, MAX_ROW_TEXT)}\n…(超长已截断，可用 ${ATTACHMENT_READ_TOOL} 分段读取完整内容)`
        : parsedText!;
  } else {
    // 解析器没给出文本（例如首轮已内嵌但没回传解析结果）：退化为可操作提示
    resultText = attachmentToolHint(asset);
  }

  const row: AgentSessionToolMessage = {
    role: "tool",
    toolCallId,
    toolName: ATTACHMENT_READ_TOOL,
    arguments: { assetId: asset.id },
    resultText,
  };
  if (parseError) row.isError = true;
  return row;
}

/**
 * 超大解析结果落盘：给表头/前若干行 + 明确的续读指令。
 * 全量落盘会让每轮对话都重发十万级 token，因此只留预览。
 */
function buildLargeAttachmentPreview(
  asset: { id: string; name: string; bytes: number },
  parsedText: string,
  parsedChars: number,
): string {
  // 按行截断：JSON / CSV 都尽量停在完整行上，避免半个对象
  const lines = parsedText.split("\n");
  let preview = "";
  let lineCount = 0;
  for (const line of lines) {
    if (preview.length + line.length > PERSIST_TEXT_MAX_CHARS) break;
    preview += (preview ? "\n" : "") + line;
    lineCount += 1;
    if (preview.length >= PERSIST_PREVIEW_MIN_CHARS) break;
  }
  if (!preview) preview = parsedText.slice(0, PERSIST_TEXT_MAX_CHARS);
  return (
    `[附件较大，仅落预览] ${asset.name}（${formatBytes(asset.bytes)}，解析后 ` +
    `${parsedChars.toLocaleString("en-US")} 字符）超过 ` +
    `${PERSIST_TEXT_MAX_CHARS.toLocaleString("en-US")} 字符上限，未随历史全文落盘。\n` +
    `以下为前 ${lineCount} 行预览（用于判断表结构与内容范围）：\n` +
    `${preview}\n` +
    `…(完整内容请调用工具 ${ATTACHMENT_READ_TOOL}，参数 { "assetId": "${asset.id}" }，` +
    `用 offset/limit 分段读取；单次上限 50000 字符)`
  );
}
