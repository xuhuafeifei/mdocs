import { Router, type Request, type Response } from "express";
import {
  getPluginInstallJob,
  startPluginInstall,
} from "../plugins/plugin-install-job.js";
import { isEngramBinaryReady } from "../plugins/engram-runtime.js";
import { isMemorixHttpUp } from "../plugins/memorix-runtime.js";
import {
  listPlugins,
  uninstallPlugin,
} from "../plugins/plugins-store.js";
import {
  createVisitorPipeline,
  deleteVisitorPipeline,
  ensureSystemPipelinesSeeded,
  listSystemPipelines,
  listVisitorPipelines,
  loadPipeline,
  readPipelineYaml,
  readSystemPipelineDefaultYaml,
  resetSystemPipeline,
  writePipelineYaml,
} from "../plugins/pipeline/catalog.js";
import { listStepDefinitions } from "../plugins/pipeline/step-definitions.js";
import { generatePipelineDraft } from "../plugins/pipeline/ai-draft.js";
import { pluginDataDir, pluginInstallDir } from "../plugins/plugin-paths.js";
import {
  getLatestPipelineJob,
  getPipelineJob,
  startPipelineJob,
  type PipelineJobAction,
} from "../plugins/pipeline-job.js";
import { listPipelineHistory, listPipelineInstalls } from "../plugins/installed-store.js";
import { isPipelineInstallMode } from "../plugins/pipeline/types.js";

async function runtimeRunningFor(pluginId: string, installed: boolean): Promise<boolean> {
  if (!installed) return false;
  if (pluginId === "engram") return isEngramBinaryReady();
  if (pluginId === "memorix") return isMemorixHttpUp();
  return false;
}

function errorResponse(res: Response, err: unknown, fallbackStatus = 400): void {
  const message = err instanceof Error ? err.message : String(err);
  const status =
    message === "pipeline not found" || message === "no default pipeline"
      ? 404
      : fallbackStatus;
  res.status(status).json({
    error: { code: status === 404 ? "NOT_FOUND" : "BAD_REQUEST", message },
  });
}

function scopeOf(req: Request): "system" | "tenant" | null {
  const scope = String(req.params.scope ?? "");
  return scope === "system" || scope === "tenant" ? scope : null;
}

function visitorIdOf(req: Request): string {
  return req.visitor?.visitor_id ?? "";
}

function enrichPipelineList(visitorId: string) {
  const installs = listPipelineInstalls();
  const enrich = (pipe: ReturnType<typeof listSystemPipelines>[number]) => {
    const install = installs.find((r) => r.id === pipe.id) ?? null;
    // 只有 Engram 有明确的本机就绪判定；其它 MCP 不做额外探测，避免假装“运行中”。
    const running = pipe.runtime === "engram" && Boolean(install) && isEngramBinaryReady();
    return {
      ...pipe,
      installed: Boolean(install),
      installedAt: install?.installedAt ?? null,
      mcpServerId: install?.mcpServerId ?? null,
      runtimeRunning: running,
      installJob: getLatestPipelineJob(visitorId, pipe.id),
      storage: {
        installDir: pluginInstallDir(pipe.id),
        dataDir: pipe.dataKey ? pluginDataDir(pipe.dataKey) : null,
        soulFiles: pipe.soulFiles.map((file) => `soul/${file}`),
      },
    };
  };
  return {
    system: listSystemPipelines().map(enrich),
    custom: listVisitorPipelines(visitorId).map(enrich),
    history: listPipelineHistory(),
  };
}

export function buildPluginsRouter(): ReturnType<typeof Router> {
  const router = Router();

  // ---- 旧 catalog（Engram / Memorix 硬编码安装）；新 UI 不使用 ----
  router.get("/", async (_req: Request, res: Response) => {
    ensureSystemPipelinesSeeded();
    const plugins = await Promise.all(
      listPlugins()
        .filter((p) => p.id !== "memorix")
        .map(async (plugin) => ({
          ...plugin,
          runtimeRunning: await runtimeRunningFor(plugin.id, plugin.installed),
          installJob: getPluginInstallJob(plugin.id),
        })),
    );
    res.json({ data: { plugins } });
  });

  // ---- 插件市场：流水线列表（含安装态 / 存储 / 任务）----
  router.get("/pipelines", (req: Request, res: Response) => {
    ensureSystemPipelinesSeeded();
    res.json({ data: enrichPipelineList(visitorIdOf(req)) });
  });

  router.get("/step-definitions", (_req: Request, res: Response) => {
    res.json({ data: listStepDefinitions() });
  });

  // ---- 内嵌 AI 草稿（实验）----
  router.post("/pipelines/ai/draft", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        prompt?: unknown;
        kind?: unknown;
        installMode?: unknown;
        currentYaml?: unknown;
      };
      const visitorId = visitorIdOf(req);
      if (!visitorId) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "auth required" } });
        return;
      }
      const draft = await generatePipelineDraft({
        visitorId,
        prompt: String(body.prompt ?? ""),
        ...(body.kind === "skill" || body.kind === "mcp"
          ? { kind: body.kind as "skill" | "mcp" }
          : {}),
        ...(typeof body.installMode === "string"
          ? { installMode: body.installMode }
          : {}),
        ...(typeof body.currentYaml === "string"
          ? { currentYaml: body.currentYaml }
          : {}),
      });
      res.json({ data: draft });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "missing_model_config") {
        res.status(409).json({
          error: {
            code: "MISSING_MODEL_CONFIG",
            message: "请先在「智能助手 → 模型配置」里配置可用模型",
          },
        });
        return;
      }
      errorResponse(res, err);
    }
  });

  router.get("/pipelines/system/:id/default", (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? "").trim();
      res.json({ data: { id, yaml: readSystemPipelineDefaultYaml(id) } });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  // ---- 安装 / 卸载 / 任务 ----
  router.post("/pipelines/:scope/:id/install", (req: Request, res: Response) => {
    try {
      const scope = scopeOf(req);
      if (!scope) throw new Error("bad scope");
      const id = String(req.params.id ?? "").trim();
      const visitorId = visitorIdOf(req);
      const pipeline = loadPipeline(scope, id, visitorId);
      const job = startPipelineJob({
        pipeline,
        scope,
        action: "install",
        visitorId,
      });
      res.status(202).json({ data: { job } });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  router.post("/pipelines/:scope/:id/uninstall", (req: Request, res: Response) => {
    try {
      const scope = scopeOf(req);
      if (!scope) throw new Error("bad scope");
      const id = String(req.params.id ?? "").trim();
      const visitorId = visitorIdOf(req);
      const pipeline = loadPipeline(scope, id, visitorId);
      const job = startPipelineJob({
        pipeline,
        scope,
        action: "uninstall",
        visitorId,
      });
      res.status(202).json({ data: { job } });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  router.get("/pipelines/:scope/:id/job", (req: Request, res: Response) => {
    try {
      const scope = scopeOf(req);
      if (!scope) throw new Error("bad scope");
      const id = String(req.params.id ?? "").trim();
      const visitorId = visitorIdOf(req);
      const actionParam = String(req.query.action ?? "");
      const job =
        actionParam === "install" || actionParam === "uninstall"
          ? getPipelineJob(visitorId, id, actionParam as PipelineJobAction)
          : getLatestPipelineJob(visitorId, id);
      res.json({ data: { job } });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  // ---- 流水线 YAML CRUD ----
  router.get("/pipelines/:scope/:id", (req: Request, res: Response) => {
    try {
      const scope = scopeOf(req);
      if (!scope) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "bad scope" } });
        return;
      }
      const id = String(req.params.id ?? "").trim();
      const yaml = readPipelineYaml(scope, id, visitorIdOf(req));
      res.json({ data: { id, scope, yaml } });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  router.put("/pipelines/:scope/:id", (req: Request, res: Response) => {
    try {
      const scope = scopeOf(req);
      if (!scope) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "bad scope" } });
        return;
      }
      const id = String(req.params.id ?? "").trim();
      const yaml = String((req.body as { yaml?: unknown })?.yaml ?? "");
      if (!yaml.trim()) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "yaml required" } });
        return;
      }
      const parsed = writePipelineYaml(scope, id, yaml, visitorIdOf(req));
      res.json({ data: { id, scope, pipeline: parsed } });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  router.post("/pipelines/system/:id/reset", (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? "").trim();
      const yaml = resetSystemPipeline(id);
      res.json({ data: { id, scope: "system", yaml } });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  router.post("/pipelines/custom", (req: Request, res: Response) => {
    try {
      if (!req.visitor) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "auth required" } });
        return;
      }
      const body = (req.body ?? {}) as {
        name?: unknown;
        installMode?: unknown;
        outputs?: unknown;
      };
      const name = String(body.name ?? "").trim();
      const installMode =
        typeof body.installMode === "string" && isPipelineInstallMode(body.installMode)
          ? body.installMode
          : undefined;
      const outputs = Array.isArray(body.outputs)
        ? body.outputs
            .map((o) => String(o))
            .filter((o): o is "mcp" | "skill" => o === "mcp" || o === "skill")
        : undefined;
      const created = createVisitorPipeline(req.visitor.visitor_id, {
        ...(name ? { name } : {}),
        ...(installMode ? { installMode } : {}),
        ...(outputs?.length ? { outputs } : {}),
      });
      res.status(201).json({ data: created });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  router.delete("/pipelines/custom/:id", (req: Request, res: Response) => {
    try {
      if (!req.visitor) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "auth required" } });
        return;
      }
      const id = String(req.params.id ?? "").trim();
      deleteVisitorPipeline(req.visitor.visitor_id, id);
      res.json({ data: { ok: true } });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  // ---- 旧 catalog 安装（兼容，不删）----
  router.post("/:id/install", async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? "").trim();
      const body = (req.body ?? {}) as { headers?: unknown };
      const headers =
        body.headers &&
        typeof body.headers === "object" &&
        !Array.isArray(body.headers)
          ? (body.headers as Record<string, string>)
          : undefined;
      const job = startPluginInstall(id, { headers });
      res.status(202).json({ data: { job } });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  router.post("/:id/uninstall", async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? "").trim();
      const plugin = await uninstallPlugin(id);
      res.json({
        data: { plugin: { ...plugin, runtimeRunning: false } },
      });
    } catch (err) {
      errorResponse(res, err);
    }
  });

  return router;
}
