#!/usr/bin/env node
/**
 * 把 dsh-meme 格式的图库包转成 mdocs 的 dsh-meme 格式。
 *
 * 输入（dsh-meme 包，例如 memes/dafeiyu-001/）：
 *   manifest.json
 *   memes/<tag>/<file>.gif|jpg|png
 *   index.db（可选：SQLite，有 caption/keywords/tag 就能生成像样的 desc）
 *
 * 输出（mdocs 系统库）：
 *   meme.json  { version, memes: [{ id, desc, meme_name }] }
 *   <id>.<ext> ...（平铺）
 *
 *   node scripts/memes-import.mjs <packDir> <outDir>
 */
import fs from "node:fs";
import path from "node:path";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp"]);

function readIndexDb(packDir) {
  const dbFile = path.join(packDir, "index.db");
  if (!fs.existsSync(dbFile)) return new Map();
  let DatabaseSync;
  try {
    ({ DatabaseSync } = process.getBuiltinModule("node:sqlite"));
  } catch {
    console.warn("node:sqlite 不可用（需要 Node >= 22.5），desc 只能用文件名兜底");
    return new Map();
  }
  if (!DatabaseSync) return new Map();
  const db = new DatabaseSync(dbFile, { readOnly: true });
  const rows = db.prepare("SELECT file_name, tag, caption, keywords FROM memes").all();
  db.close();
  const map = new Map();
  for (const r of rows) map.set(String(r.file_name), r);
  return map;
}

function walkImages(dir, tag, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkImages(full, name, out);
    else if (IMAGE_EXT.has(path.extname(name).toLowerCase())) out.push({ tag, name, full });
  }
}

function baseId(fileName, used) {
  const stem = path.basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  let id = stem || "meme";
  let n = 2;
  while (used.has(id)) id = `${stem || "meme"}-${n++}`;
  used.add(id);
  return id;
}

const [packArg, outArg] = process.argv.slice(2);
if (!packArg || !outArg) {
  console.error("用法：node scripts/memes-import.mjs <packDir> <outDir>");
  process.exit(1);
}
const packDir = path.resolve(packArg);
const outDir = path.resolve(outArg);
const imagesDir = fs.existsSync(path.join(packDir, "memes"))
  ? path.join(packDir, "memes")
  : packDir;

const manifestFile = path.join(packDir, "manifest.json");
let manifest = {};
if (fs.existsSync(manifestFile)) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch {
    console.warn("manifest.json 解析失败，忽略");
  }
}

const meta = readIndexDb(packDir);
const found = [];
walkImages(imagesDir, path.basename(imagesDir), found);

fs.mkdirSync(outDir, { recursive: true });
const used = new Set();
const memes = [];
for (const item of found.sort((a, b) => a.name.localeCompare(b.name))) {
  const id = baseId(item.name, used);
  const ext = path.extname(item.name).toLowerCase();
  const memeName = `${id}${ext}`;
  const row = meta.get(item.name);
  const caption = row?.caption ? String(row.caption).trim() : "";
  const keywords = row?.keywords ? String(row.keywords).trim() : "";
  const tag = row?.tag ? String(row.tag).trim() : item.tag;
  // desc 必填：优先 index.db 的 caption，其次关键词，最后拿文件名凑
  const desc = (caption || keywords || `${path.basename(item.name, ext)}（${tag}）`).slice(0, 200);
  fs.copyFileSync(item.full, path.join(outDir, memeName));
  memes.push({ id, desc, meme_name: memeName });
}

fs.writeFileSync(
  path.join(outDir, "meme.json"),
  `${JSON.stringify({ version: 1, memes }, null, 2)}\n`,
  "utf8",
);
console.log(
  `done: ${memes.length} 张 → ${outDir}` +
    (manifest.name ? `（来源：${manifest.name} v${manifest.version ?? "?"}）` : ""),
);
console.log(`提示：该图库许可 = ${manifest.license ?? "未标注"}，自用可以，别公开分发。`);
