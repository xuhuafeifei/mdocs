import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { HttpException, HttpStatus } from "@nestjs/common";
import { getConfig } from "../../../infra/config/index.js";
import { getMaxUploadBytes } from "../../../infra/config/server-settings.js";
import { getDb } from "../../../infra/db/connection.js";
import { findDocumentById } from "../../documents/repo/document.repo.js";
import { useLogger } from "../../../infra/logger/logger.js";
import { DocumentError } from "../../access/access-control.js";
import { IMAGE_EXT, buildAssetResponseHeaders, isAllowedAssetUpload } from "../asset-headers.js";
import {
  type AssetUploadEnvelope,
  assetLinkToImgOk,
  assetUploadError,
  assetUploadSuccess,
} from "../asset-upload-envelope.js";

const log = useLogger("assets");

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "image/x-icon": ".ico",
};

const ASSET_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i;

export type ResolvedAssetFile = {
  absPath: string;
  contentType: string;
  contentDisposition?: string;
};

function assertDocumentOwner(visitorId: string, documentId: unknown): string {
  if (typeof documentId !== "string" || !documentId.trim()) {
    throw new DocumentError("BAD_REQUEST", "documentId is required", 400);
  }
  const row = findDocumentById(documentId.trim());
  if (!row) {
    throw new DocumentError("DOC_NOT_FOUND", "document not found", 404);
  }
  if (row.owner_visitor_id !== visitorId) {
    throw new DocumentError("FORBIDDEN", "forbidden", 403);
  }
  return documentId.trim();
}

function uploadFail(message: string, status: number): never {
  throw new HttpException(assetUploadError(message), status);
}

export function resolveAssetFile(
  assetId: string,
  requestedName?: string,
): ResolvedAssetFile {
  if (!assetId || !ASSET_ID_RE.test(assetId)) {
    throw new DocumentError("NOT_FOUND", "asset not found", 404);
  }
  const cfg = getConfig();
  const assetsRoot = path.resolve(cfg.assetsDir);
  const abs = path.resolve(cfg.assetsDir, path.basename(assetId));
  if (!abs.startsWith(assetsRoot + path.sep) && abs !== assetsRoot) {
    throw new DocumentError("NOT_FOUND", "asset not found", 404);
  }
  if (!fs.existsSync(abs)) {
    throw new DocumentError("NOT_FOUND", "asset not found", 404);
  }
  const ext = path.extname(abs).toLowerCase();
  const headers = buildAssetResponseHeaders(ext, path.basename(abs), requestedName);
  return {
    absPath: abs,
    contentType: headers.contentType,
    contentDisposition: headers.contentDisposition,
  };
}

function unlinkFiles(files: Express.Multer.File[] | undefined): void {
  if (!files) return;
  for (const f of files) {
    try {
      fs.unlinkSync(f.path);
    } catch {
      // ignore
    }
  }
}

export function uploadAssetFiles(params: {
  visitorId: string;
  documentId: unknown;
  files: Express.Multer.File[] | undefined;
}): AssetUploadEnvelope {
  let docId: string;
  try {
    docId = assertDocumentOwner(params.visitorId, params.documentId);
  } catch (e) {
    unlinkFiles(params.files);
    if (e instanceof DocumentError) {
      return uploadFail(e.message, e.status);
    }
    return uploadFail(e instanceof Error ? e.message : "error", 400);
  }

  const files = params.files;
  if (!files?.length) {
    return uploadFail("no files", 400);
  }

  const succMap: Record<string, string> = {};
  for (const f of files) {
    const publicPath = `/api/assets/${path.basename(f.path)}`;
    succMap[f.originalname || path.basename(f.path)] = publicPath;
  }
  log.info("upload ok visitor=%s doc=%s count=%d", params.visitorId, docId, files.length);
  return assetUploadSuccess(succMap);
}

function extFromUrl(u: URL): string {
  const ext = path.extname(u.pathname).toLowerCase();
  if (IMAGE_EXT.has(ext)) return ext;
  return ".png";
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;
  if (h.endsWith(".local")) return true;
  if (h === "metadata.google.internal") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const p = h.split(".").map((x) => Number(x));
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 172 && p[1]! >= 16 && p[1]! <= 31) return true;
  }
  return false;
}

export async function linkRemoteImageToAsset(params: {
  visitorId: string;
  documentId: unknown;
  url: unknown;
}): Promise<AssetUploadEnvelope> {
  try {
    assertDocumentOwner(params.visitorId, params.documentId);
  } catch (e) {
    if (e instanceof DocumentError) {
      return uploadFail(e.message, e.status);
    }
    return uploadFail(e instanceof Error ? e.message : "error", 400);
  }

  if (typeof params.url !== "string" || !params.url.trim()) {
    return uploadFail("url is required", 400);
  }
  const rawUrl = params.url.trim();

  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return uploadFail("invalid url", 400);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return uploadFail("only http(s) urls", 400);
  }
  if (isBlockedHost(u.hostname)) {
    return uploadFail("url host is not allowed", 400);
  }

  try {
    const r = await fetch(u.toString(), {
      redirect: "follow",
      headers: { "User-Agent": "mdocs-asset-fetch/1" },
    });
    if (!r.ok) {
      return uploadFail(`fetch failed: ${r.status}`, 400);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > getMaxUploadBytes()) {
      return uploadFail("image too large", 400);
    }
    const ct = r.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ct.startsWith("image/")) {
      return uploadFail("response is not an image", 400);
    }
    const ext = MIME_TO_EXT[ct] ?? extFromUrl(u);
    if (!IMAGE_EXT.has(ext)) {
      return uploadFail("unsupported image type", 400);
    }
    const id = `${crypto.randomUUID()}${ext}`;
    const cfg = getConfig();
    const dest = path.join(cfg.assetsDir, id);
    await fs.promises.writeFile(dest, buf);
    const publicPath = `/api/assets/${id}`;
    log.info(
      "link-to-img ok visitor=%s doc=%s bytes=%d",
      params.visitorId,
      String(params.documentId),
      buf.length,
    );
    return assetLinkToImgOk(rawUrl, publicPath);
  } catch (e) {
    if (e instanceof HttpException) throw e;
    log.warn("link-to-img failed: %s", e instanceof Error ? e.message : String(e));
    return uploadFail("fetch failed", HttpStatus.BAD_REQUEST);
  }
}

export { isAllowedAssetUpload };
