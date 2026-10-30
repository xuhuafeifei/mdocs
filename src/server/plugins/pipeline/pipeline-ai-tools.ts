/**
 * 内嵌流水线 Agent 的工具集：exec / download / fetch / list / read / submit。
 * 独立于 mdocs 智能助手：无 session、无 Agent 框架，只在临时工作区内探测。
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { parsePipelineYaml } from "./parse.js";

export type PipelineAiToolTrace = {
  tool: string;
  summary: string;
  ok: boolean;
  durationMs: number;
};

export type PipelineAiToolContext = {
  workspace: string;
  deadline: number;
  trace: PipelineAiToolTrace[];
  /** 当前编排中的流水线：AI 只能改它，不能偷偷换成新插件 */
  expectedId?: string;
  expectedKind?: string;
};

export type PipelineAiToolResult = {
  ok: boolean;
  text: string;
  /** submit_pipeline 校验通过时 */
  submittedYaml?: string;
};

export type ToolJsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type PipelineAiToolDef = {
  name: string;
  description: string;
  parameters: ToolJsonSchema;
};

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const MAX_TOOL_OUTPUT = 12_000;

export const PIPELINE_AI_TOOL_DEFS: PipelineAiToolDef[] = [
  {
    name: "exec",
    description:
      "在临时工作区执行命令（不经 shell），只用于探测：验证 npx/node/tar 是否存在、查看下载包内容、运行 --version。不要执行安装命令或修改用户目录。",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "可执行文件，例如 npx、tar、node" },
        args: {
          type: "array",
          items: { type: "string" },
          description: "参数数组，不拼 shell",
        },
        cwd: {
          type: "string",
          description: "相对临时工作区的目录；默认工作区根",
        },
        timeout_seconds: {
          type: "number",
          description: "1-30 秒，默认 15",
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
  {
    name: "download",
    description:
      "下载一个公开 http(s) 文件到临时工作区（最多 50MB），返回相对路径、大小与 SHA256 前缀。用于检查安装包，不会安装。",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "公开 http(s) URL" },
        filename: { type: "string", description: "可选保存文件名" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "fetch_page",
    description:
      "抓取一个公开网页并转成纯文本（最多约 12k 字符）。用于阅读 README、release 说明、MCP 文档。",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "公开 http(s) URL" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "list_dir",
    description: "列出临时工作区（或其中子目录）的文件。",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "相对工作区的目录；默认根" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "read_file",
    description:
      "读取临时工作区内的文本文件（最多 20k 字符）。可用于查看下载包里的 README / 配置，不要读二进制。",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "相对工作区的文件路径" },
        max_chars: { type: "number", description: "最多读取字符数，默认 8000" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "submit_pipeline",
    description:
      "提交最终 pipeline.yaml。只有校验通过才会结束任务；校验失败会在工具结果里返回错误，请修正后再次提交。",
    parameters: {
      type: "object",
      properties: {
        yaml: { type: "string", description: "完整 YAML 文本，不要 markdown 围栏" },
        notes: {
          type: "string",
          description: "可选：给用户的简短说明（安装方式 / 风险）",
        },
      },
      required: ["yaml"],
      additionalProperties: false,
    },
  },
];

export function createPipelineAiWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-pipeline-ai-"));
}

export function cleanupPipelineAiWorkspace(workspace: string): void {
  try {
    fs.rmSync(workspace, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function safeResolve(workspace: string, rel: string): string {
  const root = path.resolve(workspace);
  const target = path.resolve(root, rel || ".");
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("路径越界：只能访问临时工作区");
  }
  return target;
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^A-Za-z0-9._-]+/g, "_");
  return base && base !== "." && base !== ".." ? base.slice(0, 120) : "download.bin";
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") return true;
  if (host === "0.0.0.0") return true;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

async function fetchPublic(
  raw: string,
  init: RequestInit,
  maxRedirects = 3,
): Promise<{ res: Response; url: URL }> {
  let current = assertPublicUrl(raw);
  for (let i = 0; i <= maxRedirects; i += 1) {
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("重定向缺少 Location");
      current = assertPublicUrl(new URL(location, current).toString());
      continue;
    }
    return { res, url: current };
  }
  throw new Error("重定向次数过多");
}

export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL 无效");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只允许 http(s) URL");
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error("不允许访问内网 / 本机地址");
  }
  return url;
}

const DENIED_COMMANDS = new Set([
  "sudo",
  "su",
  "shutdown",
  "reboot",
  "halt",
  "mkfs",
  "diskutil",
  "dd",
  "mount",
  "umount",
  "kill",
  "pkill",
  "killall",
  "launchctl",
  "systemctl",
  "rm",
  "sh",
  "bash",
  "zsh",
  "env",
]);

function assertSafeCommand(command: string): void {
  const base = path.basename(command).toLowerCase();
  if (DENIED_COMMANDS.has(base)) {
    throw new Error("该命令在 AI 工具中被禁用：" + base);
  }
}

function assertNoInstallCommand(command: string, args: string[]): void {
  const text = [path.basename(command), ...args].join(" ").toLowerCase();
  const patterns: RegExp[] = [
    /^(npm|pnpm|yarn)\s+(install|i|add|ci)\b/,
    /^pip3?\s+install\b/,
    /^uv\s+(pip\s+)?install\b/,
    /^brew\s+install\b/,
    /^(apt|apt-get|dnf|yum|apk)\s+install\b/,
    /^cargo\s+install\b/,
    /^go\s+install\b/,
    /(^|\s)(curl|wget)\b[\s\S]*\|\s*(sh|bash|zsh)\b/,
  ];
  if (patterns.some((p) => p.test(text))) {
    throw new Error("AI 翻译阶段不允许安装命令；安装由流水线执行器完成");
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function truncate(text: string, max = MAX_TOOL_OUTPUT): string {
  return text.length <= max ? text : text.slice(0, max) + "\n…(截断)";
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function runExec(
  ctx: PipelineAiToolContext,
  args: Record<string, unknown>,
): Promise<PipelineAiToolResult> {
  const command = String(args.command ?? "").trim();
  if (!command) throw new Error("command 为空");
  assertSafeCommand(command);
  const rawArgs = Array.isArray(args.args) ? args.args.map(String) : [];
  assertNoInstallCommand(command, rawArgs);
  const cwd = safeResolve(ctx.workspace, String(args.cwd ?? "."));
  if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });
  const timeoutSeconds = clamp(Number(args.timeout_seconds ?? 15), 1, 30);
  const timeoutMs = Math.min(timeoutSeconds * 1000, Math.max(1000, ctx.deadline - Date.now()));

  const allowedEnv = [
    "PATH",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "SHELL",
    "USER",
    "LOGNAME",
    "SystemRoot",
    "ComSpec",
    "PATHEXT",
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowedEnv) {
    if (process.env[key]) env[key] = process.env[key];
  }
  // 不把服务端环境变量（API key 等）交给 AI 命令；HOME 也收敛到临时工作区。
  env.HOME = ctx.workspace;
  env.USERPROFILE = ctx.workspace;
  env.XDG_CACHE_HOME = path.join(ctx.workspace, ".cache");
  env.npm_config_cache = path.join(ctx.workspace, ".npm");
  env.MDOCS_PIPELINE_AI = "1";

  return new Promise((resolve, reject) => {
    const child = spawn(command, rawArgs, {
      cwd,
      shell: false,
      windowsHide: true,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = truncate(stdout + chunk.toString("utf8"));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = truncate(stderr + chunk.toString("utf8"));
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("命令超时"));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        text: truncate(
          JSON.stringify(
            {
              command,
              args: rawArgs,
              exitCode: code,
              stdout: truncate(stdout, 6000),
              stderr: truncate(stderr, 6000),
            },
            null,
            2,
          ),
        ),
      });
    });
  });
}

async function downloadFile(
  ctx: PipelineAiToolContext,
  args: Record<string, unknown>,
): Promise<PipelineAiToolResult> {
  const url = assertPublicUrl(String(args.url ?? ""));
  const dir = path.join(ctx.workspace, "downloads");
  fs.mkdirSync(dir, { recursive: true });
  const name = sanitizeFilename(
    String(args.filename ?? "") || path.basename(url.pathname) || "download.bin",
  );
  let target = path.join(dir, name);
  if (fs.existsSync(target)) {
    target = path.join(dir, Date.now() + "-" + name);
  }
  const { res } = await fetchPublic(url.toString(), {
    signal: AbortSignal.timeout(60_000),
    headers: { "user-agent": "mdocs-pipeline-ai/1.0" },
  });
  if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_DOWNLOAD_BYTES) {
    throw new Error("文件超过 50MB 限制");
  }
  let total = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      total += chunk.length;
      if (total > MAX_DOWNLOAD_BYTES) {
        cb(new Error("文件超过 50MB 限制"));
        return;
      }
      cb(null, chunk);
    },
  });
  await streamPipeline(
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
    limiter,
    createWriteStream(target),
  );
  const hash = crypto.createHash("sha256");
  await streamPipeline(fs.createReadStream(target), hash);
  const rel = path.relative(ctx.workspace, target);
  return {
    ok: true,
    text: JSON.stringify(
      {
        path: rel,
        bytes: total,
        sha256: hash.digest("hex").slice(0, 16),
        contentType: res.headers.get("content-type") ?? null,
      },
      null,
      2,
    ),
  };
}

async function fetchPage(
  _ctx: PipelineAiToolContext,
  args: Record<string, unknown>,
): Promise<PipelineAiToolResult> {
  const url = assertPublicUrl(String(args.url ?? ""));
  const { res } = await fetchPublic(url.toString(), {
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": "mdocs-pipeline-ai/1.0" },
  });
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  const body = /html/i.test(contentType) ? htmlToText(raw) : raw;
  return {
    ok: res.ok,
    text: JSON.stringify(
      {
        url: url.toString(),
        status: res.status,
        contentType,
        text: truncate(body, 12_000),
      },
      null,
      2,
    ),
  };
}

function listDir(
  ctx: PipelineAiToolContext,
  args: Record<string, unknown>,
): PipelineAiToolResult {
  const dir = safeResolve(ctx.workspace, String(args.path ?? "."));
  if (!fs.existsSync(dir)) throw new Error("目录不存在");
  const entries = fs.readdirSync(dir, { withFileTypes: true }).slice(0, 200).map((ent) => {
    const full = path.join(dir, ent.name);
    let size: number | null = null;
    try {
      size = ent.isFile() ? fs.statSync(full).size : null;
    } catch {
      size = null;
    }
    return { name: ent.name, type: ent.isDirectory() ? "dir" : "file", size };
  });
  return {
    ok: true,
    text: JSON.stringify({ path: path.relative(ctx.workspace, dir) || ".", entries }, null, 2),
  };
}

function readFile(
  ctx: PipelineAiToolContext,
  args: Record<string, unknown>,
): PipelineAiToolResult {
  const file = safeResolve(ctx.workspace, String(args.path ?? ""));
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error("文件不存在");
  const max = clamp(Number(args.max_chars ?? 8000), 100, 20_000);
  const buf = fs.readFileSync(file);
  if (buf.includes(0)) throw new Error("二进制文件不能读取");
  return {
    ok: true,
    text: truncate(buf.toString("utf8"), max),
  };
}

function submitPipeline(
  ctx: PipelineAiToolContext,
  args: Record<string, unknown>,
): PipelineAiToolResult {
  const yaml = String(args.yaml ?? "").trim();
  if (!yaml) throw new Error("yaml 为空");
  let parsed: ReturnType<typeof parsePipelineYaml>;
  try {
    parsed = parsePipelineYaml(yaml);
  } catch (err) {
    return {
      ok: false,
      text:
        "流水线校验失败：" +
        (err instanceof Error ? err.message : String(err)) +
        "。请修正后再次调用 submit_pipeline。",
    };
  }
  if (ctx.expectedId && parsed.id !== ctx.expectedId) {
    return {
      ok: false,
      text:
        "当前正在编辑流水线 " +
        ctx.expectedId +
        "，提交的 id 是 " +
        parsed.id +
        "。请沿用当前 id；如果要新建插件，请让用户用「新建插件」，不要在编辑器里换 id。",
    };
  }
  if (ctx.expectedKind && parsed.kind !== ctx.expectedKind) {
    return {
      ok: false,
      text:
        "当前流水线归属是 " +
        ctx.expectedKind +
        "，提交的是 " +
        parsed.kind +
        "。请保持当前 kind；新建插件请用「新建插件」。",
    };
  }
  return {
    ok: true,
    text: "已接受流水线。" + (args.notes ? "备注：" + String(args.notes) : ""),
    submittedYaml: yaml,
  };
}

function summarize(
  name: string,
  args: Record<string, unknown>,
  result: PipelineAiToolResult,
): string {
  if (name === "exec") {
    const cmd = String(args.command ?? "");
    const argv = Array.isArray(args.args) ? args.args.map(String).join(" ") : "";
    return (cmd + " " + argv).trim().slice(0, 160);
  }
  if (name === "download") {
    if (!result.ok) return String(args.url ?? "").slice(0, 120) + " · " + result.text.slice(0, 100);
    try {
      const parsed = JSON.parse(result.text) as { path?: string; bytes?: number };
      return parsed.path + " · " + parsed.bytes + " bytes";
    } catch {
      return String(args.url ?? "").slice(0, 160);
    }
  }
  if (name === "fetch_page") {
    if (!result.ok) return String(args.url ?? "").slice(0, 120) + " · " + result.text.slice(0, 100);
    try {
      const parsed = JSON.parse(result.text) as { status?: number; text?: string };
      return String(args.url ?? "").slice(0, 120) + " · HTTP " + parsed.status;
    } catch {
      return String(args.url ?? "").slice(0, 160);
    }
  }
  if (name === "submit_pipeline") {
    return result.ok ? "提交流水线" : "提交被拒绝：" + result.text.slice(0, 120);
  }
  return String(args.path ?? "").slice(0, 160) || name;
}

export async function executePipelineAiTool(
  ctx: PipelineAiToolContext,
  name: string,
  rawArgs: unknown,
): Promise<PipelineAiToolResult> {
  const args =
    rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};
  const started = Date.now();
  let result: PipelineAiToolResult;
  try {
    if (Date.now() > ctx.deadline) throw new Error("AI 任务超时");
    if (name === "exec") result = await runExec(ctx, args);
    else if (name === "download") result = await downloadFile(ctx, args);
    else if (name === "fetch_page") result = await fetchPage(ctx, args);
    else if (name === "list_dir") result = listDir(ctx, args);
    else if (name === "read_file") result = readFile(ctx, args);
    else if (name === "submit_pipeline") result = submitPipeline(ctx, args);
    else throw new Error("未知工具：" + name);
  } catch (err) {
    result = {
      ok: false,
      text: err instanceof Error ? err.message : String(err),
    };
  }
  ctx.trace.push({
    tool: name,
    summary: summarize(name, args, result),
    ok: result.ok,
    durationMs: Date.now() - started,
  });
  return result;
}
