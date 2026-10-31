/**
 * 插件路径（目录统一契约，无旧路径兼容）。
 * 见 .mdocs-docs/requirements/plugin-pipeline/设计契约-目录统一.md
 *
 * 相同：plugins-home（安装实体）
 * 不同：tenant/{vid}/plugins|plugins-data|mcp|skills
 */
import path from "node:path";
import { getConfig } from "../config/index.js";

/** 规范名：Engram（目录 / MCP 文件名 / 流水线 id） */
export const SYSTEM_ENGRAM_ID = "engram";

export function normalizePluginName(raw: string): string {
  return raw.trim();
}

// —— 全局：安装实体 ——

export function pluginsHomeRoot(): string {
  return path.join(getConfig().dataDir, "plugins-home");
}

export function pluginHomeDir(pluginId: string): string {
  return path.join(pluginsHomeRoot(), normalizePluginName(pluginId));
}

/** @deprecated 用 pluginHomeDir */
export const pluginInstallDir = pluginHomeDir;

// —— 全局：系统流水线母版 ——

export function pluginsCatalogRoot(): string {
  return path.join(getConfig().dataDir, "plugins-catalog");
}

export function pluginCatalogDir(pluginId: string): string {
  return path.join(pluginsCatalogRoot(), normalizePluginName(pluginId));
}

// —— 租户 ——

export function visitorTenantRoot(visitorId: string): string {
  return path.join(getConfig().dataDir, "tenant", visitorId.trim());
}

export function visitorPipelinesRoot(visitorId: string): string {
  return path.join(visitorTenantRoot(visitorId), "plugins");
}

export function visitorPipelineDir(visitorId: string, pluginId: string): string {
  return path.join(visitorPipelinesRoot(visitorId), normalizePluginName(pluginId));
}

export function visitorPluginsDataRoot(visitorId: string): string {
  return path.join(visitorTenantRoot(visitorId), "plugins-data");
}

export function visitorPluginDataDir(visitorId: string, pluginId: string): string {
  return path.join(
    visitorPluginsDataRoot(visitorId),
    normalizePluginName(pluginId),
  );
}

/** 插件数据目录：必须有 visitor（无全局 plugins-data） */
export function pluginDataDir(dataKey: string, visitorId: string): string {
  const vid = visitorId.trim();
  if (!vid) throw new Error("plugin data requires visitor");
  return visitorPluginDataDir(vid, dataKey);
}

export function visitorMcpDir(visitorId: string): string {
  return path.join(visitorTenantRoot(visitorId), "mcp");
}

export function visitorMcpFile(visitorId: string, pluginId: string): string {
  return path.join(visitorMcpDir(visitorId), `${normalizePluginName(pluginId)}.json`);
}

export function visitorSkillsRoot(visitorId: string): string {
  return path.join(visitorTenantRoot(visitorId), "skills");
}

export function visitorSkillDir(visitorId: string, skillName: string): string {
  return path.join(visitorSkillsRoot(visitorId), skillName.trim());
}

export function visitorSkillMdPath(visitorId: string, skillName: string): string {
  return path.join(visitorSkillDir(visitorId, skillName), "SKILL.md");
}
