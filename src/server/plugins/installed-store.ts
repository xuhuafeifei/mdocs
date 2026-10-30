/**
 * 流水线安装态索引：dataDir/plugins.json 的 pipelines 段。
 * 旧 catalog（installed 段）保持兼容，互不覆盖。
 */
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../config/index.js";
import type { PipelineInstallMode, PipelineOutput } from "./pipeline/types.js";

export type PipelineInstallHistoryEntry = {
  id?: string;
  name?: string;
  action: "install" | "uninstall";
  at: string;
  ok: boolean;
  error?: string;
};

export type PipelineInstallRecord = {
  id: string;
  name: string;
  kind: "system" | "user" | "tenant";
  runtime?: string;
  installMode?: PipelineInstallMode;
  outputs: PipelineOutput[];
  installedAt: string;
  mcpServerId?: string;
  history?: PipelineInstallHistoryEntry[];
};

type PluginsFile = {
  installed?: unknown;
  pipelines?: {
    installed?: PipelineInstallRecord[];
    history?: PipelineInstallHistoryEntry[];
  };
};

function storePath(): string {
  return path.join(getConfig().dataDir, "plugins.json");
}

function readFile(): PluginsFile {
  try {
    const raw = fs.readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw) as PluginsFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFile(payload: PluginsFile): void {
  const dir = getConfig().dataDir;
  fs.mkdirSync(dir, { recursive: true });
  const target = storePath();
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, target);
}

function pipelinesSection(file: PluginsFile): NonNullable<PluginsFile["pipelines"]> {
  return file.pipelines && typeof file.pipelines === "object" ? file.pipelines : {};
}

export function listPipelineInstalls(): PipelineInstallRecord[] {
  const list = pipelinesSection(readFile()).installed;
  if (!Array.isArray(list)) return [];
  return list.filter((r) => r && typeof r.id === "string" && r.id.trim());
}

export function getPipelineInstall(id: string): PipelineInstallRecord | null {
  const want = id.trim();
  return listPipelineInstalls().find((r) => r.id === want) ?? null;
}

export function listPipelineHistory(): PipelineInstallHistoryEntry[] {
  const list = pipelinesSection(readFile()).history;
  return Array.isArray(list) ? list.filter((e) => e && typeof e.at === "string") : [];
}

function appendHistory(
  file: PluginsFile,
  entry: PipelineInstallHistoryEntry,
): PipelineInstallHistoryEntry[] {
  const pipeline = pipelinesSection(file);
  const history = Array.isArray(pipeline.history) ? pipeline.history : [];
  const next = [entry, ...history].slice(0, 50);
  file.pipelines = { ...pipeline, history: next };
  return next;
}

export function markPipelineInstalled(input: {
  id: string;
  name: string;
  kind: "system" | "user" | "tenant";
  runtime?: string;
  installMode?: PipelineInstallMode;
  outputs: PipelineOutput[];
  mcpServerId?: string;
}): PipelineInstallRecord {
  const file = readFile();
  const pipeline = pipelinesSection(file);
  const existing = Array.isArray(pipeline.installed) ? pipeline.installed : [];
  const at = new Date().toISOString();
  const record: PipelineInstallRecord = {
    id: input.id,
    name: input.name,
    kind: input.kind,
    ...(input.runtime ? { runtime: input.runtime } : {}),
    ...(input.installMode ? { installMode: input.installMode } : {}),
    outputs: input.outputs,
    installedAt: at,
    ...(input.mcpServerId ? { mcpServerId: input.mcpServerId } : {}),
    history: [
      { action: "install", at, ok: true } satisfies PipelineInstallHistoryEntry,
      ...(existing.find((r) => r.id === input.id)?.history ?? []),
    ].slice(0, 10),
  };
  file.pipelines = {
    ...pipeline,
    installed: [record, ...existing.filter((r) => r.id !== input.id)],
  };
  appendHistory(file, {
    id: input.id,
    name: input.name,
    action: "install",
    at,
    ok: true,
  });
  writeFile(file);
  return record;
}

export function markPipelineUninstalled(
  id: string,
  result: { ok: boolean; error?: string; name?: string } = { ok: true },
): void {
  const file = readFile();
  const pipeline = pipelinesSection(file);
  const existing = Array.isArray(pipeline.installed) ? pipeline.installed : [];
  const at = new Date().toISOString();
  file.pipelines = {
    ...pipeline,
    // 卸载失败时保留安装态：安装物可能还在，不能假装已卸载。
    installed: result.ok ? existing.filter((r) => r.id !== id) : existing,
  };
  appendHistory(file, {
    id,
    ...(result.name ? { name: result.name } : {}),
    action: "uninstall",
    at,
    ok: result.ok,
    ...(result.error ? { error: result.error } : {}),
  });
  writeFile(file);
}
