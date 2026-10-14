import fs from "node:fs";
import path from "node:path";
import compression from "compression";
import express, { type Application, type Response } from "express";
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
import { buildAgentRouter } from "./routes/agent.routes.js";
import { buildGraphRouter } from "./routes/graph.routes.js";
import { bootstrapAgentRuns } from "./agent/Agent/run-manager.js";
import { startIndexTimer } from "./search/document-index-manager.js";
import { ensureLocalEmbeddingModel } from "./search/embedding-model.js";
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
  // 本地 embedding 模型：后台确保文件并 load，不阻塞 listen
  ensureLocalEmbeddingModel();
  // 进程重启后：未完成的 Agent run 标为 interrupted
  bootstrapAgentRuns();

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

  // 获取评论列表：无需认证（能读文档就能看评论）
  app.get("/api/documents/:documentId/comments", async (req, res) => {
    const { documentId } = req.params;
    if (!documentId) {
      return res.status(400).json({ error: "缺少 documentId" });
    }
    try {
      const { documentCommentService } = await import("./documents/document-comment.service.js");
      const comments = await documentCommentService.getCommentsByDocumentId(documentId);
      res.json({
        data: {
          comments,
          total: comments.filter((c: any) => !c.isDeleted).length,
        },
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
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
  app.use("/api/agent", buildAgentRouter());
  app.use("/api/graph", buildGraphRouter());
  // 发表/删除评论：需要认证
  app.use("/api/documents", documentCommentsRouter);

  // 兜底：未匹配到的 API 路径返回 404
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "api not found" } });
  });

  // 若前端构建产物存在，则提供静态文件服务与单页应用回退
  if (fs.existsSync(cfg.webDistDir)) {
    app.use(compression());

    // 部分环境 mime 库/反代会把 .js 标成 octet-stream，浏览器拒绝 module script
    const staticOpts = {
      setHeaders: setWebAssetHeaders,
    };

    const assetsDir = path.join(cfg.webDistDir, "assets");
    if (fs.existsSync(assetsDir)) {
      app.use(
        "/assets",
        express.static(assetsDir, {
          ...staticOpts,
          maxAge: "1y",
          immutable: true,
        }),
      );
    }

    app.use(express.static(cfg.webDistDir, { ...staticOpts, maxAge: 0, index: false }));
    app.get("*", (req, res) => {
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
