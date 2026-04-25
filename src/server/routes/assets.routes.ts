import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { getConfig } from "../config/index.js";
import { getDb } from "../db/connection.js";
import { findDocumentById } from "../db/repositories/document.repo.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("assets-route");

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
  ".jfif",
  ".pjpeg",
]);

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

function vditorSuccess(succMap: Record<string, string>) {
  return { msg: "", code: 0 as const, data: { errFiles: [] as string[], succMap } };
}

function vditorError(msg: string, status = 400) {
  return { status, body: { code: 1 as const, msg, data: { errFiles: [] as string[], succMap: {} } } };
}

/** Paste / drop remote image URL: Vditor expects `data.originalURL` + `data.url` (not succMap). */
function vditorLinkToImgOk(originalURL: string, url: string) {
  return { msg: "", code: 0 as const, data: { originalURL, url } };
}

function assertDocumentOwner(req: Request, documentId: unknown): string {
  if (!req.visitor) {
    throw Object.assign(new Error("UNAUTHENTICATED"), { status: 401 });
  }
  if (typeof documentId !== "string" || !documentId.trim()) {
    throw Object.assign(new Error("documentId is required"), { status: 400 });
  }
  const row = findDocumentById(getDb(), documentId.trim());
  if (!row) {
    throw Object.assign(new Error("document not found"), { status: 404 });
  }
  if (row.owner_visitor_id !== req.visitor.visitor_id) {
    throw Object.assign(new Error("forbidden"), { status: 403 });
  }
  return documentId.trim();
}

function extFromUrl(u: URL): string {
  const ext = path.extname(u.pathname).toLowerCase();
  if (ALLOWED_EXT.has(ext)) return ext;
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

function createUploader() {
  const cfg = getConfig();
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, cfg.assetsDir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || ".bin";
        cb(null, `${crypto.randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: MAX_BYTES, files: 24 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        cb(new Error("unsupported file type"));
        return;
      }
      if (file.mimetype && !file.mimetype.startsWith("image/")) {
        cb(new Error("not an image"));
        return;
      }
      cb(null, true);
    },
  });
}

/** Public GET /api/assets/:assetId — must be registered before auth middleware. */
export function serveAssetFile(req: Request, res: Response): void {
  const assetId = req.params.assetId;
  if (!assetId || !ASSET_ID_RE.test(assetId)) {
    res.status(404).end();
    return;
  }
  const cfg = getConfig();
  const assetsRoot = path.resolve(cfg.assetsDir);
  const abs = path.resolve(cfg.assetsDir, path.basename(assetId));
  if (!abs.startsWith(assetsRoot + path.sep) && abs !== assetsRoot) {
    res.status(404).end();
    return;
  }
  if (!fs.existsSync(abs)) {
    res.status(404).end();
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  const ct =
    ext === ".svg"
      ? "image/svg+xml"
      : ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg" || ext === ".jfif" || ext === ".pjpeg"
          ? "image/jpeg"
          : ext === ".gif"
            ? "image/gif"
            : ext === ".webp"
              ? "image/webp"
              : ext === ".ico"
                ? "image/x-icon"
                : ext === ".bmp"
                  ? "image/bmp"
                  : "application/octet-stream";
  res.setHeader("Content-Type", ct);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  fs.createReadStream(abs).pipe(res);
}

/** POST /upload and POST /link-to-img — mount at /api/assets after auth. */
export function buildAssetsUploadRouter(): ReturnType<typeof Router> {
  const upload = createUploader();
  const router = Router();

  router.post(
    "/upload",
    (req: Request, res: Response, next) => {
      upload.array("file[]", 20)(req, res, (err: unknown) => {
        if (err) {
          res.status(400).json(vditorError(err instanceof Error ? err.message : "upload failed").body);
          return;
        }
        next();
      });
    },
    (req: Request, res: Response) => {
    let docId: string;
    try {
      docId = assertDocumentOwner(req, req.body?.documentId);
    } catch (e) {
      const files = req.files as Express.Multer.File[] | undefined;
      if (files) {
        for (const f of files) {
          try {
            fs.unlinkSync(f.path);
          } catch {
            // ignore
          }
        }
      }
      const err = e as Error & { status?: number };
      const ve = vditorError(err.message || "error", err.status ?? 400);
      res.status(ve.status).json(ve.body);
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      res.status(400).json(vditorError("no files").body);
      return;
    }

    const succMap: Record<string, string> = {};
    for (const f of files) {
      const publicPath = `/api/assets/${path.basename(f.path)}`;
      succMap[f.originalname || path.basename(f.path)] = publicPath;
    }
    log.info("upload ok visitor=%s doc=%s count=%d", req.visitor!.visitor_id, docId, files.length);
    res.json(vditorSuccess(succMap));
    },
  );

  router.post("/link-to-img", async (req: Request, res: Response) => {
    const q = typeof req.query.documentId === "string" ? req.query.documentId : "";
    let docId: string;
    try {
      docId = assertDocumentOwner(req, q);
    } catch (e) {
      const err = e as Error & { status?: number };
      const ve = vditorError(err.message || "error", err.status ?? 400);
      res.status(ve.status).json(ve.body);
      return;
    }

    const rawUrl = (req.body as { url?: unknown })?.url;
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      res.status(400).json(vditorError("url is required").body);
      return;
    }

    let u: URL;
    try {
      u = new URL(rawUrl.trim());
    } catch {
      res.status(400).json(vditorError("invalid url").body);
      return;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      res.status(400).json(vditorError("only http(s) urls").body);
      return;
    }
    if (isBlockedHost(u.hostname)) {
      res.status(400).json(vditorError("url host is not allowed").body);
      return;
    }

    try {
      const r = await fetch(u.toString(), {
        redirect: "follow",
        headers: { "User-Agent": "mdocs-asset-fetch/1" },
      });
      if (!r.ok) {
        res.status(400).json(vditorError(`fetch failed: ${r.status}`).body);
        return;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_BYTES) {
        res.status(400).json(vditorError("image too large").body);
        return;
      }
      const ct = r.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
      if (!ct.startsWith("image/")) {
        res.status(400).json(vditorError("response is not an image").body);
        return;
      }
      const ext = MIME_TO_EXT[ct] ?? extFromUrl(u);
      if (!ALLOWED_EXT.has(ext)) {
        res.status(400).json(vditorError("unsupported image type").body);
        return;
      }
      const id = `${crypto.randomUUID()}${ext}`;
      const cfg = getConfig();
      const dest = path.join(cfg.assetsDir, id);
      await fs.promises.writeFile(dest, buf);
      const publicPath = `/api/assets/${id}`;
      log.info("link-to-img ok visitor=%s doc=%s bytes=%d", req.visitor!.visitor_id, docId, buf.length);
      res.json(vditorLinkToImgOk(rawUrl.trim(), publicPath));
    } catch (e) {
      log.warn("link-to-img failed: %s", e instanceof Error ? e.message : String(e));
      res.status(400).json(vditorError("fetch failed").body);
    }
  });

  return router;
}
