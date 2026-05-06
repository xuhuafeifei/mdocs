import fs from "node:fs";
import path from "node:path";
import { format } from "node:util";
import { getConfig, type LoggingConfig } from "../config/index.js";

/** 支持的日志级别，按严重程度从低到高排列 */
export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "silent";

/** 模块日志器接口，各方法对应不同日志级别 */
export interface ModuleLogger {
  trace(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  fatal(msg: string, ...args: unknown[]): void;
}

// 日志级别权重映射，权重越高表示级别越严重
const LEVEL_WEIGHT: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 70,
};

// 默认单个日志文件大小上限：5 MB
const MAX_FILE_BYTES_DEFAULT = 5 * 1024 * 1024;
// 日志文件清理间隔：1 小时
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// 模块日志器缓存，避免重复创建
const cache = new Map<string, ModuleLogger>();
let lastCleanupAt = 0;

/**
 * 获取（或创建）指定模块名称的日志器实例。
 * 相同模块名会复用缓存的实例。
 *
 * @param moduleName - 模块名称，用于标识日志来源
 * @returns 该模块对应的日志器
 */
export function useLogger(moduleName: string): ModuleLogger {
  const key = moduleName.trim() || "app";
  const hit = cache.get(key);
  if (hit) return hit;
  const logger = buildLogger(key);
  cache.set(key, logger);
  return logger;
}

/**
 * 构建一个模块日志器实例。
 * 根据配置将日志输出到文件和控制台，支持级别过滤与样式控制。
 *
 * @param moduleName - 模块名称
 * @returns 模块日志器
 */
function buildLogger(moduleName: string): ModuleLogger {
  const emit = (level: LogLevel, msg: string, args: unknown[]) => {
    const cfg = getConfig().logging;
    // 使用 util.format 格式化消息中的占位符
    const text = args.length ? format(msg, ...args) : msg;
    const now = new Date();
    const ts = formatTimestamp(now);

    // 若日志级别满足文件输出阈值，则写入日志文件
    if (passes(level, cfg.level)) {
      try {
        writeFileLine({
          dir: getConfig().logsDir,
          dateText: formatDate(now),
          line: `[${ts}] [${level.toUpperCase()}] [${moduleName}] ${text}`,
          maxBytes: cfg.maxFileBytes || MAX_FILE_BYTES_DEFAULT,
          retentionDays: cfg.retentionDays,
        });
      } catch {
        // 日志写入失败不应影响主业务流程
      }
    }

    // 若日志级别满足控制台输出阈值，则输出到控制台
    if (passes(level, cfg.consoleLevel)) {
      writeConsole({
        style: cfg.consoleStyle,
        level,
        moduleName,
        ts,
        text,
      });
    }
  };

  return {
    trace: (m, ...a) => emit("trace", m, a),
    debug: (m, ...a) => emit("debug", m, a),
    info: (m, ...a) => emit("info", m, a),
    warn: (m, ...a) => emit("warn", m, a),
    error: (m, ...a) => emit("error", m, a),
    fatal: (m, ...a) => emit("fatal", m, a),
  };
}

/**
 * 判断给定日志级别是否达到最低输出级别。
 *
 * @param level - 当前日志级别
 * @param min - 最低允许级别
 * @returns 若 level >= min 则返回 true
 */
function passes(level: LogLevel, min: LogLevel): boolean {
  if (min === "silent") return false;
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[min];
}

/**
 * 将 Date 格式化为 YYYY-MM-DD 的日期字符串。
 *
 * @param d - 日期对象
 * @returns 日期字符串
 */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 将 Date 格式化为带毫秒的完整时间戳字符串。
 *
 * @param d - 日期对象
 * @returns 时间戳字符串，格式：YYYY-MM-DD HH:mm:ss.SSS
 */
function formatTimestamp(d: Date): string {
  const dateText = formatDate(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${dateText} ${hh}:${mm}:${ss}.${ms}`;
}

/**
 * 确保日志目录存在，不存在则递归创建，并设置权限为 0o700。
 *
 * @param dir - 目录路径
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

/**
 * 将一行日志写入文件。会自动轮转文件（按大小切分）并定期清理过期日志。
 *
 * @param params.dir - 日志目录
 * @param params.dateText - 日期文本（用于文件名）
 * @param params.line - 要写入的日志行
 * @param params.maxBytes - 单个日志文件大小上限
 * @param params.retentionDays - 日志保留天数
 */
function writeFileLine(params: {
  dir: string;
  dateText: string;
  line: string;
  maxBytes: number;
  retentionDays: number;
}): void {
  ensureDir(params.dir);
  maybeCleanup(params.dir, params.retentionDays);
  const filePath = pickWritable(params.dir, params.dateText, params.maxBytes);
  fs.appendFileSync(filePath, `${params.line}\n`, { mode: 0o600 });
}

/**
 * 挑选一个可写入的日志文件。若当前日期的日志文件达到大小上限，则按序号递增创建新文件。
 *
 * @param dir - 日志目录
 * @param dateText - 日期文本
 * @param maxBytes - 文件大小上限
 * @returns 选中的日志文件完整路径
 */
function pickWritable(dir: string, dateText: string, maxBytes: number): string {
  let index = 0;
  while (true) {
    const name =
      index === 0 ? `mdocs-${dateText}.log` : `mdocs-${dateText}-${index}.log`;
    const full = path.join(dir, name);
    if (!fs.existsSync(full)) return full;
    try {
      const s = fs.statSync(full);
      if (s.size < maxBytes) return full;
    } catch {
      return full;
    }
    index += 1;
  }
}

/**
 * 根据保留天数清理过期日志文件。清理操作受 CLEANUP_INTERVAL_MS 间隔限制，避免频繁执行。
 *
 * @param dir - 日志目录
 * @param retentionDays - 日志保留天数
 */
function maybeCleanup(dir: string, retentionDays: number): void {
  const now = Date.now();
  // 若距离上次清理不足间隔时间，则跳过
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    // 计算过期时间戳
    const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
    // 匹配 mdocs-YYYY-MM-DD.log 或 mdocs-YYYY-MM-DD-N.log 格式的日志文件
    const rx = /^mdocs-(\d{4}-\d{2}-\d{2})(?:-\d+)?\.log$/;
    for (const e of entries) {
      if (!e.isFile()) continue;
      const m = rx.exec(e.name);
      if (!m || !m[1]) continue;
      const t = new Date(`${m[1]}T00:00:00.000Z`).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= cutoff) continue;
      try {
        fs.unlinkSync(path.join(dir, e.name));
      } catch {
        // 忽略删除失败
      }
    }
  } catch {
    // 忽略读取目录失败
  }
}

/**
 * 将日志输出到控制台，支持多种输出样式：json、common、colorize。
 *
 * @param params.style - 控制台输出样式
 * @param params.level - 日志级别
 * @param params.moduleName - 模块名称
 * @param params.ts - 时间戳
 * @param params.text - 日志文本
 */
function writeConsole(params: {
  style: LoggingConfig["consoleStyle"];
  level: LogLevel;
  moduleName: string;
  ts: string;
  text: string;
}): void {
  const { style, level, moduleName, ts, text } = params;
  if (style === "json") {
    const line = JSON.stringify({ time: ts, level, module: moduleName, message: text });
    writeLevel(level, line);
    return;
  }
  const base = `[${ts}] [${level.toUpperCase()}] [${moduleName}] ${text}`;
  if (style === "common") {
    writeLevel(level, base);
    return;
  }
  writeLevel(level, colorize(level, base));
}

/**
 * 为日志文本添加 ANSI 颜色码。
 *
 * @param level - 日志级别
 * @param text - 原始日志文本
 * @returns 带颜色码的文本
 */
function colorize(level: LogLevel, text: string): string {
  const codes: Record<LogLevel, number> = {
    trace: 90,
    debug: 36,
    info: 32,
    warn: 33,
    error: 31,
    fatal: 35,
    silent: 37,
  };
  return `\u001b[${codes[level]}m${text}\u001b[0m`;
}

/**
 * 根据日志级别选择对应的 console 方法输出。
 *
 * @param level - 日志级别
 * @param line - 要输出的日志行
 */
function writeLevel(level: LogLevel, line: string): void {
  if (level === "warn") {
    console.warn(line);
  } else if (level === "error" || level === "fatal") {
    console.error(line);
  } else {
    console.log(line);
  }
}
