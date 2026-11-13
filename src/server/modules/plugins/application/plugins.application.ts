import {
  getPluginInstallJob,
  startPluginInstall,
} from "../plugin-install-job.js";
import { isEngramBinaryReady } from "../engram-runtime.js";
import { isMemorixHttpUp } from "../memorix-runtime.js";
import { listPlugins, uninstallPlugin } from "../plugins-store.js";
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
} from "../pipeline/catalog.js";
import { listStepDefinitions } from "../pipeline/step-definitions.js";
import { pluginDataDir, pluginHomeDir } from "../plugin-paths.js";
import {
  getLatestPipelineJob,
  getPipelineJob,
  startPipelineJob,
  type PipelineJobAction,
} from "../pipeline-job.js";
import { listPipelineHistory, listPipelineInstalls } from "../installed-store.js";
import type { PipelineInstallMode, PipelineOutput } from "../pipeline/types.js";
import { PluginError, toPluginError } from "../plugin-error.js";

export type PipelineScope = "system" | "tenant";

export function parsePipelineScope(scope: string): PipelineScope {
  if (scope === "system" || scope === "tenant") return scope;
  throw new PluginError("BAD_REQUEST", "bad scope", 400);
}

async function runtimeRunningFor(pluginId: string, installed: boolean): Promise<boolean> {
  if (!installed) return false;
  if (pluginId === "engram") return isEngramBinaryReady();
  if (pluginId === "memorix") return isMemorixHttpUp();
  return false;
}

function enrichPipelineList(visitorId: string) {
  const installs = listPipelineInstalls();
  const enrich = (pipe: ReturnType<typeof listSystemPipelines>[number]) => {
    const install = installs.find((r) => r.id === pipe.id) ?? null;
    const running = pipe.runtime === "engram" && Boolean(install) && isEngramBinaryReady();
    return {
      ...pipe,
      installed: Boolean(install),
      installedAt: install?.installedAt ?? null,
      mcpServerId: install?.mcpServerId ?? null,
      runtimeRunning: running,
      installJob: getLatestPipelineJob(visitorId, pipe.id),
      storage: {
        installDir: pluginHomeDir(pipe.id),
        dataDir:
          pipe.dataKey && visitorId ? pluginDataDir(pipe.dataKey, visitorId) : null,
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

export async function listLegacyPluginsCatalog() {
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
  return { plugins };
}

export function listPipelinesMarketplace(visitorId: string) {
  ensureSystemPipelinesSeeded();
  return enrichPipelineList(visitorId);
}

export function listPluginStepDefinitions() {
  return listStepDefinitions();
}

export function getSystemPipelineDefaultYaml(id: string) {
  try {
    return { id, yaml: readSystemPipelineDefaultYaml(id) };
  } catch (err) {
    throw toPluginError(err);
  }
}

export function startPipelineInstallJob(
  scopeRaw: string,
  id: string,
  visitorId: string,
) {
  try {
    const scope = parsePipelineScope(scopeRaw);
    const pipeline = loadPipeline(scope, id, visitorId);
    const job = startPipelineJob({ pipeline, scope, action: "install", visitorId });
    return { job };
  } catch (err) {
    throw toPluginError(err);
  }
}

export function startPipelineUninstallJob(
  scopeRaw: string,
  id: string,
  visitorId: string,
) {
  try {
    const scope = parsePipelineScope(scopeRaw);
    const pipeline = loadPipeline(scope, id, visitorId);
    const job = startPipelineJob({ pipeline, scope, action: "uninstall", visitorId });
    return { job };
  } catch (err) {
    throw toPluginError(err);
  }
}

export function getPipelineJobStatus(
  scopeRaw: string,
  id: string,
  visitorId: string,
  action?: PipelineJobAction,
) {
  try {
    parsePipelineScope(scopeRaw);
    const job =
      action === "install" || action === "uninstall"
        ? getPipelineJob(visitorId, id, action)
        : getLatestPipelineJob(visitorId, id);
    return { job };
  } catch (err) {
    throw toPluginError(err);
  }
}

export function getPipelineYaml(scopeRaw: string, id: string, visitorId: string) {
  try {
    const scope = parsePipelineScope(scopeRaw);
    const yaml = readPipelineYaml(scope, id, visitorId);
    return { id, scope, yaml };
  } catch (err) {
    throw toPluginError(err);
  }
}

export function putPipelineYaml(
  scopeRaw: string,
  id: string,
  yaml: string,
  visitorId: string,
) {
  try {
    const scope = parsePipelineScope(scopeRaw);
    const parsed = writePipelineYaml(scope, id, yaml, visitorId);
    return { id, scope, pipeline: parsed };
  } catch (err) {
    throw toPluginError(err);
  }
}

export function resetSystemPipelineYaml(id: string) {
  try {
    const yaml = resetSystemPipeline(id);
    return { id, scope: "system" as const, yaml };
  } catch (err) {
    throw toPluginError(err);
  }
}

export function createCustomPipeline(
  visitorId: string,
  input: {
    name?: string;
    installMode?: PipelineInstallMode;
    outputs?: PipelineOutput[];
  },
) {
  try {
    const name = input.name?.trim() ?? "";
    return createVisitorPipeline(visitorId, {
      ...(name ? { name } : {}),
      ...(input.installMode ? { installMode: input.installMode } : {}),
      ...(input.outputs?.length ? { outputs: input.outputs } : {}),
    });
  } catch (err) {
    throw toPluginError(err);
  }
}

export function removeCustomPipeline(visitorId: string, id: string) {
  try {
    deleteVisitorPipeline(visitorId, id);
    return { ok: true as const };
  } catch (err) {
    throw toPluginError(err);
  }
}

export function startLegacyPluginInstall(
  id: string,
  headers?: Record<string, string>,
) {
  try {
    const job = startPluginInstall(id, { headers });
    return { job };
  } catch (err) {
    throw toPluginError(err);
  }
}

export async function uninstallLegacyPlugin(id: string) {
  try {
    const plugin = await uninstallPlugin(id);
    return { plugin: { ...plugin, runtimeRunning: false } };
  } catch (err) {
    throw toPluginError(err);
  }
}
