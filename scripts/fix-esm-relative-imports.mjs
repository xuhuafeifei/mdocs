/**
 * tsc (moduleResolution: Bundler) 不会给相对 import 补 .js。
 * Node ESM 需要显式扩展名 /index.js。本脚本在 emit 后按磁盘现状改写。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(root, "dist/server");

const IMPORT_RE =
  /(?<=(?:from|import|export)\s+(?:[^'";]*?\s+from\s+)?)["'](\.[^"']+)["']/g;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && ent.name.endsWith(".js")) out.push(p);
  }
  return out;
}

function resolveSpecifier(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  if (/\.(js|json|node|mjs|cjs)(\?|$)/.test(spec)) return null;

  const base = path.resolve(path.dirname(fromFile), spec);
  if (fs.existsSync(`${base}.js`) && fs.statSync(`${base}.js`).isFile()) {
    return `${spec}.js`;
  }
  const indexJs = path.join(base, "index.js");
  if (fs.existsSync(indexJs) && fs.statSync(indexJs).isFile()) {
    return `${spec}/index.js`;
  }
  return null;
}

if (!fs.existsSync(distRoot)) {
  console.error(`missing ${path.relative(root, distRoot)}`);
  process.exit(1);
}

let files = 0;
let patches = 0;
for (const file of walk(distRoot)) {
  const src = fs.readFileSync(file, "utf8");
  let changed = false;
  const next = src.replace(IMPORT_RE, (full, spec) => {
    const fixed = resolveSpecifier(file, spec);
    if (!fixed || fixed === spec) return full;
    changed = true;
    patches += 1;
    return full.replace(spec, fixed);
  });
  if (changed) {
    fs.writeFileSync(file, next);
    files += 1;
  }
}

console.log(`fixed ESM relative imports: ${patches} in ${files} files`);
