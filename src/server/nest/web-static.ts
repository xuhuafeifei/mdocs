/**
 * 生产态前端静态资源 + SPA fallback。
 *
 * Nest 对未匹配路由会直接 404（不 next），所以静态/SPA 必须挂在 Nest 之前；
 * SPA 对 `/api` 调用 next()，把 API 交给后面的 Nest。
 */
import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import express, { type Application, type Response } from "express";
import { getConfig } from "../infra/config/index.js";
import { useLogger } from "../infra/logger/logger.js";

const log = useLogger("web-static");

const WEB_ASSET_CONTENT_TYPE: Record<string, string> = {
  ".js": "application/javascript; charset=UTF-8",
  ".mjs": "application/javascript; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=UTF-8",
  ".map": "application/json; charset=UTF-8",
  ".html": "text/html; charset=UTF-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

/** 若前端构建产物存在，则提供静态文件服务与单页应用回退 */
export function mountWebStatic(server: Application): void {
  const cfg = getConfig();
  if (!fs.existsSync(cfg.webDistDir)) {
    log.warn("web dist dir not found: %s", cfg.webDistDir);
    return;
  }

  server.use(compression());

  // 部分环境 mime 库/反代会把 .js 标成 octet-stream，浏览器拒绝 module script
  const staticOpts = {
    setHeaders: setWebAssetHeaders,
  };

  const assetsDir = path.join(cfg.webDistDir, "assets");
  if (fs.existsSync(assetsDir)) {
    server.use(
      "/assets",
      express.static(assetsDir, {
        ...staticOpts,
        maxAge: "1y",
        immutable: true,
      }),
    );
  }

  server.use(
    express.static(cfg.webDistDir, { ...staticOpts, maxAge: 0, index: false }),
  );
  // Express 5：裸 `*` 非法，须命名通配（含根路径用 `{*splat}`）
  server.get("/{*splat}", (req, res, next) => {
    // API 交给后续 Nest；勿在此处吞掉
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    // 静态资源路径勿回退成 index.html（否则会触发 MIME / 模块加载错误）
    if (looksLikeStaticAsset(req.path)) {
      res.status(404).end();
      return;
    }
    const indexHtml = path.join(cfg.webDistDir, "index.html");
    if (fs.existsSync(indexHtml)) {
      res.type("html");
      res.sendFile(indexHtml);
    } else {
      res.status(404).end();
    }
  });
}

/** Nest 路由注册完成后再挂。提前挂会把 Nest 的接口先答成 404。 */
export function mountApiNotFound(server: Application): void {
  server.use("/api", (_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "api not found" },
    });
  });
}

function setWebAssetHeaders(res: Response, filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  const ct = WEB_ASSET_CONTENT_TYPE[ext];
  if (ct) res.setHeader("Content-Type", ct);
}

function looksLikeStaticAsset(urlPath: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    WEB_ASSET_CONTENT_TYPE,
    path.extname(urlPath).toLowerCase(),
  );
}
