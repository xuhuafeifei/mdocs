/**
 * 系统表情包来源：npm 包。
 *
 * 为什么走 npm：mdocs 只负责「采集」——把整包一次拉下来再原子覆盖，不逐张下载。
 * npm 自己会下载 tarball、校验 integrity 并解包，因此这里不需要 tar 解析，
 * 也不需要 unpkg 那种按路径取文件的 CDN（那条路在淘宝镜像上还有白名单限制）。
 *
 * 安全边界：
 *   - 一律加 --ignore-scripts：远端包的 postinstall 等于在服务器上执行任意代码；
 *   - 只接受 Http(s) registry，参数走 execFile 数组，不经过 shell，避免命令注入；
 *   - 调用方只按白名单（meme.json + 图片）拷文件，包内其余内容一律不外露。
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** 默认走淘宝镜像：拉的是 tarball 接口，不受 unpkg 文件白名单影响 */
export const DEFAULT_MEME_REGISTRY = "https://registry.npmmirror.com";

const INSTALL_TIMEOUT_MS = 180_000;
const MAX_SPEC_LENGTH = 214;
const PACK_NAME_RE = /^(?:@[A-Za-z0-9][\w.-]*\/)?[A-Za-z0-9][\w.-]*$/;

export type InstalledPack = {
  /** 调用方传入的原始 spec（用于日志） */
  spec: string;
  /** 实际安装到的版本 */
  version: string;
  /** 包根目录：node_modules/<name> */
  dir: string;
  /** 临时安装根目录，调用方必须自行清理 */
  root: string;
};

/** 从 spec 里取出包名（去掉 @version 与 dist-tag）；不合法返回 null */
export function packNameOf(spec: string): string | null {
  const raw = spec.trim();
  if (!raw || raw.length > MAX_SPEC_LENGTH) return null;
  // "@scope/name" 的首字符 @ 是作用域前缀，不是版本分隔符
  const at = raw.lastIndexOf("@");
  const name = at > 0 ? raw.slice(0, at) : raw;
  return PACK_NAME_RE.test(name) ? name : null;
}

function run(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            reject(
              new Error(
                "找不到 npm 命令：系统表情包同步依赖本机 npm（随 node 安装），请先安装 node/npm 后重试",
              ),
            );
            return;
          }
          const detail = (stderr || stdout || err.message).trim().split("\n").slice(-8).join("\n");
          reject(new Error("npm 执行失败：" + (detail || err.message)));
          return;
        }
        resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
      },
    );
  });
}

function findInstalledDir(root: string, expectedName: string | null): string | null {
  if (expectedName) {
    const direct = path.join(root, "node_modules", ...expectedName.split("/"));
    if (fs.existsSync(path.join(direct, "package.json"))) return direct;
  }
  // 兜底：本地 tarball / 目录安装时包里没给包名，只找唯一一个带 package.json 的顶层包
  const modules = path.join(root, "node_modules");
  let found: string | null = null;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(modules, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const candidate = entry.name.startsWith("@")
      ? fs
          .readdirSync(path.join(modules, entry.name), { withFileTypes: true })
          .filter((sub) => sub.isDirectory())
          .map((sub) => path.join(modules, entry.name, sub.name))
      : [path.join(modules, entry.name)];
    for (const dir of candidate) {
      if (!fs.existsSync(path.join(dir, "package.json"))) continue;
      if (found) return null; // 多个包说不清是哪个，交给上层报错
      found = dir;
    }
  }
  return found;
}

export type InstallOptions = {
  registry?: string;
  timeoutMs?: number;
};

/**
 * 把包整包安装到临时目录（含解包），返回包根目录。
 * 调用方用完后必须删除返回的 root。
 */
export async function installMemePack(
  spec: string,
  options: InstallOptions = {},
): Promise<InstalledPack> {
  const trimmed = spec.trim();
  if (!trimmed) throw new Error("缺少 npm 包名，例如 mdocs-memes@latest");
  const registry = (options.registry ?? DEFAULT_MEME_REGISTRY).trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(registry)) throw new Error("registry 必须是 http(s) 地址");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-meme-pack-"));
  try {
    await run(
      "npm",
      [
        "install",
        trimmed,
        "--prefix",
        root,
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--no-save",
        "--no-package-lock",
        "--prefer-online",
        "--omit=dev",
        "--loglevel=error",
        "--registry",
        registry,
      ],
      options.timeoutMs ?? INSTALL_TIMEOUT_MS,
    );

    const dir = findInstalledDir(root, packNameOf(trimmed));
    if (!dir) throw new Error("安装完成但没找到包目录：" + trimmed);

    let version = "";
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as {
        version?: unknown;
      };
      version = typeof pkg.version === "string" ? pkg.version : "";
    } catch {
      /* 版本号只用于日志，读不到不影响同步 */
    }

    return { spec: trimmed, version, dir, root };
  } catch (err) {
    fs.rmSync(root, { recursive: true, force: true });
    throw err;
  }
}
