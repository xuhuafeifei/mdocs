/**
 * 本机安装 Engram：从 GitHub Releases 下载预编译二进制，配置为 stdio MCP（`engram mcp`）。
 * 不依赖长期常驻 HTTP；Agent 每轮按需拉起进程。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { getConfig } from "../config/index.js";

/** 钉死稳定版；升级时改这里并测一遍。 */
export const ENGRAM_RELEASE_TAG = "v3.6.0";
const ENGRAM_VERSION = ENGRAM_RELEASE_TAG.replace(/^v/, "");

export type EngramInstallPhase = "npm" | "init" | "start" | "health";
export type EngramOutput = (stream: "stdout" | "stderr", line: string) => void;

export function engramInstallRoot(): string {
  return path.join(getConfig().dataDir, "plugins", "engram");
}

export function engramBinDir(): string {
  return path.join(engramInstallRoot(), "bin");
}

export function engramBinaryPath(): string {
  const name = process.platform === "win32" ? "engram.exe" : "engram";
  return path.join(engramBinDir(), name);
}

/** Engram SQLite 数据目录（与 mdocs dataDir 同树，避免散落 ~/.engram）。 */
export function engramDataDir(): string {
  return path.join(getConfig().dataDir, "engram-data");
}

/** cwd：`engram init mdocs` 写 `.engram/config.json`，避免无 git 时项目检测失败。 */
export function engramWorkspaceRoot(): string {
  return path.join(getConfig().dataDir, "engram-workspace");
}

export const ENGRAM_PROJECT_NAME = "mdocs";

export function isEngramBinaryReady(): boolean {
  try {
    return fs.existsSync(engramBinaryPath());
  } catch {
    return false;
  }
}

type PlatformAsset = {
  goos: "linux" | "darwin" | "windows";
  goarch: "amd64" | "arm64";
  ext: ".tar.gz" | ".zip";
};

function detectPlatform(): PlatformAsset {
  const arch =
    process.arch === "arm64"
      ? "arm64"
      : process.arch === "x64"
        ? "amd64"
        : null;
  if (!arch) {
    throw new Error(`Engram 暂不支持本机架构：${process.arch}`);
  }
  if (process.platform === "linux") {
    return { goos: "linux", goarch: arch, ext: ".tar.gz" };
  }
  if (process.platform === "darwin") {
    return { goos: "darwin", goarch: arch, ext: ".tar.gz" };
  }
  if (process.platform === "win32") {
    return { goos: "windows", goarch: arch, ext: ".zip" };
  }
  throw new Error(`Engram 暂不支持本机系统：${process.platform}`);
}

function assetFileName(plat: PlatformAsset): string {
  return `engram_${ENGRAM_VERSION}_${plat.goos}_${plat.goarch}${plat.ext}`;
}

function githubReleaseUrl(plat: PlatformAsset): string {
  const file = assetFileName(plat);
  return `https://github.com/Gentleman-Programming/engram/releases/download/${ENGRAM_RELEASE_TAG}/${file}`;
}

/**
 * Engram 官方无 Gitee。国内直连 GitHub Releases 常失败，
 * 依次试直连 + 常用反代（前缀拼完整 URL）。也可用环境变量
 * `ENGRAM_DOWNLOAD_URL` 指定完整包地址（跳过候选列表）。
 */
function releaseDownloadCandidates(plat: PlatformAsset): string[] {
  const override = process.env.ENGRAM_DOWNLOAD_URL?.trim();
  if (override) return [override];
  const origin = githubReleaseUrl(plat);
  const proxies = [
    "https://ghfast.top/",
    "https://gh-proxy.com/",
    "https://gh.llkk.cc/",
  ];
  return [origin, ...proxies.map((p) => `${p}${origin}`)];
}

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
  onOutput?: EngramOutput,
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: opts?.cwd,
      env: opts?.env ?? process.env,
      shell: false,
    });
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

async function downloadFileOnce(
  url: string,
  dest: string,
  onOutput?: EngramOutput,
): Promise<void> {
  onOutput?.("stdout", `GET ${url}`);
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  await pipeline(
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
    createWriteStream(dest),
  );
  const size = fs.statSync(dest).size;
  // 反代失败时常返回一小段 HTML/JSON；正式包约 8MB+
  if (size < 1_000_000) {
    throw new Error(`文件过小（${size} bytes），可能不是 release 包`);
  }
  onOutput?.("stdout", `已下载 ${path.basename(dest)}（${size} bytes）`);
}

async function downloadFile(
  urls: string[],
  dest: string,
  onOutput?: EngramOutput,
): Promise<void> {
  let lastError: Error | null = null;
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i]!;
    try {
      if (i > 0) onOutput?.("stdout", `改用备用下载源（${i + 1}/${urls.length}）…`);
      await downloadFileOnce(url, dest, onOutput);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      onOutput?.(
        "stderr",
        `下载失败：${lastError.message.slice(0, 400)}`,
      );
      try {
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
      } catch {
        /* ignore */
      }
    }
  }
  throw lastError ?? new Error("Engram 下载失败（官方无 Gitee；可设 ENGRAM_DOWNLOAD_URL）");
}

async function extractArchive(
  archivePath: string,
  destDir: string,
  plat: PlatformAsset,
  onOutput?: EngramOutput,
): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });
  if (plat.ext === ".tar.gz") {
    onOutput?.("stdout", `tar -xzf ${archivePath} -C ${destDir}`);
    await run("tar", ["-xzf", archivePath, "-C", destDir], 120_000, onOutput);
    return;
  }
  // Windows zip：用 PowerShell Expand-Archive
  onOutput?.("stdout", `Expand-Archive ${archivePath}`);
  await run(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
    ],
    120_000,
    onOutput,
  );
}

/** 在解压目录里找到 engram 二进制（release 可能带一层目录）。 */
function findExtractedBinary(root: string): string {
  const want = process.platform === "win32" ? "engram.exe" : "engram";
  const direct = path.join(root, want);
  if (fs.existsSync(direct)) return direct;
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (ent.isFile() && ent.name === want) return full;
    if (ent.isDirectory()) {
      const nested = path.join(full, want);
      if (fs.existsSync(nested)) return nested;
    }
  }
  throw new Error(`解压后未找到 ${want}`);
}

export function buildEngramMcpEnv(): Record<string, string> {
  return {
    ENGRAM_DATA_DIR: engramDataDir(),
    ENGRAM_PROJECT: ENGRAM_PROJECT_NAME,
  };
}

/**
 * 初始化工作区 + `engram init mdocs`，并写一条 bootstrap 记忆，
 * 避免 ENGRAM_PROJECT=mdocs 时库里还没有该项目（unknown_project）。
 */
export async function ensureEngramProject(
  onOutput?: EngramOutput,
): Promise<string> {
  const root = engramWorkspaceRoot();
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(engramDataDir(), { recursive: true });
  const bin = engramBinaryPath();
  if (!fs.existsSync(bin)) {
    throw new Error(`Engram 二进制不存在：${bin}`);
  }
  const env = { ...process.env, ...buildEngramMcpEnv() };
  const cfg = path.join(root, ".engram", "config.json");
  if (!fs.existsSync(cfg)) {
    onOutput?.("stdout", `engram init ${ENGRAM_PROJECT_NAME} @ ${root}`);
    await run(bin, ["init", ENGRAM_PROJECT_NAME, "--force"], 30_000, onOutput, {
      cwd: root,
      env,
    });
    try {
      await run(
        bin,
        [
          "save",
          "--project",
          ENGRAM_PROJECT_NAME,
          "mdocs-bootstrap",
          "mdocs Engram memory project",
        ],
        30_000,
        onOutput,
        { cwd: root, env },
      );
    } catch {
      /* 首次写入失败可忽略；后续 mem_session_start 仍会登记会话 */
    }
  }
  return root;
}

/** 下载 release → 解压到 dataDir/plugins/engram/bin → init 项目 → version 校验。 */
export async function installEngramRuntime(
  onPhase?: (phase: EngramInstallPhase) => void,
  onOutput?: EngramOutput,
): Promise<void> {
  const plat = detectPlatform();
  const urls = releaseDownloadCandidates(plat);
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-engram-"));
  const archivePath = path.join(tmpRoot, assetFileName(plat));
  const extractDir = path.join(tmpRoot, "out");

  try {
    onPhase?.("npm");
    await downloadFile(urls, archivePath, onOutput);

    onPhase?.("init");
    fs.mkdirSync(extractDir, { recursive: true });
    await extractArchive(archivePath, extractDir, plat, onOutput);
    const extracted = findExtractedBinary(extractDir);

    onPhase?.("start");
    const binDir = engramBinDir();
    fs.mkdirSync(binDir, { recursive: true });
    const dest = engramBinaryPath();
    fs.copyFileSync(extracted, dest);
    if (process.platform !== "win32") {
      fs.chmodSync(dest, 0o755);
    }
    fs.mkdirSync(engramDataDir(), { recursive: true });
    onOutput?.("stdout", `二进制：${dest}`);
    await ensureEngramProject(onOutput);

    onPhase?.("health");
    const { stdout } = await run(
      dest,
      ["version"],
      30_000,
      onOutput,
      { env: { ...process.env, ...buildEngramMcpEnv() }, cwd: engramWorkspaceRoot() },
    );
    const ver = stdout.trim() || "(ok)";
    onOutput?.("stdout", `engram version → ${ver.slice(0, 200)}`);
  } finally {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/** 删除本机 Engram 安装目录（数据目录 engram-data 保留，避免误删记忆）。 */
export async function uninstallEngramRuntime(): Promise<void> {
  const root = engramInstallRoot();
  if (fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
