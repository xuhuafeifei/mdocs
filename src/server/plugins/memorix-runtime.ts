/**
 * 本机安装并拉起 Memorix HTTP（npm 全局包 + `memorix background`）。
 * MCP 设置页不感知 Memorix；只有插件安装会走到这里。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MDOCS_UPDATE_SOURCES } from "../cli/self-update.js";

export const MEMORIX_HTTP_MCP_URL = "http://127.0.0.1:3211/mcp";
const HEALTH_URL = "http://127.0.0.1:3211/health";

/** 全局 install 易慢（尤其跨境）；先淘宝再官方，单源最长 10 分钟。 */
const NPM_INSTALL_TIMEOUT_MS = 600_000;
const MEMORIX_NPM_REGISTRIES = [
  MDOCS_UPDATE_SOURCES.taobao,
  MDOCS_UPDATE_SOURCES.npm,
] as const;

function assertNodeForMemorix(): void {
  const match = /^v(\d+)\.(\d+)\.(\d+)/.exec(process.version);
  if (!match) return;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major < 22 || (major === 22 && minor < 18)) {
    throw new Error(
      `Memorix 需要 Node.js >= 22.18.0，当前是 ${process.version}`,
    );
  }
}

function winQuote(value: string): string {
  if (!/[\s"]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

export type MemorixOutput = (stream: "stdout" | "stderr", line: string) => void;

function emitLines(
  buffer: string,
  chunk: string,
  emit: (line: string) => void,
): string {
  const merged = buffer + chunk;
  const parts = merged.split(/\r?\n/);
  const rest = parts.pop() ?? "";
  for (const line of parts) {
    const text = line.trim();
    if (text) emit(text.slice(0, 500));
  }
  return rest;
}

function run(
  command: string,
  args: string[],
  timeoutMs: number,
  onOutput?: MemorixOutput,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const onWindows = process.platform === "win32";
    const child = spawn(
      onWindows ? winQuote(command) : command,
      onWindows ? args.map(winQuote) : args,
      {
        // .cmd（npm、memorix）在 Windows 上必须经 cmd.exe，否则 EINVAL
        shell: onWindows,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      },
    );
    let stdout = "";
    let stderr = "";
    let outBuf = "";
    let errBuf = "";
    const take = (chunk: Buffer, which: "out" | "err") => {
      const text = chunk.toString("utf8");
      if (which === "out") {
        stdout = (stdout + text).slice(-8000);
        outBuf = emitLines(outBuf, text, (line) => onOutput?.("stdout", line));
      } else {
        stderr = (stderr + text).slice(-8000);
        errBuf = emitLines(errBuf, text, (line) => onOutput?.("stderr", line));
      }
    };
    const flush = () => {
      if (outBuf.trim()) onOutput?.("stdout", outBuf.trim().slice(0, 500));
      if (errBuf.trim()) onOutput?.("stderr", errBuf.trim().slice(0, 500));
      outBuf = "";
      errBuf = "";
    };
    child.stdout?.on("data", (chunk: Buffer) => take(chunk, "out"));
    child.stderr?.on("data", (chunk: Buffer) => take(chunk, "err"));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${path.basename(command)} ${args.join(" ")} 超时`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      flush();
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      flush();
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const detail = (stderr || stdout || `exit ${code}`).trim();
      reject(new Error(detail));
    });
  });
}

function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function globalNpmBinDir(): Promise<string> {
  const { stdout } = await run(npmCommand(), ["prefix", "-g"], 30_000);
  const prefix = stdout.trim();
  if (!prefix) throw new Error("npm prefix -g 没有返回路径");
  return process.platform === "win32" ? prefix : path.join(prefix, "bin");
}

async function memorixCommand(): Promise<string> {
  const dir = await globalNpmBinDir();
  const file = process.platform === "win32" ? "memorix.cmd" : "memorix";
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) {
    throw new Error(`未找到 ${full}。全局安装可能没有写到 npm prefix。`);
  }
  return full;
}

export async function isMemorixHttpUp(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitUntilUp(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    if (await isMemorixHttpUp()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Memorix 已安装，但 http://127.0.0.1:3211/health 没有就绪");
}

export type MemorixInstallPhase = "npm" | "init" | "start" | "health";

async function npmInstallMemorixGlobal(onOutput?: MemorixOutput): Promise<void> {
  const npm = npmCommand();
  const common = [
    "install",
    "-g",
    "memorix",
    "--fetch-retries=5",
    "--fetch-retry-mintimeout=20000",
    "--fetch-retry-maxtimeout=120000",
    "--fetch-timeout=300000",
  ];
  let lastError: Error | null = null;
  for (let i = 0; i < MEMORIX_NPM_REGISTRIES.length; i += 1) {
    const registry = MEMORIX_NPM_REGISTRIES[i]!;
    const installArgs = [...common, `--registry=${registry}`];
    onOutput?.(
      "stdout",
      i === 0
        ? `${npm} ${installArgs.join(" ")}`
        : `改用备用源：${npm} ${installArgs.join(" ")}`,
    );
    try {
      await run(npm, installArgs, NPM_INSTALL_TIMEOUT_MS, onOutput);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      onOutput?.(
        "stderr",
        `registry ${registry} 失败：${lastError.message.slice(0, 400)}`,
      );
      if (i < MEMORIX_NPM_REGISTRIES.length - 1) {
        onOutput?.("stdout", "尝试下一个 npm registry…");
      }
    }
  }
  throw lastError ?? new Error("npm install -g memorix 失败");
}

/** 全局安装 memorix，初始化（失败可继续），并启动后台 HTTP。 */
export async function installMemorixRuntime(
  onPhase?: (phase: MemorixInstallPhase) => void,
  onOutput?: MemorixOutput,
): Promise<void> {
  assertNodeForMemorix();
  onPhase?.("npm");
  await npmInstallMemorixGlobal(onOutput);
  const bin = await memorixCommand();
  onPhase?.("init");
  try {
    await run(bin, ["init", "--global"], 20_000, onOutput);
  } catch {
    /* init 可能已完成，或在无 TTY 下退出；随后仍尝试启动 */
  }
  onPhase?.("start");
  try {
    await run(bin, ["background", "start"], 60_000, onOutput);
  } catch (err) {
    if (!(await isMemorixHttpUp())) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
  onPhase?.("health");
  await waitUntilUp();
}

/** 停掉后台进程并卸载全局包。进程本就没在跑时，停止失败可以忽略。 */
export async function uninstallMemorixRuntime(): Promise<void> {
  try {
    const bin = await memorixCommand();
    await run(bin, ["background", "stop"], 30_000);
  } catch {
    /* 未安装或已经停止 */
  }
  await run(npmCommand(), ["uninstall", "-g", "memorix"], 120_000);
}
