/**
 * 插件安装物 / 运行时数据路径（系统写死）。
 * 见 .mdocs-docs/requirements/plugin-pipeline/设计契约.md
 */
import path from "node:path";
import { getConfig } from "../config/index.js";

/** 系统自带 Engram 流水线 id（目录名 / plugins.json 主键） */
export const SYSTEM_ENGRAM_ID = "847291036512";

export function pluginsInstallRoot(): string {
  return path.join(getConfig().dataDir, "plugins", "install");
}

export function pluginInstallDir(pluginId: string): string {
  return path.join(pluginsInstallRoot(), pluginId.trim());
}

export function pluginsDataRoot(): string {
  return path.join(getConfig().dataDir, "plugins-data");
}

/** 按 data_key（如 engram），与随机 plugin id 解耦 */
export function pluginDataDir(dataKey: string): string {
  return path.join(pluginsDataRoot(), dataKey.trim());
}

export function pluginsSystemCatalogRoot(): string {
  return path.join(getConfig().dataDir, "plugins", "system");
}
