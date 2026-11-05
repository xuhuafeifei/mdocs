/**
 * 表情包接口：列表 / 上传 / 改描述 / 删除 / 取图 / 覆盖系统库。
 * 系统库只读（可整体覆盖），租户库可增删改。
 */
import fs from "node:fs";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { getMaxUploadBytes } from "../config/server-settings.js";
import { useLogger } from "../logger/logger.js";
import {
  addTenantMeme,
  deleteTenantMeme,
  isValidMemeId,
  listMemes,
  listSystemMemes,
  listTenantMemes,
  readMemeSyncMeta,
  resolveMeme,
  DEFAULT_SYSTEM_MEME_SPEC,
  syncSystemMemesFrom,
  updateTenantMeme,
} from "../memes/store.js";

const log = useLogger("memes-route");

function visitorIdOf(req: Request): string | null {
  return req.visitor?.visitor_id ?? null;
}

function fail(res: Response, status: number, message: string) {
  res.status(status).json({ error: { code: "MEME_ERROR", message } });
}

export function buildMemesRouter(): ReturnType<typeof Router> {
  const router = Router();

  /**
   * GET /?scope=system|tenant — 默认合并列表（系统优先）
   * 管理页把两层分开取：系统库只读、租户库归当前访客。
   */
  router.get("/", (req: Request, res: Response) => {
    const visitorId = visitorIdOf(req);
    if (!visitorId) return fail(res, 401, "login required");
    const scope = String(req.query.scope ?? "").trim();
    if (scope === "system") return res.json({ data: { memes: listSystemMemes() } });
    if (scope === "tenant") return res.json({ data: { memes: listTenantMemes(visitorId) } });
    res.json({ data: { memes: listMemes(visitorId) } });
  });

  /** GET /system/meta — 最近一次系统库同步的版本/时间/张数（没同步过返回 null） */
  router.get("/system/meta", (req: Request, res: Response) => {
    const visitorId = visitorIdOf(req);
    if (!visitorId) return fail(res, 401, "login required");
    res.json({ data: { meta: readMemeSyncMeta() } });
  });

  /** GET /image/:id — 取图；<img> 同源请求自带 cookie */
  router.get("/image/:id", (req: Request, res: Response) => {
    const visitorId = visitorIdOf(req);
    if (!visitorId) return fail(res, 401, "login required");
    const found = resolveMeme(visitorId, String(req.params.id ?? ""));
    if (!found) {
      res.status(404).json({ error: { code: "MEME_NOT_FOUND", message: "meme not found" } });
      return;
    }
    res.setHeader("Content-Type", found.mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    fs.createReadStream(found.filePath).pipe(res);
  });

  /** POST / — 上传租户表情包（desc 必填，id 由服务端 roll） */
  router.post("/", (req: Request, res: Response, next) => {
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: getMaxUploadBytes(), files: 1 },
    });
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        fail(res, 400, `上传失败：${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      next();
    });
  }, (req: Request, res: Response) => {
    const visitorId = visitorIdOf(req);
    if (!visitorId) return fail(res, 401, "login required");
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) return fail(res, 400, "缺少文件字段 file");
    try {
      const entry = addTenantMeme(visitorId, {
        buffer: file.buffer,
        originalName: file.originalname,
        desc: String(req.body?.desc ?? ""),
        memeName: req.body?.meme_name ? String(req.body.meme_name) : undefined,
      });
      res.json({ data: { meme: { ...entry, source: "tenant" } } });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });

  /** PATCH /:id — 只允许改租户表情包的描述 */
  router.patch("/:id", (req: Request, res: Response) => {
    const visitorId = visitorIdOf(req);
    if (!visitorId) return fail(res, 401, "login required");
    try {
      const entry = updateTenantMeme(visitorId, String(req.params.id ?? ""), {
        desc: req.body?.desc === undefined ? undefined : String(req.body.desc),
      });
      res.json({ data: { meme: { ...entry, source: "tenant" } } });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });

  /** DELETE /:id — 删租户表情包；系统库 400 */
  router.delete("/:id", (req: Request, res: Response) => {
    const visitorId = visitorIdOf(req);
    if (!visitorId) return fail(res, 401, "login required");
    const id = String(req.params.id ?? "");
    if (!isValidMemeId(id)) return fail(res, 400, "id 非法");
    try {
      deleteTenantMeme(visitorId, id);
      res.json({ data: { deleted: true } });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });

  /**
   * POST /system/sync — 从 npm 整包覆盖系统库
   *
   * body: { spec?: string }  默认 DEFAULT_SYSTEM_MEME_SPEC
   * 一次 npm install 完成下载 + 解包，随后原子替换 <dataDir>/dsh-meme/。
   */
  router.post("/system/sync", async (req: Request, res: Response) => {
    const visitorId = visitorIdOf(req);
    if (!visitorId) return fail(res, 401, "login required");
    const spec = String(req.body?.spec ?? "").trim() || DEFAULT_SYSTEM_MEME_SPEC;
    if (spec.length > 214) return fail(res, 400, "spec 过长");
    try {
      const result = await syncSystemMemesFrom(spec);
      res.json({ data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn("系统表情包同步失败", { spec, message });
      fail(res, 400, message);
    }
  });

  return router;
}
