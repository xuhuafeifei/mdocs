import os from "node:os";
import path from "node:path";

/** 应用配置对象，包含服务运行所需的全部路径与参数。 */
export interface AppConfig {
  host: string;
  port: number;
  dataDir: string;
  dbFile: string;
  filesDir: string;
  docsDir: string;
  assetsDir: string;
  commitsDir: string;
  logsDir: string;
  webDistDir: string;
  logging: LoggingConfig;
  defaultDomainId: string;
}

/** 日志配置子对象，控制输出级别、样式与文件保留策略。 */
export interface LoggingConfig {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
  consoleLevel: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
  consoleStyle: "pretty" | "common" | "json";
  retentionDays: number;
  maxFileBytes: number;
}

let cached: AppConfig | null = null;

/**
 * 读取并缓存应用配置。
 * 优先从环境变量获取，未设置时使用默认值；首次调用后结果会被缓存。
 */
export function getConfig(): AppConfig {
  if (cached) return cached;

  // 数据目录：环境变量 > 用户主目录下的 .mdocs
  const dataDir = process.env.MDOCS_DATA_DIR?.trim()
    ? path.resolve(process.env.MDOCS_DATA_DIR)
    : path.join(os.homedir(), ".mdocs");

  // 网络监听地址与端口
  const host = process.env.MDOCS_HOST?.trim() || "127.0.0.1";
  const port = process.env.MDOCS_PORT ? Number(process.env.MDOCS_PORT) : 4000;

  // 组装日志配置
  const logging: LoggingConfig = {
    level: parseLevel(process.env.MDOCS_LOG_LEVEL, "info"),
    consoleLevel: parseLevel(process.env.MDOCS_CONSOLE_LEVEL, "info"),
    consoleStyle: parseStyle(process.env.MDOCS_CONSOLE_STYLE, "pretty"),
    retentionDays: Number(process.env.MDOCS_LOG_RETENTION_DAYS ?? 14),
    maxFileBytes: Number(process.env.MDOCS_LOG_MAX_BYTES ?? 5 * 1024 * 1024),
  };

  // 缓存完整配置对象
  cached = {
    host,
    port,
    dataDir,
    dbFile: path.join(dataDir, "sqlite", "data.sqlite"),
    filesDir: path.join(dataDir, "files"),
    docsDir: path.join(dataDir, "files", "docs"),
    assetsDir: path.join(dataDir, "files", "assets"),
    // 历史提交快照：路径仅由正文 SHA-256 决定，见 resolveCommitBlobAbsolutePath
    commitsDir: path.join(dataDir, "files", "commits"),
    logsDir: path.join(dataDir, "logs"),
    webDistDir: path.resolve(process.cwd(), "dist/web"),
    logging,
    defaultDomainId: "default",
  };
  return cached;
}

/** 将原始字符串解析为合法的日志级别，若非法则返回 fallback。 */
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

/** 将原始字符串解析为合法的日志样式，若非法则返回 fallback。 */
function parseStyle(raw: string | undefined, fallback: LoggingConfig["consoleStyle"]): LoggingConfig["consoleStyle"] {
  const allowed: LoggingConfig["consoleStyle"][] = ["pretty", "common", "json"];
  if (!raw) return fallback;
  const lower = raw.toLowerCase() as LoggingConfig["consoleStyle"];
  return allowed.includes(lower) ? lower : fallback;
}
