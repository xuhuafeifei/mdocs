/**
 * 表情包图库：系统库 + 租户库，两套同构，靠 meme.json 描述资源。
 *
 * 目录约定：
 *   <dataDir>/dsh-meme/                 系统库（随仓库下发，只读，可整体覆盖）
 *   <dataDir>/tenant/<vid>/dsh-meme/     租户库（用户上传，可增删改）
 *
 * 每套目录：meme.json + 图片文件
 *   { "version": 1,
 *     "memes": [{ "id": "s001", "desc": "憨笑，开心/打招呼", "meme_name": "s001.gif" }] }
 *
 * 检索顺序：系统库优先，再租户库（同 id 时系统库胜出）。
 * Agent 只认识 id —— 正文写 [meme:<id>]，前端拿 id 换图片。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../config/index.js";
import { installMemePack } from "./npm-source.js";
import { visitorTenantRoot } from "../plugins/plugin-paths.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("memes");

export const MEME_INDEX_FILENAME = "meme.json";

export type MemeEntry = {
  id: string;
  /** 必填：给 Agent 看的语义描述（决定它在什么场景被选中） */
  desc: string;
  /** 磁盘文件名，只允许 basename */
  meme_name: string;
};

export type MemeIndex = {
  version: number;
  memes: MemeEntry[];
};

export type MemeSource = "system" | "tenant";

export type ListedMeme = MemeEntry & { source: MemeSource };

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const DESC_MAX = 200;
/** 只认常见位图 + svg；不做内容嗅探，扩展名即真相 */
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp"]);

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
};

export function mimeForMemeFile(name: string): string {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

export function isMemeImageName(name: string): boolean {
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

export function systemMemesDir(): string {
  return path.join(getConfig().dataDir, "dsh-meme");
}

export function tenantMemesDir(visitorId: string): string {
  return path.join(visitorTenantRoot(visitorId), "dsh-meme");
}

/** 文件名必须是纯 basename：挡掉 ../ 与绝对路径 */
export function isSafeMemeName(name: string): boolean {
  const n = name.trim();
  return (
    n.length > 0 &&
    n.length <= 120 &&
    n === path.basename(n) &&
    !n.includes("\\") &&
    !n.includes("/") &&
    n !== "." &&
    n !== ".."
  );
}

export function isValidMemeId(id: string): boolean {
  return ID_RE.test(id.trim());
}

function normalizeEntry(raw: unknown): MemeEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === "string" ? rec.id.trim() : "";
  const desc = typeof rec.desc === "string" ? rec.desc.trim().slice(0, DESC_MAX) : "";
  const memeName = typeof rec.meme_name === "string" ? rec.meme_name.trim() : "";
  if (!isValidMemeId(id) || !desc || !isSafeMemeName(memeName)) return null;
  return { id, desc, meme_name: memeName };
}

/** 读索引；文件缺失或损坏都降级成空库，不让表情包拖垮启动 */
export function readMemeIndex(dir: string): MemeIndex {
  const file = path.join(dir, MEME_INDEX_FILENAME);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    const rec = (raw ?? {}) as Record<string, unknown>;
    const list = Array.isArray(rec.memes) ? rec.memes : [];
    const memes: MemeEntry[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const entry = normalizeEntry(item);
      if (!entry) {
        log.warn("meme.json 条目非法，已跳过", { dir, item });
        continue;
      }
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      memes.push(entry);
    }
    const version = typeof rec.version === "number" ? rec.version : 1;
    return { version, memes };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.warn("meme.json 读取失败，按空库处理", { dir, err: String(err) });
    }
    return { version: 1, memes: [] };
  }
}

function writeMemeIndex(dir: string, index: MemeIndex): void {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, MEME_INDEX_FILENAME);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

/** 系统库列表（管理页用） */
export function listSystemMemes(): ListedMeme[] {
  return readMemeIndex(systemMemesDir()).memes.map((entry) => ({ ...entry, source: "system" as const }));
}

/** 租户库列表（「我的表情包」用；不合并系统库，避免被系统的同 id 挡住） */
export function listTenantMemes(visitorId: string): ListedMeme[] {
  if (!visitorId) return [];
  return readMemeIndex(tenantMemesDir(visitorId)).memes.map((entry) => ({
    ...entry,
    source: "tenant" as const,
  }));
}

/** 系统库 + 租户库合并列表（系统优先，同 id 不重复） */
export function listMemes(visitorId: string): ListedMeme[] {
  const out: ListedMeme[] = [];
  const seen = new Set<string>();
  for (const entry of [...listSystemMemes(), ...listTenantMemes(visitorId)]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

/** 最近一次系统库同步的元信息（落盘在 dataDir 根，不随系统库目录一起被覆盖） */
export type MemeSyncMeta = {
  spec: string;
  version: string;
  /** ISO 时间 */
  syncedAt: string;
  count: number;
};

function memeSyncMetaPath(): string {
  return path.join(getConfig().dataDir, "dsh-meme-meta.json");
}

export function readMemeSyncMeta(): MemeSyncMeta | null {
  try {
    const raw = JSON.parse(fs.readFileSync(memeSyncMetaPath(), "utf8")) as unknown;
    const rec = (raw ?? {}) as Record<string, unknown>;
    if (typeof rec.syncedAt !== "string" || typeof rec.spec !== "string") return null;
    return {
      spec: rec.spec,
      version: typeof rec.version === "string" ? rec.version : "",
      syncedAt: rec.syncedAt,
      count: typeof rec.count === "number" ? rec.count : 0,
    };
  } catch {
    return null;
  }
}

function writeMemeSyncMeta(meta: MemeSyncMeta): void {
  try {
    fs.writeFileSync(memeSyncMetaPath(), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  } catch (err) {
    // 元信息只服务管理页展示，写失败不能影响同步结果
    log.warn("表情包同步元信息写入失败", { err: String(err) });
  }
}

export type ResolvedMeme = {
  entry: MemeEntry;
  filePath: string;
  source: MemeSource;
  mime: string;
};

/** 按 id 取图；系统库优先，再租户库；文件不存在按未找到处理 */
export function resolveMeme(visitorId: string, rawId: string): ResolvedMeme | null {
  const id = rawId.trim();
  if (!isValidMemeId(id)) return null;
  for (const [source, dir] of [
    ["system", systemMemesDir()],
    ["tenant", visitorId ? tenantMemesDir(visitorId) : ""],
  ] as const) {
    if (!dir) continue;
    const entry = readMemeIndex(dir).memes.find((m) => m.id === id);
    if (!entry) continue;
    const filePath = path.join(dir, entry.meme_name);
    if (!fs.existsSync(filePath)) continue;
    return { entry, filePath, source, mime: mimeForMemeFile(entry.meme_name) };
  }
  return null;
}

function rollTenantId(visitorId: string): string {
  const used = new Set(readMemeIndex(tenantMemesDir(visitorId)).memes.map((m) => m.id));
  for (let i = 0; i < 50; i += 1) {
    const id = `u${crypto.randomBytes(4).toString("hex")}`;
    if (!used.has(id)) return id;
  }
  throw new Error("无法分配表情包 id");
}

export type AddMemeInput = {
  buffer: Buffer;
  originalName: string;
  desc: string;
  /** 可选：自定义文件名（默认 <id><ext>） */
  memeName?: string;
};

/** 新增租户表情包：id 由系统 roll，desc 必填 */
export function addTenantMeme(visitorId: string, input: AddMemeInput): MemeEntry {
  const desc = input.desc.trim().slice(0, DESC_MAX);
  if (!desc) throw new Error("desc 必填：请用一句话描述这张表情包，方便助手判断何时使用");
  const ext = path.extname(input.originalName).toLowerCase();
  if (!IMAGE_EXT.has(ext)) throw new Error(`不支持的图片类型：${ext || "（无扩展名）"}`);
  const dir = tenantMemesDir(visitorId);
  const id = rollTenantId(visitorId);
  const desired = input.memeName?.trim();
  const memeName = desired && isSafeMemeName(desired) && isMemeImageName(desired)
    ? desired
    : `${id}${ext}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, memeName), input.buffer);
  const index = readMemeIndex(dir);
  const entry: MemeEntry = { id, desc, meme_name: memeName };
  index.memes.push(entry);
  writeMemeIndex(dir, index);
  return entry;
}

/** 只改描述（不含文件名/图内容），系统库不可改 */
export function updateTenantMeme(
  visitorId: string,
  id: string,
  patch: { desc?: string },
): MemeEntry {
  const dir = tenantMemesDir(visitorId);
  const index = readMemeIndex(dir);
  const entry = index.memes.find((m) => m.id === id);
  if (!entry) throw new Error("表情包不存在（系统内置的表情包不可编辑）");
  if (patch.desc !== undefined) {
    const desc = patch.desc.trim().slice(0, DESC_MAX);
    if (!desc) throw new Error("desc 不能为空");
    entry.desc = desc;
  }
  writeMemeIndex(dir, index);
  return entry;
}

export function deleteTenantMeme(visitorId: string, id: string): void {
  const dir = tenantMemesDir(visitorId);
  const index = readMemeIndex(dir);
  const idx = index.memes.findIndex((m) => m.id === id);
  if (idx < 0) {
    throw new Error(
      readMemeIndex(systemMemesDir()).memes.some((m) => m.id === id)
        ? "系统内置表情包不可删除"
        : "表情包不存在",
    );
  }
  const [entry] = index.memes.splice(idx, 1);
  if (entry) {
    try {
      fs.rmSync(path.join(dir, entry.meme_name), { force: true });
    } catch {
      /* 文件已不在也不影响索引一致性 */
    }
  }
  writeMemeIndex(dir, index);
}

export type SyncResult = {
  /** 包里 package.json 的版本号（读不到时为空串，只影响日志） */
  version: string;
  /** 写入的图片张数 */
  written: number;
  /** 写入的图片总字节数 */
  bytes: number;
};

/** 同一时刻只允许一次整包同步：整目录替换期间并发会互相踩 */
let syncInFlight = false;

/** 启动后台同步与设置页默认用的 npm 包 */
export const DEFAULT_SYSTEM_MEME_SPEC = "mdocs-memes@latest";

/** 系统库是否至少有一张可读图片（空目录 / 空索引 / 索引有但文件全缺 → false） */
export function isSystemMemeLibraryReady(): boolean {
  const memes = listSystemMemes();
  if (memes.length === 0) return false;
  const dir = systemMemesDir();
  return memes.some((m) => {
    try {
      const st = fs.statSync(path.join(dir, m.meme_name));
      return st.isFile() && st.size > 0;
    } catch {
      return false;
    }
  });
}

/**
 * 启动旁挂：系统库为空则后台 `syncSystemMemesFrom`，不阻塞 listen。
 * 已有图则直接返回；失败只打日志，可稍后在设置页手动同步。
 */
export function ensureSystemMemesBackground(
  spec: string = DEFAULT_SYSTEM_MEME_SPEC,
): void {
  if (isSystemMemeLibraryReady()) return;
  const target = (spec.trim() || DEFAULT_SYSTEM_MEME_SPEC);
  log.info("系统表情包为空，后台同步中…", { spec: target });
  void syncSystemMemesFrom(target)
    .then((result) => {
      log.info("系统表情包后台同步完成", {
        version: result.version,
        written: result.written,
        bytes: result.bytes,
      });
    })
    .catch((err) => {
      log.warn("系统表情包后台同步失败（可稍后在设置页手动同步）", {
        err: err instanceof Error ? err.message : String(err),
      });
    });
}

/**
 * 从 npm 覆盖系统库：整包安装到临时目录 → 只挑 meme.json 与清单里的图片 →
 * 校验 → 原子覆盖系统库目录。
 *
 * 不再逐张下载：发布包本身就是「meme.json + 图片」的平铺集合，一次 npm install
 * 既下载又解包，清单与文件天然一致；中途任何一步失败都只清理临时目录，旧库原样保留。
 */
export async function syncSystemMemesFrom(spec: string): Promise<SyncResult> {
  if (syncInFlight) throw new Error("系统表情包正在同步中，请稍后再试");
  syncInFlight = true;
  const target = systemMemesDir();
  const incoming = `${target}.incoming-${process.pid}`;
  const backup = `${target}.bak`;
  try {
    const pack = await installMemePack(spec, { registry: getConfig().memeRegistry });
    try {
      const indexPath = path.join(pack.dir, MEME_INDEX_FILENAME);
      if (!fs.existsSync(indexPath)) throw new Error("包里没有 meme.json，不是表情包");
      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(fs.readFileSync(indexPath, "utf8")) as Record<string, unknown>;
      } catch {
        throw new Error("包里的 meme.json 不是合法 JSON");
      }
      const declared = Array.isArray(raw?.memes) ? raw.memes.length : 0;
      const index = readMemeIndex(pack.dir);
      if (declared === 0) throw new Error("包里的 meme.json 没有 memes 条目");
      if (index.memes.length !== declared) {
        throw new Error(`包里 meme.json 有 ${declared - index.memes.length} 条非法条目`);
      }

      fs.rmSync(incoming, { recursive: true, force: true });
      fs.mkdirSync(incoming, { recursive: true });
      let bytes = 0;
      for (const entry of index.memes) {
        const from = path.join(pack.dir, entry.meme_name);
        const stat = fs.existsSync(from) ? fs.statSync(from) : null;
        if (!stat || !stat.isFile() || stat.size === 0) {
          throw new Error(`包里缺图片：${entry.meme_name}`);
        }
        fs.copyFileSync(from, path.join(incoming, entry.meme_name));
        bytes += stat.size;
      }
      writeMemeIndex(incoming, { version: index.version, memes: index.memes });

      // 整目录替换：备份 → 换入 → 清备份；失败时把旧库换回去
      fs.rmSync(backup, { recursive: true, force: true });
      const hadOld = fs.existsSync(target);
      if (hadOld) fs.renameSync(target, backup);
      try {
        fs.renameSync(incoming, target);
      } catch (err) {
        if (hadOld) fs.renameSync(backup, target);
        throw err;
      }
      fs.rmSync(backup, { recursive: true, force: true });
      writeMemeSyncMeta({
        spec: pack.spec,
        version: pack.version,
        syncedAt: new Date().toISOString(),
        count: index.memes.length,
      });

      log.info("系统表情包已更新", {
        spec: pack.spec,
        version: pack.version,
        written: index.memes.length,
        bytes,
      });
      return { version: pack.version, written: index.memes.length, bytes };
    } finally {
      fs.rmSync(pack.root, { recursive: true, force: true });
    }
  } catch (err) {
    fs.rmSync(incoming, { recursive: true, force: true });
    throw err;
  } finally {
    syncInFlight = false;
  }
}
