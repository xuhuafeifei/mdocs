/**
 * 流水线执行器：按 YAML 步骤逐步安装 / 卸载，向上抛步骤事件。
 * 非沙箱：download / exec 都是服务器本机行为（契约已知接受）。
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { getDb } from "../../db/connection.js";
import {
  deleteAgentUserSkillByName,
  findAgentUserSkillByName,
  insertAgentUserSkill,
  updateAgentUserSkill,
} from "../../db/repositories/agent-user-skill.repo.js";
import {
  removeMcpServerById,
  upsertMcpServer,
} from "../../mcp/mcp-servers-store.js";
import { ensureGlobalSoulShell, ensureVisitorSoulShell } from "../../soul/ensure-shells.js";
import { globalSoulDir, visitorSoulDir } from "../../soul/paths.js";
import {
  buildEngramMcpEnv,
  detectPlatform,
  engramDownloadCandidates,
} from "../engram-runtime.js";
import {
  pluginDataDir,
  pluginInstallDir,
  pluginsDataRoot,
} from "../plugin-paths.js";
import {
  getPipelineInstall,
  markPipelineInstalled,
  markPipelineUninstalled,
} from "../installed-store.js";
import type {
  PipelineProbe,
  PipelineStep,
  PluginPipeline,
} from "./types.js";

export type PipelineRunAction = "install" | "uninstall";
export type PipelineStepStatus =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "error";

export type PipelineProbeResult = {
  type: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type PipelineRunEvent =
  | { type: "probe"; results: PipelineProbeResult[]; passed: boolean }
  | {
      type: "step";
      index: number;
      status: PipelineStepStatus;
      detail?: string;
      error?: string;
    }
  | {
      type: "log";
      line: string;
      level: "info" | "warn" | "error";
      stepIndex?: number;
    }
  | { type: "done"; mcpServerId?: string }
  | { type: "error"; error: string };

export type RunPipelineOptions = {
  pipeline: PluginPipeline;
  action: PipelineRunAction;
  visitorId: string;
  onEvent: (event: PipelineRunEvent) => void;
  signal?: AbortSignal;
};

type Ctx = {
  pipeline: PluginPipeline;
  action: PipelineRunAction;
  visitorId: string;
  installRoot: string;
  dataDir: string;
  vars: Record<string, string>;
  probePassed: boolean;
  lastArchive: string | null;
  mcpServerId?: string;
  emit: (event: PipelineRunEvent) => void;
};

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true, mode: 0o700 });
}

function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : m,
  );
}

function within(root: string, rel: string): string {
  const abs = path.resolve(root, rel);
  const rootAbs = path.resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
    throw new Error(`路径越界：${rel}`);
  }
  return abs;
}

/** cwd 可指向 plugins-data（如 Engram 工作区），但仍限制在受管根内。 */
function resolveCwd(ctx: Ctx, rel: string): string {
  const rendered = render(rel, ctx.vars);
  if (!path.isAbsolute(rendered)) return within(ctx.installRoot, rendered);
  const abs = path.resolve(rendered);
  const roots = [ctx.installRoot, ctx.dataDir, pluginsDataRoot()].map((r) =>
    path.resolve(r),
  );
  const ok = roots.some((root) => abs === root || abs.startsWith(root + path.sep));
  if (!ok) throw new Error(`路径越界：${rel}`);
  return abs;
}

function findFileByName(root: string, name: string, depth: number): string | null {
  if (depth < 0 || !fs.existsSync(root)) return null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (ent.isFile() && ent.name === name) return full;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const hit = findFileByName(path.join(root, ent.name), name, depth - 1);
    if (hit) return hit;
  }
  return null;
}

function resolveExecutable(ctx: Ctx, raw: string): string {
  const cmd = render(raw, ctx.vars).trim();
  if (!cmd) throw new Error("命令为空");
  if (path.isAbsolute(cmd)) {
    if (fs.existsSync(cmd)) return cmd;
    throw new Error(`命令不存在：${cmd}`);
  }
  const inside = path.resolve(ctx.installRoot, cmd);
  if (fs.existsSync(inside)) return inside;
  const base = path.basename(cmd);
  const found = findFileByName(ctx.installRoot, base, 3);
  if (found) return found;
  if (cmd.includes("/") || cmd.includes("\\")) {
    throw new Error(`安装目录内找不到命令：${cmd}`);
  }
  // 交给 PATH（npx / node / python / uvx…）
  return cmd;
}

function chmodExec(p: string): void {
  try {
    if (process.platform !== "win32" && fs.statSync(p).isFile()) {
      fs.chmodSync(p, 0o755);
    }
  } catch {
    /* ignore */
  }
}

function runProcess(params: {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  stepIndex?: number;
  emit: (event: PipelineRunEvent) => void;
  signal?: AbortSignal;
}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(params.command, params.args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: params.cwd,
      env: params.env ?? process.env,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    const emitLine = (line: string, level: "info" | "warn") => {
      const text = line.trim();
      if (!text) return;
      params.emit({
        type: "log",
        line: text.slice(0, 500),
        level,
        ...(params.stepIndex != null ? { stepIndex: params.stepIndex } : {}),
      });
    };
    const makeLineReader = (level: "info" | "warn") => {
      let buf = "";
      return (chunk: Buffer) => {
        buf += chunk.toString("utf8");
        const parts = buf.split(/\r?\n/);
        buf = parts.pop() ?? "";
        for (const line of parts) emitLine(line, level);
      };
    };
    const outReader = makeLineReader("info");
    const errReader = makeLineReader("warn");
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = (stdout + chunk.toString("utf8")).slice(-20_000);
      outReader(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-20_000);
      errReader(chunk);
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`命令超时：${params.command} ${params.args.join(" ")}`));
    }, params.timeoutMs);
    const onAbort = () => child.kill();
    params.signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", (err) => {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      params.signal?.removeEventListener("abort", onAbort);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          (stderr || stdout || `退出码 ${code}`).trim().slice(0, 1200),
        ),
      );
    });
  });
}

async function downloadFile(
  ctx: Ctx,
  urls: string[],
  destAbs: string,
  stepIndex: number,
  expectedSha?: string,
): Promise<void> {
  ensureDir(path.dirname(destAbs));
  let lastError: Error | null = null;
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i]!;
    ctx.emit({
      type: "log",
      line: `GET ${url}`,
      level: "info",
      stepIndex,
    });
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(300_000),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const tmp = `${destAbs}.part`;
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      await streamPipeline(
        Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
        createWriteStream(tmp),
      );
      const size = fs.statSync(tmp).size;
      if (size < 16) {
        fs.unlinkSync(tmp);
        throw new Error(`文件过小（${size} bytes），可能不是安装包`);
      }
      if (expectedSha) {
        const hash = crypto.createHash("sha256");
        await streamPipeline(fs.createReadStream(tmp), hash);
        if (hash.digest("hex").toLowerCase() !== expectedSha.trim().toLowerCase()) {
          fs.unlinkSync(tmp);
          throw new Error("SHA256 不匹配");
        }
      }
      if (fs.existsSync(destAbs)) fs.unlinkSync(destAbs);
      fs.renameSync(tmp, destAbs);
      ctx.lastArchive = destAbs;
      ctx.emit({
        type: "log",
        line: `已下载 ${path.basename(destAbs)}（${size} bytes）`,
        level: "info",
        stepIndex,
      });
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      ctx.emit({
        type: "log",
        line: `下载失败：${lastError.message.slice(0, 300)}`,
        level: "warn",
        stepIndex,
      });
      if (i < urls.length - 1) {
        ctx.emit({
          type: "log",
          line: `改用备用下载源（${i + 2}/${urls.length}）…`,
          level: "info",
          stepIndex,
        });
      }
    }
  }
  throw lastError ?? new Error("下载失败");
}

function newestArchive(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((n) => /\.(tar\.gz|tgz|zip|tar)$/i.test(n))
    .map((n) => path.join(dir, n));
  if (files.length === 0) return null;
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0]!;
}

async function extractArchive(
  ctx: Ctx,
  archive: string,
  destDir: string,
  stepIndex: number,
): Promise<void> {
  ensureDir(destDir);
  const low = archive.toLowerCase();
  const isZip = low.endsWith(".zip");
  ctx.emit({
    type: "log",
    line: `解压 ${path.basename(archive)} → ${destDir}`,
    level: "info",
    stepIndex,
  });
  if (process.platform === "win32" && isZip) {
    await runProcess({
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      timeoutMs: 120_000,
      stepIndex,
      emit: ctx.emit,
    });
    return;
  }
  if (isZip) {
    await runProcess({
      command: "unzip",
      args: ["-o", "-q", archive, "-d", destDir],
      timeoutMs: 120_000,
      stepIndex,
      emit: ctx.emit,
    });
    return;
  }
  const gzipped = low.endsWith(".tar.gz") || low.endsWith(".tgz");
  await runProcess({
    command: "tar",
    args: [gzipped ? "-xzf" : "-xf", archive, "-C", destDir],
    timeoutMs: 120_000,
    stepIndex,
    emit: ctx.emit,
  });
}

async function runProbes(
  ctx: Ctx,
): Promise<{ results: PipelineProbeResult[]; passed: boolean }> {
  const probes = ctx.pipeline.probe ?? [];
  const results: PipelineProbeResult[] = [];
  for (const probe of probes) {
    results.push(await runProbe(ctx, probe));
  }
  return { results, passed: results.length > 0 && results.every((r) => r.ok) };
}

async function runProbe(ctx: Ctx, probe: PipelineProbe): Promise<PipelineProbeResult> {
  try {
    if (probe.type === "file_exists") {
      const rel = render(probe.path ?? "", ctx.vars);
      if (!rel) throw new Error("path 为空");
      const abs = within(ctx.installRoot, rel);
      const ok = fs.existsSync(abs);
      return {
        type: probe.type,
        label: `文件存在：${rel}`,
        ok,
        detail: abs,
      };
    }
    if (probe.type === "http_health") {
      const url = render(probe.url ?? "", ctx.vars);
      if (!url) throw new Error("url 为空");
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      return {
        type: probe.type,
        label: `HTTP 健康检查`,
        ok: res.ok,
        detail: `HTTP ${res.status}`,
      };
    }
    if (probe.type === "npm_global") {
      const pkg = render(probe.package ?? "", ctx.vars);
      if (!pkg) throw new Error("package 为空");
      try {
        await runProcess({
          command: "npm",
          args: ["list", "-g", "--depth=0", pkg],
          timeoutMs: 20_000,
          emit: () => {},
        });
        return { type: probe.type, label: `npm 全局包：${pkg}`, ok: true };
      } catch {
        return { type: probe.type, label: `npm 全局包：${pkg}`, ok: false };
      }
    }
    return { type: probe.type, label: probe.type, ok: false, detail: "未知检测类型" };
  } catch (err) {
    return {
      type: probe.type,
      label: probe.type,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** MCP id 优先级：步骤显式 id → 安装记录 → plugin-<pipelineId>。 */
function mcpIdFor(ctx: Ctx, explicit?: string): string {
  const fromStep = explicit?.trim();
  if (fromStep) return fromStep;
  return getPipelineInstall(ctx.pipeline.id)?.mcpServerId ?? `plugin-${ctx.pipeline.id}`;
}

function stepEnabled(step: PipelineStep): boolean {
  return step.disabled !== true;
}

function shouldSkip(step: PipelineStep, probePassed: boolean): string | null {
  if (!stepEnabled(step)) return "已禁用";
  const when = step.when ?? "always";
  if (when === "first_install" && probePassed) return "非首次安装";
  if (when === "probe_passed" && !probePassed) return "安装检测未通过";
  if (when === "probe_failed" && probePassed) return "安装检测已通过";
  const skipDefault =
    step.type === "download" ||
    step.type === "extract" ||
    step.type === "copy_file";
  const skipOnProbe = step.skip_on_probe ?? skipDefault;
  if (probePassed && skipOnProbe) return "安装检测已通过";
  return null;
}

/**
 * 没写 uninstall 时按安装步骤反推清理：MCP / Skill / 灵魂旁路。
 * 安装目录由执行器在卸载成功后删除。
 */
export function resolveUninstallSteps(pipeline: PluginPipeline): PipelineStep[] {
  if (pipeline.uninstall?.length) return pipeline.uninstall;
  const out: PipelineStep[] = [];
  for (const step of pipeline.steps) {
    if (step.type === "write_soul_sidecar") {
      out.push({ type: "delete_soul_sidecar", scope: step.scope, file: step.file });
    }
    if (step.type === "upsert_skill") {
      out.push({ type: "remove_skill", name: step.name });
    }
  }
  if (pipeline.steps.some((s) => s.type === "upsert_mcp")) {
    out.push({ type: "remove_mcp" });
  }
  return out;
}

async function runStep(
  ctx: Ctx,
  step: PipelineStep,
  index: number,
  signal?: AbortSignal,
): Promise<void> {
  const emit = ctx.emit;
  const log = (line: string, level: "info" | "warn" = "info") =>
    emit({ type: "log", line, level, stepIndex: index });

  switch (step.type) {
    case "download": {
      let urls: string[];
      let filename: string;
      const rawUrl = render(step.url ?? "", ctx.vars).trim();
      if (rawUrl) {
        urls = [rawUrl];
        filename = path.basename(new URL(rawUrl).pathname) || "package.bin";
      } else if (ctx.pipeline.runtime === "engram") {
        const fallback = engramDownloadCandidates();
        urls = fallback.urls;
        filename = fallback.filename;
      } else {
        throw new Error("download.url 为空（该插件没有内置下载源）");
      }
      const destRel = step.dest ? render(step.dest, ctx.vars) : `pkg/${filename}`;
      const destAbs = within(ctx.installRoot, destRel);
      const sha = render(step.sha256 ?? "", ctx.vars).trim();
      await downloadFile(ctx, urls, destAbs, index, sha || undefined);
      return;
    }
    case "extract": {
      const archive =
        (step.archive ? render(step.archive, ctx.vars) : "") ||
        ctx.lastArchive ||
        newestArchive(path.join(ctx.installRoot, "pkg"));
      if (!archive) throw new Error("没有可解压的安装包（先执行 download）");
      const archiveAbs = path.isAbsolute(archive)
        ? archive
        : within(ctx.installRoot, archive);
      const dest = step.dest ? render(step.dest, ctx.vars) : ".";
      await extractArchive(ctx, archiveAbs, within(ctx.installRoot, dest), index);
      return;
    }
    case "copy_file": {
      const from = within(ctx.installRoot, render(step.from, ctx.vars));
      const to = within(ctx.installRoot, render(step.to, ctx.vars));
      if (!fs.existsSync(from)) throw new Error(`源文件不存在：${from}`);
      ensureDir(path.dirname(to));
      fs.copyFileSync(from, to);
      chmodExec(to);
      log(`已复制到 ${to}`);
      return;
    }
    case "exec": {
      const command = resolveExecutable(ctx, step.command);
      chmodExec(command);
      const args = (step.args ?? []).map((a) => render(a, ctx.vars));
      const cwd = step.cwd ? resolveCwd(ctx, step.cwd) : ctx.installRoot;
      ensureDir(cwd);
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        ...(ctx.pipeline.runtime === "engram" ? buildEngramMcpEnv() : {}),
      };
      for (const [k, v] of Object.entries(step.env ?? {})) {
        env[k] = render(v, ctx.vars);
      }
      log(`$ ${command} ${args.join(" ")}`);
      const timeout =
        Number(render(String(step.timeout_seconds ?? ""), ctx.vars)) > 0
          ? Number(step.timeout_seconds) * 1000
          : 300_000;
      await runProcess({
        command,
        args,
        cwd,
        env,
        timeoutMs: timeout,
        stepIndex: index,
        emit,
        signal,
      });
      return;
    }
    case "upsert_mcp": {
      const id = mcpIdFor(ctx, step.mcp_server_id);
      if (step.transport === "stdio") {
        const command = resolveExecutable(ctx, step.command ?? "");
        chmodExec(command);
        const args = (step.args ?? []).map((a) => render(a, ctx.vars));
        const cwd = step.cwd ? resolveCwd(ctx, step.cwd) : undefined;
        if (cwd) ensureDir(cwd);
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(step.env ?? {})) {
          env[k] = render(v, ctx.vars);
        }
        upsertMcpServer({
          id,
          name: step.name,
          enabled: step.enabled ?? true,
          transport: "stdio",
          command,
          ...(args.length ? { args } : {}),
          ...(cwd ? { cwd } : {}),
          ...(Object.keys(env).length ? { env } : {}),
        });
        ctx.mcpServerId = id;
        log(`MCP 已注册（stdio）：${command}`);
        return;
      }
      upsertMcpServer({
        id,
        name: step.name,
        enabled: step.enabled ?? true,
        transport: "http",
        url: render(step.url ?? "", ctx.vars),
        ...(step.headers
          ? {
              headers: Object.fromEntries(
                Object.entries(step.headers).map(([k, v]) => [k, render(v, ctx.vars)]),
              ),
            }
          : {}),
      });
      ctx.mcpServerId = id;
      log("MCP 已注册（HTTP）");
      return;
    }
    case "upsert_skill": {
      if (!ctx.visitorId) throw new Error("注册 Skill 需要登录访客");
      const name = render(step.name, ctx.vars).trim();
      let body = step.body ?? "";
      if (step.body_file) {
        const file = within(ctx.installRoot, render(step.body_file, ctx.vars));
        if (!fs.existsSync(file)) throw new Error(`Skill 正文文件不存在：${file}`);
        body = fs.readFileSync(file, "utf8");
      }
      if (!body.trim()) throw new Error("Skill 正文为空");
      const db = getDb();
      const existing = findAgentUserSkillByName(db, ctx.visitorId, name);
      const now = new Date().toISOString();
      if (existing) {
        updateAgentUserSkill(db, {
          id: existing.id,
          owner_visitor_id: ctx.visitorId,
          name,
          description: step.description ?? "",
          body,
          updated_at: now,
        });
        log(`Skill 已更新：${name}`);
      } else {
        insertAgentUserSkill(db, {
          id: randomUUID(),
          owner_visitor_id: ctx.visitorId,
          name,
          description: step.description ?? "",
          body,
          updated_at: now,
        });
        log(`Skill 已注册：${name}`);
      }
      return;
    }
    case "write_soul_sidecar": {
      const dir =
        step.scope === "tenant"
          ? (() => {
              if (!ctx.visitorId) throw new Error("个人旁路需要登录访客");
              ensureVisitorSoulShell(ctx.visitorId);
              return visitorSoulDir(ctx.visitorId);
            })()
          : (() => {
              ensureGlobalSoulShell();
              return globalSoulDir();
            })();
      const file = assertSidecarName(step.file);
      let content = step.content ?? "";
      if (step.from) {
        const src = within(ctx.installRoot, render(step.from, ctx.vars));
        if (!fs.existsSync(src)) throw new Error(`旁路源文件不存在：${src}`);
        content = fs.readFileSync(src, "utf8");
      }
      fs.writeFileSync(path.join(dir, file), content, "utf8");
      log(`已写入灵魂旁路：${file}`);
      return;
    }
    case "delete_soul_sidecar": {
      const dir =
        step.scope === "tenant"
          ? (ctx.visitorId ? visitorSoulDir(ctx.visitorId) : "")
          : globalSoulDir();
      if (!dir) throw new Error("个人旁路需要登录访客");
      const file = assertSidecarName(step.file);
      const target = path.join(dir, file);
      if (fs.existsSync(target)) fs.unlinkSync(target);
      log(`已删除灵魂旁路：${file}`);
      return;
    }
    case "remove_mcp": {
      const id = mcpIdFor(ctx, step.mcp_server_id);
      removeMcpServerById(id);
      log(`已移除 MCP：${id}`);
      return;
    }
    case "remove_skill": {
      if (!ctx.visitorId) throw new Error("移除 Skill 需要登录访客");
      const name = render(step.name, ctx.vars).trim();
      deleteAgentUserSkillByName(getDb(), ctx.visitorId, name);
      log(`已移除 Skill：${name}`);
      return;
    }
    default: {
      const never: never = step;
      throw new Error(`未实现的步骤类型：${JSON.stringify(never)}`);
    }
  }
}

function assertSidecarName(file: string): string {
  const name = String(file ?? "").trim();
  if (!/^[A-Za-z0-9._-]+\.md$/.test(name)) {
    throw new Error("旁路文件名只能是同目录下的 .md（不能带路径）");
  }
  return name;
}

export async function runPipeline(
  opts: RunPipelineOptions,
): Promise<{ mcpServerId?: string }> {
  const { pipeline, action, visitorId, onEvent, signal } = opts;
  const dataKey = pipeline.data_key?.trim() || pipeline.id;
  const installRoot = pluginInstallDir(pipeline.id);
  const dataDir = pluginDataDir(dataKey);
  const plat = detectPlatform();
  const vars: Record<string, string> = {
    install_root: installRoot,
    plugins_data: dataDir,
    plugins_data_root: pluginsDataRoot(),
    version: pipeline.version ?? "",
    goos: plat.goos,
    goarch: plat.goarch,
    visitor_id: visitorId,
    plugin_id: pipeline.id,
    engram_project: "mdocs-bootstrap",
  };
  const ctx: Ctx = {
    pipeline,
    action,
    visitorId,
    installRoot,
    dataDir,
    vars,
    probePassed: false,
    lastArchive: null,
    emit: onEvent,
  };

  ensureDir(installRoot);
  ensureDir(dataDir);
  ensureGlobalSoulShell();
  if (visitorId) ensureVisitorSoulShell(visitorId);

  if (action === "install") {
    const { results, passed } = await runProbes(ctx);
    ctx.probePassed = passed;
    onEvent({ type: "probe", results, passed });
  }

  const steps = action === "install" ? pipeline.steps : resolveUninstallSteps(pipeline);
  try {
    for (let index = 0; index < steps.length; index += 1) {
      if (signal?.aborted) throw new Error("已取消");
      const step = steps[index]!;
      const skip = action === "install" ? shouldSkip(step, ctx.probePassed) : null;
      if (skip) {
        onEvent({ type: "step", index, status: "skipped", detail: skip });
        onEvent({
          type: "log",
          line: `跳过步骤 ${index + 1}（${skip}）`,
          level: "info",
          stepIndex: index,
        });
        continue;
      }
      onEvent({ type: "step", index, status: "running" });
      try {
        await runStep(ctx, step, index, signal);
        onEvent({ type: "step", index, status: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onEvent({ type: "step", index, status: "error", error: message });
        throw new Error(`步骤 ${index + 1}（${step.type}）失败：${message}`);
      }
    }
    if (action === "install") {
      markPipelineInstalled({
        id: pipeline.id,
        name: pipeline.name,
        kind: pipeline.kind,
        ...(pipeline.runtime ? { runtime: pipeline.runtime } : {}),
        ...(pipeline.install_mode ? { installMode: pipeline.install_mode } : {}),
        outputs: pipeline.outputs,
        ...(ctx.mcpServerId ? { mcpServerId: ctx.mcpServerId } : {}),
      });
    } else {
      // 卸载成功：删安装物，保留 plugins-data
      try {
        fs.rmSync(installRoot, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      markPipelineUninstalled(pipeline.id, { ok: true, name: pipeline.name });
    }
    onEvent({ type: "done", ...(ctx.mcpServerId ? { mcpServerId: ctx.mcpServerId } : {}) });
    return ctx.mcpServerId ? { mcpServerId: ctx.mcpServerId } : {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (action === "uninstall") {
      markPipelineUninstalled(pipeline.id, {
        ok: false,
        error: message,
        name: pipeline.name,
      });
    }
    onEvent({ type: "error", error: message });
    throw err;
  }
}

