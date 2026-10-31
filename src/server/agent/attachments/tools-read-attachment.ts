import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ToolDeps } from "../Agent/tool-deps.js";
import { asToolResult } from "../Agent/tool-deps.js";
import { resolveParseStrategy } from "./capabilities.js";
import { getAttachmentStore } from "./store.js";
import { DEFAULT_PARSE_LIMITS, TOOL_IMAGE_MAX_BYTES } from "./types.js";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/** 按需读取已 persist 的附件；大文本可 offset/limit */
export function readAttachmentTool(deps: ToolDeps): AgentTool {
  return {
    name: "read_attachment",
    label: "读取聊天附件",
    description:
      "读取用户在本会话上传的附件内容。大文件/PDF 未内嵌时应调用本工具。可传 offset+limit 分段读文本。",
    parameters: Type.Object({
      assetId: Type.String({ description: "附件 id（消息里 [附件] 提示中的 id）" }),
      offset: Type.Optional(
        Type.Integer({ minimum: 0, description: "文本起始字符偏移，默认 0" }),
      ),
      limit: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: 50_000,
          description: "最多返回字符数，默认 8000",
        }),
      ),
    }),
    execute: async (_id, raw) => {
      const params = raw as {
        assetId?: string;
        offset?: number;
        limit?: number;
      };
      const assetId =
        typeof params.assetId === "string" ? params.assetId.trim() : "";
      if (!assetId) {
        return asToolResult({ ok: false, error: "assetId_required" });
      }
      const offset = typeof params.offset === "number" ? params.offset : 0;
      const limit = typeof params.limit === "number" ? params.limit : 8000;
      const store = getAttachmentStore();
      try {
        const { meta, data } = await store.read({
          visitorId: deps.visitorId,
          id: assetId,
        });
        const parse = resolveParseStrategy(meta.name);
        const result = await parse({
          meta,
          data,
          limits: {
            ...DEFAULT_PARSE_LIMITS,
            // tool 路径允许更大文本，再由 offset/limit 切片
            maxEmbedTextChars: 5_000_000,
            maxImageBytes: 20 * 1024 * 1024,
          },
        });
        if (result.kind === "image") {
          // 图片本身就是「结果」：必须作为 ImageContent 返回，否则模型只拿到元数据，看不到图。
          // 超上限时不硬塞，避免单条 tool result 撑爆上下文。
          if (result.data.byteLength > TOOL_IMAGE_MAX_BYTES) {
            return asToolResult({
              ok: false,
              kind: "image",
              name: meta.name,
              mime: result.mime,
              bytes: result.data.byteLength,
              error: "image_too_large_for_tool",
              note: `图片 ${formatBytes(result.data.byteLength)} 超过单次工具返回上限 ` +
                `${formatBytes(TOOL_IMAGE_MAX_BYTES)}，未返回图像。请提示用户压缩或裁剪后重新上传。`,
            });
          }
          return {
            content: [
              {
                type: "text" as const,
                text: `[附件 ${meta.name}] ${result.mime}，${formatBytes(result.data.byteLength)}`,
              },
              {
                type: "image" as const,
                data: Buffer.from(result.data).toString("base64"),
                mimeType: result.mime,
              },
            ],
            details: {
              ok: true,
              kind: "image",
              name: meta.name,
              mime: result.mime,
              bytes: result.data.byteLength,
            },
          };
        }
        if (result.kind === "text") {
          const slice = result.text.slice(offset, offset + limit);
          return asToolResult({
            ok: true,
            kind: "text",
            name: meta.name,
            offset,
            length: slice.length,
            total: result.text.length,
            truncated: offset + limit < result.text.length,
            text: slice,
          });
        }
        if (result.kind === "deferred") {
          // PDF v1：至少返回基本信息；若将来抽文本，可在此扩展
          return asToolResult({
            ok: true,
            kind: "deferred",
            name: meta.name,
            mime: meta.mime,
            bytes: meta.bytes,
            reason: result.reason,
            hint: result.hint,
            note: "当前无法抽出可嵌入正文；请根据文件名与用户说明继续，或请用户粘贴关键片段。",
          });
        }
        return asToolResult({
          ok: false,
          error: "unsupported",
          reason: result.reason,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return asToolResult({ ok: false, error: msg });
      }
    },
  };
}
