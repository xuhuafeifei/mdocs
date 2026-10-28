/**
 * 可持久化的服务端设置（设置页可改，落盘到 dataDir）。
 * 当前：单文件上传上限。
 */
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "./index.js";

export const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MIN_MAX_UPLOAD_BYTES = 1 * 1024 * 1024;
export const MAX_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

type ServerSettingsFile = {
  maxUploadBytes?: number;
};

let memoryOverride: number | null = null;

function settingsPath(): string {
  return path.join(getConfig().dataDir, "server-settings.json");
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function clampUploadBytes(n: number): number {
  return Math.min(MAX_MAX_UPLOAD_BYTES, Math.max(MIN_MAX_UPLOAD_BYTES, Math.floor(n)));
}

function readFileSettings(): ServerSettingsFile {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as ServerSettingsFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** 生效中的单文件上限：内存覆盖 > 落盘 > 环境变量 > 默认 100MiB */
export function getMaxUploadBytes(): number {
  if (memoryOverride != null) return memoryOverride;
  const file = readFileSettings();
  if (typeof file.maxUploadBytes === "number" && Number.isFinite(file.maxUploadBytes)) {
    return clampUploadBytes(file.maxUploadBytes);
  }
  return parsePositiveInt(process.env.MDOCS_MAX_UPLOAD_BYTES, DEFAULT_MAX_UPLOAD_BYTES);
}

export function getServerSettingsPublic(): {
  maxUploadBytes: number;
  minUploadBytes: number;
  maxUploadBytesCap: number;
  defaultUploadBytes: number;
} {
  return {
    maxUploadBytes: getMaxUploadBytes(),
    minUploadBytes: MIN_MAX_UPLOAD_BYTES,
    maxUploadBytesCap: MAX_MAX_UPLOAD_BYTES,
    defaultUploadBytes: DEFAULT_MAX_UPLOAD_BYTES,
  };
}

/** 写入 dataDir/server-settings.json，立即生效（无需重启） */
export function setMaxUploadBytes(bytes: number): number {
  const next = clampUploadBytes(bytes);
  const dir = getConfig().dataDir;
  fs.mkdirSync(dir, { recursive: true });
  const prev = readFileSettings();
  const payload: ServerSettingsFile = { ...prev, maxUploadBytes: next };
  fs.writeFileSync(settingsPath(), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  memoryOverride = next;
  return next;
}
