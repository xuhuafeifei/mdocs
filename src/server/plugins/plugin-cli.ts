/**
 * 插件 CLI：白名单命令 + 相对路径，前缀由系统解析到 plugins-home / plugins-data。
 * Agent 禁止传绝对路径、~、..。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  normalizePluginName,
  pluginHomeDir,
  visitorPluginDataDir,
} from "./plugin-paths.js";

export const PLUGIN_CLI_COMMANDS = [
  "python3",
  "python",
  "node",
  "npm",
  "npx",
  "uv",
  "uvx",
] as const;

export type PluginCliCommand = (typeof PLUGIN_CLI_COMMANDS)[number];

const COMMAND_SET = new Set<string>(PLUGIN_CLI_COMMANDS);

export type PluginCliCwdRoot = "home" | "data";

export type RunPluginCliInput = {
  visitorId: string;
  pluginName: string;
  command: string;
  args?: string[];
  /** 相对 home 或 data 的子目录；默认根 */
  cwd?: string;
  cwdRoot?: PluginCliCwdRoot;
  timeoutSeconds?: number;
  signal?: AbortSignal;
};

export type RunPluginCliResult = {
  ok: boolean;
  exitCode: number | null;
  command: string;
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
};

function assertRelativeSegment(raw: string, label: string): string {
  const t = raw.trim();
  if (!t || t === ".") return "";
  if (path.isAbsolute(t) || t.startsWith("~") || t.includes("..")) {
    throw new Error(`${label} 只能是相对路径，禁止绝对路径 / ~ / ..`);
  }
  if (t.includes("\0")) throw new Error(`${label} 非法`);
  return t.replace(/\\/g, "/");
}

export function assertPluginCliArgs(args: string[]): string[] {
  return args.map((a, i) => {
    const s = String(a);
    // 看起来像路径的参数才校验；flags（-y、--token）放行
    if (s.startsWith("-")) return s;
    if (
      path.isAbsolute(s) ||
      s.startsWith("~") ||
      s.includes("..") ||
      /^[A-Za-z]:[\\/]/.test(s)
    ) {
      throw new Error(`args[${i}] 禁止绝对路径或 ~ / ..：请写相对 plugins-home 的路径`);
    }
    return s;
  });
}

export function resolvePluginCliCwd(input: {
  visitorId: string;
  pluginName: string;
  cwd?: string;
  cwdRoot?: PluginCliCwdRoot;
}): string {
  const name = normalizePluginName(input.pluginName);
  if (!name) throw new Error("plugin_name required");
  const rootKind = input.cwdRoot ?? "home";
  const root =
    rootKind === "data"
      ? visitorPluginDataDir(input.visitorId, name)
      : pluginHomeDir(name);
  const rel = assertRelativeSegment(input.cwd ?? "", "cwd");
  const abs = rel ? path.resolve(root, rel) : path.resolve(root);
  if (abs !== path.resolve(root) && !abs.startsWith(path.resolve(root) + path.sep)) {
    throw new Error("cwd 路径越界");
  }
  return abs;
}

export function normalizePluginCliCommand(raw: string): PluginCliCommand {
  const base = path.basename(String(raw ?? "").trim()).toLowerCase();
  if (!COMMAND_SET.has(base)) {
    throw new Error(
      `命令不在白名单：${base || "(empty)"}；允许：${PLUGIN_CLI_COMMANDS.join(", ")}`,
    );
  }
  return base as PluginCliCommand;
}

const MAX_OUT = 12_000;

function truncate(text: string, max = MAX_OUT): string {
  return text.length <= max ? text : text.slice(0, max) + "\n…(截断)";
}

/** 在 plugins-home/<name>（或 data）下执行白名单 CLI。 */
export function runPluginCli(input: RunPluginCliInput): Promise<RunPluginCliResult> {
  const command = normalizePluginCliCommand(input.command);
  const args = assertPluginCliArgs(
    Array.isArray(input.args) ? input.args.map(String) : [],
  );
  const cwd = resolvePluginCliCwd({
    visitorId: input.visitorId,
    pluginName: input.pluginName,
    cwd: input.cwd,
    cwdRoot: input.cwdRoot,
  });
  fs.mkdirSync(cwd, { recursive: true, mode: 0o700 });
  const timeoutMs = Math.min(
    120_000,
    Math.max(1_000, Math.floor((input.timeoutSeconds ?? 30) * 1000)),
  );

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: {
        PATH: process.env.PATH,
        TMPDIR: process.env.TMPDIR,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        LANG: process.env.LANG,
        LC_ALL: process.env.LC_ALL,
        HOME: cwd,
        USERPROFILE: cwd,
        MDOCS_PLUGIN_NAME: normalizePluginName(input.pluginName),
        MDOCS_PLUGIN_HOME: pluginHomeDir(input.pluginName),
        MDOCS_PLUGIN_DATA: visitorPluginDataDir(
          input.visitorId,
          input.pluginName,
        ),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout = truncate(stdout + c.toString("utf8"));
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr = truncate(stderr + c.toString("utf8"));
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("命令超时"));
    }, timeoutMs);
    const onAbort = () => child.kill();
    input.signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", (err) => {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
      resolve({
        ok: code === 0,
        exitCode: code,
        command,
        args,
        cwd,
        stdout: truncate(stdout, 6000),
        stderr: truncate(stderr, 6000),
      });
    });
  });
}

/** 列出 plugins-home/<name> 下相对路径（浅层，供 Agent 自测）。 */
export function listPluginHomeFiles(
  pluginName: string,
  relDir = ".",
  maxEntries = 80,
): { root: string; entries: string[] } {
  const root = pluginHomeDir(pluginName);
  const rel = assertRelativeSegment(relDir, "path");
  const dir = rel ? path.join(root, rel) : root;
  if (!fs.existsSync(dir)) {
    return { root, entries: [] };
  }
  const entries: string[] = [];
  const walk = (base: string, prefix: string, depth: number) => {
    if (entries.length >= maxEntries || depth > 3) return;
    let list: fs.Dirent[];
    try {
      list = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of list) {
      if (entries.length >= maxEntries) break;
      if (ent.name === ".git" || ent.name === "node_modules") continue;
      const relPath = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        entries.push(relPath + "/");
        walk(path.join(base, ent.name), relPath, depth + 1);
      } else {
        entries.push(relPath);
      }
    }
  };
  walk(dir, rel || "", 0);
  return { root, entries };
}
