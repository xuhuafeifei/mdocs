/** Copy non-TS plugin assets into dist (tsc does not). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src/server/plugins/bundled");
const dest = path.join(root, "dist/server/plugins/bundled");
fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
}
console.log(`copied bundled plugins → ${path.relative(root, dest)}`);
