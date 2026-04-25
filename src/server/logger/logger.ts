import fs from "node:fs";
import path from "node:path";
import { format } from "node:util";
import { getConfig, type LoggingConfig } from "../config/index.js";

export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "silent";

export interface ModuleLogger {
  trace(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  fatal(msg: string, ...args: unknown[]): void;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 70,
};

const MAX_FILE_BYTES_DEFAULT = 5 * 1024 * 1024;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const cache = new Map<string, ModuleLogger>();
let lastCleanupAt = 0;

export function useLogger(moduleName: string): ModuleLogger {
  const key = moduleName.trim() || "app";
  const hit = cache.get(key);
  if (hit) return hit;
  const logger = buildLogger(key);
  cache.set(key, logger);
  return logger;
}

function buildLogger(moduleName: string): ModuleLogger {
  const emit = (level: LogLevel, msg: string, args: unknown[]) => {
    const cfg = getConfig().logging;
    const text = args.length ? format(msg, ...args) : msg;
    const now = new Date();
    const ts = formatTimestamp(now);

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
        // logger failure must not affect main code path
      }
    }

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

function passes(level: LogLevel, min: LogLevel): boolean {
  if (min === "silent") return false;
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[min];
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTimestamp(d: Date): string {
  const dateText = formatDate(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${dateText} ${hh}:${mm}:${ss}.${ms}`;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

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

function maybeCleanup(dir: string, retentionDays: number): void {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
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
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

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

function writeLevel(level: LogLevel, line: string): void {
  if (level === "warn") {
    console.warn(line);
  } else if (level === "error" || level === "fatal") {
    console.error(line);
  } else {
    console.log(line);
  }
}
