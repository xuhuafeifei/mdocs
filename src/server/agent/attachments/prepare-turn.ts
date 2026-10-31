import { resolveParseStrategy } from "./capabilities.js";
import { buildUserContentParts, partsToPiPrompt } from "./inject.js";
import type { AttachmentStore } from "./store.js";
import { buildAttachmentToolRow } from "./session-rows.js";
import type { AgentSessionToolMessage } from "../Agent/session-manager.js";
import {
  DEFAULT_PARSE_LIMITS,
  PARSED_LENGTH_PROBE_CHARS,
  type AssetMeta,
  type AssetRef,
  type LlmContentPart,
  type ParseLimits,
  type ParseResult,
} from "./types.js";

export async function prepareUserTurn(input: {
  store: AttachmentStore;
  visitorId: string;
  sessionId: string;
  message: string;
  assetIds: string[];
  limits?: ParseLimits;
}): Promise<{
  parts: LlmContentPart[];
  pi: ReturnType<typeof partsToPiPrompt>;
  metas: AssetMeta[];
  refs: AssetRef[];
  /** 本轮附件对应的 session 工具行（供历史重放；图片只放提示） */
  toolRows: AgentSessionToolMessage[];
}> {
  const limits = input.limits ?? DEFAULT_PARSE_LIMITS;
  const metas =
    input.assetIds.length === 0
      ? []
      : await input.store.persist({
          visitorId: input.visitorId,
          sessionId: input.sessionId,
          ids: input.assetIds,
        });

  const parsed: Array<{ meta: AssetMeta; result: ParseResult }> = [];
  /** 落盘用的完整解析文本：deferred 首轮没内嵌，但历史必须知道真实体量 */
  const persistTexts = new Map<string, string>();
  for (const meta of metas) {
    const { data } = await input.store.read({
      visitorId: input.visitorId,
      id: meta.id,
    });
    const parse = resolveParseStrategy(meta.name);
    const result = await parse({ meta, data, limits });
    parsed.push({ meta, result });
    if (result.kind === "text") {
      persistTexts.set(meta.id, result.text);
      continue;
    }
    if (result.kind === "deferred") {
      // 首轮只给元数据；这里按落盘上限再解析一次，拿到真实字符数交给 buildAttachmentToolRow
      const full = await parse({
        meta,
        data,
        limits: { ...limits, maxEmbedTextChars: PARSED_LENGTH_PROBE_CHARS },
      });
      if (full.kind === "text") persistTexts.set(meta.id, full.text);
    }
  }

  const parts = buildUserContentParts(input.message, parsed);
  const refs: AssetRef[] = metas.map((m) => ({
    id: m.id,
    name: m.name,
    mime: m.mime,
    bytes: m.bytes,
  }));
  const toolRows = buildAttachmentToolRows(metas, parsed, persistTexts);
  return { parts, pi: partsToPiPrompt(parts), metas, refs, toolRows };
}

/**
 * 解析结果 → session 工具行。
 * 文本：按解析后字符数决定落全文还是落预览；deferred 用 persistTexts 里的完整文本判定。
 * 图片 / PDF：只落可操作提示。
 */
function buildAttachmentToolRows(
  metas: AssetMeta[],
  parsed: Array<{ meta: AssetMeta; result: ParseResult }>,
  persistTexts: Map<string, string>,
): AgentSessionToolMessage[] {
  const rows: AgentSessionToolMessage[] = [];
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i]!;
    const result = parsed[i]?.result;
    const asset = { id: meta.id, name: meta.name, mime: meta.mime, bytes: meta.bytes };
    const fullText = persistTexts.get(meta.id);
    if (!result) {
      rows.push(buildAttachmentToolRow({ asset, parsedText: fullText }));
      continue;
    }
    if (result.kind === "unsupported") {
      rows.push(buildAttachmentToolRow({ asset, parseError: result.reason }));
      continue;
    }
    rows.push(buildAttachmentToolRow({ asset, parsedText: fullText }));
  }
  return rows;
}
