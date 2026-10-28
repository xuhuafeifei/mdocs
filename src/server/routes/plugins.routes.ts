import { Router, type Request, type Response } from "express";
import {
  getPluginInstallJob,
  startPluginInstall,
} from "../plugins/plugin-install-job.js";
import { isMemorixHttpUp } from "../plugins/memorix-runtime.js";
import {
  listPlugins,
  uninstallPlugin,
} from "../plugins/plugins-store.js";

export function buildPluginsRouter(): ReturnType<typeof Router> {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    const plugins = await Promise.all(
      listPlugins().map(async (plugin) => ({
        ...plugin,
        runtimeRunning: plugin.id === "memorix" && plugin.installed
          ? await isMemorixHttpUp()
          : false,
        installJob: getPluginInstallJob(plugin.id),
      })),
    );
    res.json({ data: { plugins } });
  });

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
      const message = err instanceof Error ? err.message : String(err);
      const status = message === "plugin not found" ? 404 : 400;
      res.status(status).json({
        error: { code: status === 404 ? "NOT_FOUND" : "BAD_REQUEST", message },
      });
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
      const message = err instanceof Error ? err.message : String(err);
      const status = message === "plugin not found" ? 404 : 400;
      res.status(status).json({
        error: { code: status === 404 ? "NOT_FOUND" : "BAD_REQUEST", message },
      });
    }
  });

  return router;
}
