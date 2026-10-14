import { resolveParseStrategy } from "./capabilities.js";
import { buildUserContentParts, partsToPiPrompt } from "./inject.js";
import type { AttachmentStore } from "./store.js";
import {
  DEFAULT_PARSE_LIMITS,
  type AssetMeta,
  type AssetRef,
  type LlmContentPart,
  type ParseLimits,
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

  const parsed: Array<{ meta: AssetMeta; result: Awaited<ReturnType<ReturnType<typeof resolveParseStrategy>>> }> =
    [];
  for (const meta of metas) {
    const { data } = await input.store.read({
      visitorId: input.visitorId,
      id: meta.id,
    });
    const parse = resolveParseStrategy(meta.name);
    const result = await parse({ meta, data, limits });
    parsed.push({ meta, result });
  }

  const parts = buildUserContentParts(input.message, parsed);
  const refs: AssetRef[] = metas.map((m) => ({
    id: m.id,
    name: m.name,
    mime: m.mime,
    bytes: m.bytes,
  }));
  return { parts, pi: partsToPiPrompt(parts), metas, refs };
}
