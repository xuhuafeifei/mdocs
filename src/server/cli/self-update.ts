/**
 * 全局安装原地升级：淘宝 npmmirror 拉最新包，保留 node_modules，npm --prefer-offline 补差量。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 写死：淘宝 npm 网关 */
export const MDOCS_UPDATE_REGISTRY = "https://registry.npmmirror.com";
/** 写死：要升级的包名 */
export const MDOCS_UPDATE_PACKAGE = "@fgbg/mdocs";

type PackageJson = {
  name?: string;
  version?: string;
};

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function fail(msg: string, code = 1): never {
  process.stderr.write(`mdocs update: ${msg}\n`);
  process.exit(code);
}

/** dist/server/cli/self-update.js → 包根 */
export function resolveInstalledPackageRoot(
  fromUrl: string = import.meta.url,
): string {
  const here = path.dirname(fileURLToPath(fromUrl));
  // .../dist/server/cli → 上三级 = package root
  return path.resolve(here, "../../..");
}

function readPackageJson(pkgRoot: string): PackageJson {
  const p = path.join(pkgRoot, "package.json");
  if (!fs.existsSync(p)) fail(`package.json not found at ${pkgRoot}`);
  return JSON.parse(fs.readFileSync(p, "utf8")) as PackageJson;
}

/** 开发仓库有 src/，拒绝原地覆盖 */
function assertNotDevWorkspace(pkgRoot: string): void {
  if (fs.existsSync(path.join(pkgRoot, "src", "server"))) {
    fail(
      "当前看起来是开发仓库（存在 src/server），拒绝原地覆盖。请在全局安装的 mdocs 上执行：npm install -g @fgbg/mdocs 之后再 mdocs update",
      2,
    );
  }
  const pkg = readPackageJson(pkgRoot);
  if (pkg.name !== MDOCS_UPDATE_PACKAGE) {
    fail(
      `包名不是 ${MDOCS_UPDATE_PACKAGE}（got ${pkg.name ?? "?"}），拒绝升级`,
      2,
    );
  }
}

function npm(args: string[], cwd?: string): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("npm", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env },
  });
  return {
    status: r.status ?? 1,
    stdout: (r.stdout ?? "").trim(),
    stderr: (r.stderr ?? "").trim(),
  };
}

function fetchLatestVersion(): string {
  const r = npm([
    "view",
    MDOCS_UPDATE_PACKAGE,
    "version",
    `--registry=${MDOCS_UPDATE_REGISTRY}`,
  ]);
  if (r.status !== 0 || !r.stdout) {
    fail(`无法从 ${MDOCS_UPDATE_REGISTRY} 查询版本：${r.stderr || r.stdout || "empty"}`);
  }
  return r.stdout.split("\n").pop()!.trim();
}

function packTo(destDir: string, version: string): string {
  fs.mkdirSync(destDir, { recursive: true });
  const r = npm(
    [
      "pack",
      `${MDOCS_UPDATE_PACKAGE}@${version}`,
      `--registry=${MDOCS_UPDATE_REGISTRY}`,
      `--pack-destination=${destDir}`,
    ],
    destDir,
  );
  if (r.status !== 0) {
    fail(`npm pack 失败：${r.stderr || r.stdout}`);
  }
  const lines = r.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  const tgzName = lines[lines.length - 1];
  if (!tgzName?.endsWith(".tgz")) {
    fail(`npm pack 未产出 tgz：${r.stdout}`);
  }
  const tgzPath = path.isAbsolute(tgzName) ? tgzName : path.join(destDir, tgzName);
  if (!fs.existsSync(tgzPath)) fail(`找不到 pack 产物 ${tgzPath}`);
  return tgzPath;
}

/** 保留 node_modules，其余用新包覆盖 */
function overlayPackage(pkgRoot: string, extractedPackageDir: string): void {
  for (const name of fs.readdirSync(pkgRoot)) {
    if (name === "node_modules") continue;
    fs.rmSync(path.join(pkgRoot, name), { recursive: true, force: true });
  }
  for (const name of fs.readdirSync(extractedPackageDir)) {
    const from = path.join(extractedPackageDir, name);
    const to = path.join(pkgRoot, name);
    fs.cpSync(from, to, { recursive: true });
  }
}

/** 只补差量依赖：不删 node_modules，prefer-offline 优先用本地缓存 */
function installDepsPreferOffline(pkgRoot: string): void {
  log("安装/同步依赖（--prefer-offline，保留已有 node_modules）…");
  const r = npm(
    [
      "install",
      "--omit=dev",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      "--legacy-peer-deps",
      `--registry=${MDOCS_UPDATE_REGISTRY}`,
    ],
    pkgRoot,
  );
  if (r.status !== 0) {
    fail(`npm install 失败：${r.stderr || r.stdout}`);
  }
  if (r.stdout) log(r.stdout);
}

/**
 * `mdocs update`：从淘宝镜像原地升级当前全局安装。
 */
export function runSelfUpdate(): void {
  const pkgRoot = resolveInstalledPackageRoot();
  assertNotDevWorkspace(pkgRoot);

  const current = readPackageJson(pkgRoot);
  const currentVersion = current.version ?? "?";
  log(`当前安装: ${pkgRoot}`);
  log(`当前版本: ${currentVersion}`);
  log(`镜像:     ${MDOCS_UPDATE_REGISTRY}`);

  const latest = fetchLatestVersion();
  log(`最新版本: ${latest}`);

  if (latest === currentVersion) {
    log("已是最新，无需升级。");
    return;
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "mdocs-update-"));
  try {
    log(`下载 ${MDOCS_UPDATE_PACKAGE}@${latest} …`);
    const tgz = packTo(work, latest);
    const extractDir = path.join(work, "extract");
    fs.mkdirSync(extractDir);
    const tar = spawnSync("tar", ["-xzf", tgz, "-C", extractDir], { encoding: "utf8" });
    if (tar.status !== 0) {
      fail(`解压失败：${tar.stderr || tar.stdout}`);
    }
    const inner = path.join(extractDir, "package");
    if (!fs.existsSync(inner)) fail("tgz 内无 package/ 目录");

    log("原地覆盖包文件（保留 node_modules）…");
    overlayPackage(pkgRoot, inner);
    installDepsPreferOffline(pkgRoot);

    const after = readPackageJson(pkgRoot);
    log(`升级完成: ${currentVersion} → ${after.version ?? latest}`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
