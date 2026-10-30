/**
 * 灵魂目录：全局 + tenant；与 dataDir 根上的 sqlite/files 分离。
 * 见 .mdocs-docs/requirements/plugin-pipeline/设计契约.md
 */
import path from "node:path";
import { getConfig } from "../config/index.js";

export const SOUL_FILENAME = "mdocs.md";

export function globalSoulDir(): string {
  return path.join(getConfig().dataDir, "soul");
}

export function globalSoulMdocsPath(): string {
  return path.join(globalSoulDir(), SOUL_FILENAME);
}

export function visitorSoulDir(visitorId: string): string {
  return path.join(getConfig().dataDir, "tenant", visitorId, "soul");
}

export function visitorSoulMdocsPath(visitorId: string): string {
  return path.join(visitorSoulDir(visitorId), SOUL_FILENAME);
}
