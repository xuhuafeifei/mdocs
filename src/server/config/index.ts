import os from "node:os";
import path from "node:path";

export interface AppConfig {
  host: string;
  port: number;
  dataDir: string;
  dbFile: string;
  filesDir: string;
  docsDir: string;
  assetsDir: string;
  logsDir: string;
  webDistDir: string;
  logging: LoggingConfig;
  defaultDomainId: string;
}

export interface LoggingConfig {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
  consoleLevel: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
  consoleStyle: "pretty" | "common" | "json";
  retentionDays: number;
  maxFileBytes: number;
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;

  const dataDir = process.env.MDOCS_DATA_DIR?.trim()
    ? path.resolve(process.env.MDOCS_DATA_DIR)
    : path.join(os.homedir(), ".mdocs");

  const host = process.env.MDOCS_HOST?.trim() || "127.0.0.1";
  const port = process.env.MDOCS_PORT ? Number(process.env.MDOCS_PORT) : 4000;

  const logging: LoggingConfig = {
    level: parseLevel(process.env.MDOCS_LOG_LEVEL, "info"),
    consoleLevel: parseLevel(process.env.MDOCS_CONSOLE_LEVEL, "info"),
    consoleStyle: parseStyle(process.env.MDOCS_CONSOLE_STYLE, "pretty"),
    retentionDays: Number(process.env.MDOCS_LOG_RETENTION_DAYS ?? 14),
    maxFileBytes: Number(process.env.MDOCS_LOG_MAX_BYTES ?? 5 * 1024 * 1024),
  };

  cached = {
    host,
    port,
    dataDir,
    dbFile: path.join(dataDir, "sqlite", "data.sqlite"),
    filesDir: path.join(dataDir, "files"),
    docsDir: path.join(dataDir, "files", "docs"),
    assetsDir: path.join(dataDir, "files", "assets"),
    logsDir: path.join(dataDir, "logs"),
    webDistDir: path.resolve(process.cwd(), "dist/web"),
    logging,
    defaultDomainId: "default",
  };
  return cached;
}

function parseLevel(raw: string | undefined, fallback: LoggingConfig["level"]): LoggingConfig["level"] {
  const allowed: LoggingConfig["level"][] = [
    "trace",
    "debug",
    "info",
    "warn",
    "error",
    "fatal",
    "silent",
  ];
  if (!raw) return fallback;
  const lower = raw.toLowerCase() as LoggingConfig["level"];
  return allowed.includes(lower) ? lower : fallback;
}

function parseStyle(raw: string | undefined, fallback: LoggingConfig["consoleStyle"]): LoggingConfig["consoleStyle"] {
  const allowed: LoggingConfig["consoleStyle"][] = ["pretty", "common", "json"];
  if (!raw) return fallback;
  const lower = raw.toLowerCase() as LoggingConfig["consoleStyle"];
  return allowed.includes(lower) ? lower : fallback;
}
