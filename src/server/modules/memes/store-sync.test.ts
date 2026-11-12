/**
 * 系统库整包同步：成功替换 / 陈旧文件清理 / 失败不动旧库。
 * npm 安装被 mock 掉，这里只验证「解包后的落盘与原子替换」这一段。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const installMemePack = vi.fn();

vi.mock("./npm-source.js", () => ({
  installMemePack: (...args: unknown[]) => installMemePack(...args),
}));

const { resetConfigCacheForTests } = await import("../../infra/config");
const {
  addTenantMeme,
  ensureSystemMemesBackground,
  isSystemMemeLibraryReady,
  listSystemMemes,
  listTenantMemes,
  readMemeIndex,
  readMemeSyncMeta,
  syncSystemMemesFrom,
  systemMemesDir,
} = await import("./store.js");

type Pack = { spec: string; version: string; dir: string; root: string };

function makePack(memes: { id: string; desc: string; name: string; bytes?: number }[]): Pack {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "meme-test-"));
  const dir = path.join(root, "pkg");
  fs.mkdirSync(dir, { recursive: true });
  for (const m of memes) {
    fs.writeFileSync(path.join(dir, m.name), Buffer.alloc(m.bytes ?? 8, 1));
  }
  fs.writeFileSync(
    path.join(dir, "meme.json"),
    JSON.stringify({
      version: 1,
      memes: memes.map((m) => ({ id: m.id, desc: m.desc, meme_name: m.name })),
    }),
    "utf8",
  );
  return { spec: "mdocs-memes@latest", version: "9.9.9", dir, root };
}

let dataDir = "";

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "meme-data-"));
  process.env.MDOCS_DATA_DIR = dataDir;
  resetConfigCacheForTests();
  installMemePack.mockReset();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("syncSystemMemesFrom", () => {
  it("整包落盘：只留 meme.json 与清单里的图片", async () => {
    const pack = makePack([
      { id: "a1", desc: "第一张", name: "a1.webp", bytes: 10 },
      { id: "b2", desc: "第二张", name: "b2.webp", bytes: 20 },
    ]);
    // 包里多出来的文件（README、子目录）不该被拷进系统库
    fs.writeFileSync(path.join(pack.dir, "README.md"), "x");
    fs.mkdirSync(path.join(pack.dir, "sheets"));
    installMemePack.mockResolvedValue(pack);

    const result = await syncSystemMemesFrom("mdocs-memes@latest");

    expect(result).toMatchObject({ version: "9.9.9", written: 2, bytes: 30 });
    const dir = systemMemesDir();
    expect(fs.readdirSync(dir).sort()).toEqual(["a1.webp", "b2.webp", "meme.json"]);
    expect(readMemeIndex(dir).memes.map((m) => m.id)).toEqual(["a1", "b2"]);
    expect(fs.existsSync(pack.root)).toBe(false);
  });

  it("覆盖式替换：上一次留下的图不会残留", async () => {
    const first = makePack([{ id: "old", desc: "旧图", name: "old.webp" }]);
    installMemePack.mockResolvedValue(first);
    await syncSystemMemesFrom("mdocs-memes@1");
    expect(fs.existsSync(path.join(systemMemesDir(), "old.webp"))).toBe(true);

    const second = makePack([{ id: "new", desc: "新图", name: "new.webp" }]);
    installMemePack.mockResolvedValue(second);
    await syncSystemMemesFrom("mdocs-memes@2");

    expect(fs.readdirSync(systemMemesDir()).sort()).toEqual(["meme.json", "new.webp"]);
  });

  it("清单指向的图片缺失时报错，且旧库原样保留", async () => {
    const good = makePack([{ id: "k1", desc: "保留", name: "k1.webp" }]);
    installMemePack.mockResolvedValue(good);
    await syncSystemMemesFrom("mdocs-memes@1");

    const broken = makePack([{ id: "k1", desc: "保留", name: "k1.webp" }]);
    fs.rmSync(path.join(broken.dir, "k1.webp"));
    installMemePack.mockResolvedValue(broken);

    await expect(syncSystemMemesFrom("mdocs-memes@2")).rejects.toThrow(/缺图片/);
    expect(fs.readdirSync(systemMemesDir()).sort()).toEqual(["k1.webp", "meme.json"]);
    expect(fs.existsSync(path.join(systemMemesDir(), "k1.webp"))).toBe(true);
  });

  it("同步成功后写入元信息（版本 / 张数 / 时间）", async () => {
    const pack = makePack([
      { id: "m1", desc: "一", name: "m1.webp" },
      { id: "m2", desc: "二", name: "m2.webp" },
    ]);
    installMemePack.mockResolvedValue(pack);
    await syncSystemMemesFrom("mdocs-memes@latest");

    const meta = readMemeSyncMeta();
    expect(meta).not.toBeNull();
    expect(meta?.version).toBe("9.9.9");
    expect(meta?.count).toBe(2);
    expect(Number.isNaN(Date.parse(meta?.syncedAt ?? ""))).toBe(false);
  });

  it("系统库 / 租户库分开取，互不串台", async () => {
    const pack = makePack([{ id: "s1", desc: "系统图", name: "s1.webp" }]);
    installMemePack.mockResolvedValue(pack);
    await syncSystemMemesFrom("mdocs-memes@latest");

    addTenantMeme("visitor-1", {
      buffer: Buffer.from([1, 2, 3]),
      originalName: "mine.webp",
      desc: "我的图",
    });

    expect(listSystemMemes().map((m) => m.id)).toEqual(["s1"]);
    const mine = listTenantMemes("visitor-1");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.desc).toBe("我的图");
    expect(mine[0]?.source).toBe("tenant");
    expect(listTenantMemes("someone-else")).toEqual([]);
  });

  it("meme.json 里有非法条目时失败，不静默丢图", async () => {
    const pack = makePack([{ id: "ok", desc: "正常", name: "ok.webp" }]);
    const raw = JSON.parse(fs.readFileSync(path.join(pack.dir, "meme.json"), "utf8")) as {
      memes: unknown[];
    };
    raw.memes.push({ id: "bad id!", desc: "", meme_name: "../x.webp" });
    fs.writeFileSync(path.join(pack.dir, "meme.json"), JSON.stringify(raw));
    installMemePack.mockResolvedValue(pack);

    await expect(syncSystemMemesFrom("mdocs-memes@latest")).rejects.toThrow(/非法条目/);
  });
});

describe("ensureSystemMemesBackground", () => {
  it("空库时后台触发同步，完成后就绪", async () => {
    expect(isSystemMemeLibraryReady()).toBe(false);
    const pack = makePack([{ id: "boot", desc: "启动", name: "boot.webp" }]);
    installMemePack.mockResolvedValue(pack);

    ensureSystemMemesBackground("mdocs-memes@latest");
    await vi.waitFor(() => {
      expect(isSystemMemeLibraryReady()).toBe(true);
    });
    expect(installMemePack).toHaveBeenCalledTimes(1);
    expect(listSystemMemes().map((m) => m.id)).toEqual(["boot"]);
  });

  it("已有图时不再触发同步", async () => {
    const pack = makePack([{ id: "keep", desc: "已有", name: "keep.webp" }]);
    installMemePack.mockResolvedValue(pack);
    await syncSystemMemesFrom("mdocs-memes@latest");
    installMemePack.mockClear();

    ensureSystemMemesBackground("mdocs-memes@latest");
    await new Promise((r) => setTimeout(r, 30));
    expect(installMemePack).not.toHaveBeenCalled();
  });
});
