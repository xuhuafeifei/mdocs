import {
  addTenantMeme,
  DEFAULT_SYSTEM_MEME_SPEC,
  deleteTenantMeme,
  isValidMemeId,
  listMemes,
  listSystemMemes,
  listTenantMemes,
  readMemeSyncMeta,
  resolveMeme,
  syncSystemMemesFrom,
  updateTenantMeme,
  type ListedMeme,
  type ResolvedMeme,
} from "../store.js";
import { MemeError } from "../meme-error.js";
import { useLogger } from "../../../infra/logger/logger.js";

const log = useLogger("memes");

export function listMemesForVisitor(
  visitorId: string,
  scope?: "system" | "tenant",
): { memes: ListedMeme[] } {
  if (scope === "system") return { memes: listSystemMemes() };
  if (scope === "tenant") return { memes: listTenantMemes(visitorId) };
  return { memes: listMemes(visitorId) };
}

export function getSystemMemeMeta() {
  return { meta: readMemeSyncMeta() };
}

export function resolveMemeForVisitor(visitorId: string, id: string): ResolvedMeme {
  const found = resolveMeme(visitorId, id);
  if (!found) {
    throw new MemeError("MEME_NOT_FOUND", "meme not found", 404);
  }
  return found;
}

export function uploadTenantMeme(
  visitorId: string,
  file: { buffer: Buffer; originalname: string } | undefined,
  fields: { desc?: string; meme_name?: string },
) {
  if (!file) throw new MemeError("MEME_ERROR", "缺少文件字段 file", 400);
  try {
    const entry = addTenantMeme(visitorId, {
      buffer: file.buffer,
      originalName: file.originalname,
      desc: String(fields.desc ?? ""),
      memeName: fields.meme_name ? String(fields.meme_name) : undefined,
    });
    return { meme: { ...entry, source: "tenant" as const } };
  } catch (err) {
    throw new MemeError(
      "MEME_ERROR",
      err instanceof Error ? err.message : String(err),
      400,
    );
  }
}

export function patchTenantMeme(
  visitorId: string,
  id: string,
  patch: { desc?: string },
) {
  try {
    const entry = updateTenantMeme(visitorId, id, {
      desc: patch.desc === undefined ? undefined : String(patch.desc),
    });
    return { meme: { ...entry, source: "tenant" as const } };
  } catch (err) {
    throw new MemeError(
      "MEME_ERROR",
      err instanceof Error ? err.message : String(err),
      400,
    );
  }
}

export function removeTenantMeme(visitorId: string, id: string) {
  if (!isValidMemeId(id)) throw new MemeError("MEME_ERROR", "id 非法", 400);
  try {
    deleteTenantMeme(visitorId, id);
    return { deleted: true as const };
  } catch (err) {
    throw new MemeError(
      "MEME_ERROR",
      err instanceof Error ? err.message : String(err),
      400,
    );
  }
}

export async function syncSystemMemes(specRaw?: string) {
  const spec = String(specRaw ?? "").trim() || DEFAULT_SYSTEM_MEME_SPEC;
  if (spec.length > 214) throw new MemeError("MEME_ERROR", "spec 过长", 400);
  try {
    return await syncSystemMemesFrom(spec);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("系统表情包同步失败", { spec, message });
    throw new MemeError("MEME_ERROR", message, 400);
  }
}
