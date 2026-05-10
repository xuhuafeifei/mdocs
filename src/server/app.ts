import fs from "node:fs";
import path from "node:path";
import express, { type Application } from "express";
import cookieParser from "cookie-parser";
import { getConfig } from "./config/index.js";
import { getDb } from "./db/connection.js";
import { authMiddleware } from "./identity/auth.middleware.js";
import { buildVisitorsRouter } from "./routes/visitors.routes.js";
import { buildDocumentsRouter } from "./routes/documents.routes.js";
import { buildTreeRouter } from "./routes/tree.routes.js";
import { buildDomainsRouter } from "./routes/domains.routes.js";
import { buildDomainMemberTemplatesRouter } from "./routes/domain-member-templates.routes.js";
import { buildFoldersRouter } from "./routes/folders.routes.js";
import { buildCliTokensRouter } from "./routes/cli-tokens.routes.js";
import { buildBookmarksRouter } from "./routes/bookmarks.routes.js";
import { documentCommentsRouter } from "./routes/document-comments.routes.js";
import { buildAssetsUploadRouter, serveAssetFile } from "./routes/assets.routes.js";
import { startIndexTimer } from "./search/document-index-manager.js";
import { useLogger } from "./logger/logger.js";

const log = useLogger("app");

/**
 * 构建并配置 Express 应用实例。
 * 包括：创建运行时目录、初始化数据库、挂载中间件与路由、配置静态文件服务。
 */
export function buildApp(): Application {
  const cfg = getConfig();
  ensureRuntimeDirs();
  getDb();
  // 启动 FTS5 全文索引定时重建
  startIndexTimer();

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32mb" }));
  app.use(cookieParser());

  // 健康检查端点，无需认证
  app.get("/api/health", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });

  // 资源文件读取端点，无需认证
  app.get("/api/assets/:assetId", (req, res) => {
    serveAssetFile(req, res);
  });

  // 后续 /api 路由均需经过身份认证
  app.use("/api", authMiddleware);
  app.use("/api/assets", buildAssetsUploadRouter());
  app.use("/api/visitors", buildVisitorsRouter());
  app.use("/api/documents", buildDocumentsRouter());
  app.use("/api/tree", buildTreeRouter());
  app.use("/api/domains", buildDomainsRouter());
  app.use("/api/domain-member-templates", buildDomainMemberTemplatesRouter());
  app.use("/api/folders", buildFoldersRouter());
  app.use("/api/cli", buildCliTokensRouter());
  app.use("/api/bookmarks", buildBookmarksRouter());
  app.use("/api/documents", documentCommentsRouter);

  // 兜底：未匹配到的 API 路径返回 404
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "api not found" } });
  });

  // 若前端构建产物存在，则提供静态文件服务与单页应用回退
  if (fs.existsSync(cfg.webDistDir)) {
    app.use(express.static(cfg.webDistDir));
    app.get("*", (_req, res) => {
      const indexHtml = path.join(cfg.webDistDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).end();
      }
    });
  } else {
    log.warn("web dist dir not found: %s", cfg.webDistDir);
  }

  return app;
}

/** 确保运行时所需的各目录已存在，按 0o700 权限递归创建。 */
function ensureRuntimeDirs(): void {
  const cfg = getConfig();
  for (const dir of [cfg.dataDir, cfg.filesDir, cfg.docsDir, cfg.assetsDir, cfg.logsDir]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}
