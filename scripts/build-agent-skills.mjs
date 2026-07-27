#!/usr/bin/env node
/**
 * mdocs-site docs → agent-skills/（生成物，勿手改）
 * 用法：node scripts/build-agent-skills.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDocs =
  process.env.MDOCS_SITE_DOCS?.trim() ||
  path.resolve(root, "../mdocs-site/docs/docs");
const outDir = path.join(root, "agent-skills");

if (!fs.existsSync(siteDocs)) {
  console.warn(`[skills:build] site docs missing: ${siteDocs}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.json"), "[]\n");
  process.exit(0);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

/** @type {{ id: string, name: string, description: string, keywords: string[], source: string }[]} */
const index = [];

for (const rel of walk(siteDocs)) {
  if (!rel.endsWith(".md") && !rel.endsWith(".mdx")) continue;
  const abs = path.join(siteDocs, rel);
  const raw = fs.readFileSync(abs, "utf8");
  const id = rel
    .replace(/\.(md|mdx)$/, "")
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase();
  const name = (raw.match(/^#\s+(.+)$/m)?.[1] ?? id).trim();
  const description = firstParagraph(raw) || name;
  const dir = path.join(outDir, id);
  fs.mkdirSync(dir, { recursive: true });
  const body = `---\nid: ${id}\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\nkeywords: []\nsource: ${rel}\n---\n\n${stripFrontmatter(raw)}\n`;
  fs.writeFileSync(path.join(dir, "SKILL.md"), body);
  index.push({ id, name, description, keywords: [], source: rel });
}

fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`[skills:build] ${index.length} skills → ${outDir}`);

function walk(dir, base = "") {
  /** @type {string[]} */
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const abs = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (fs.statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
}

function stripFrontmatter(s) {
  return s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

function firstParagraph(s) {
  const text = stripFrontmatter(s)
    .replace(/^#.*$/m, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
  const para = text.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("|") && !p.trim().startsWith("#"));
  return (para ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
}
