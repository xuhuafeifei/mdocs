import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ToolDeps } from "../Agent/tool-deps.js";
import { asToolResult } from "../Agent/tool-deps.js";
import { resolveParseStrategy } from "./capabilities.js";
import { getAttachmentStore } from "./store.js";
import { DEFAULT_PARSE_LIMITS } from "./types.js";

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
          return asToolResult({
            ok: true,
            kind: "image",
            name: meta.name,
            mime: result.mime,
            bytes: result.data.byteLength,
            note: "图片已可由多模态直接查看；如需描述请结合用户问题回答，无需再转文字。",
          });
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
