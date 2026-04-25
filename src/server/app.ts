import fs from "node:fs";
import path from "node:path";
import express, { type Application } from "express";
import { getConfig } from "./config/index.js";
import { getDb } from "./db/connection.js";
import { authMiddleware } from "./identity/auth.middleware.js";
import { buildVisitorsRouter } from "./routes/visitors.routes.js";
import { buildDocumentsRouter } from "./routes/documents.routes.js";
import { buildTreeRouter } from "./routes/tree.routes.js";
import { buildDomainsRouter } from "./routes/domains.routes.js";
import { buildAssetsUploadRouter, serveAssetFile } from "./routes/assets.routes.js";
import { useLogger } from "./logger/logger.js";

const log = useLogger("app");

export function buildApp(): Application {
  const cfg = getConfig();
  ensureRuntimeDirs();
  getDb();

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });

  app.get("/api/assets/:assetId", (req, res) => {
    serveAssetFile(req, res);
  });

  app.use("/api", authMiddleware);
  app.use("/api/assets", buildAssetsUploadRouter());
  app.use("/api/visitors", buildVisitorsRouter());
  app.use("/api/documents", buildDocumentsRouter());
  app.use("/api/tree", buildTreeRouter());
  app.use("/api/domains", buildDomainsRouter());

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "api not found" } });
  });

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

function ensureRuntimeDirs(): void {
  const cfg = getConfig();
  for (const dir of [cfg.dataDir, cfg.filesDir, cfg.docsDir, cfg.assetsDir, cfg.logsDir]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}
