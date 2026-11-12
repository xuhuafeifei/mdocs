#!/usr/bin/env node
/**
 * 切换 mdocs 依赖的编辑器来源：
 *
 *   node scripts/editor-dep.mjs published   # 默认：npm 上的 @fgbg/lobe-editor（GitHub 用这个）
 *   node scripts/editor-dep.mjs local       # 本地 vendor/lobe-editor 的构建产物（改 fork 时用）
 *
 * 为什么要有这个开关：仓库里必须引用「发布后的包」，否则别人 clone 下来拿不到你的 fork；
 * 而在本地改 fork 时又不想每次都发版，所以临时切到 vendor/。切换会重写 package.json，
 * 本地模式产生的改动**不要提交**。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = path.join(ROOT, 'package.json');
const VENDOR = path.join(ROOT, 'vendor/lobe-editor/package.json');

const mode = process.argv[2];
if (mode !== 'local' && mode !== 'published') {
  console.error('用法：node scripts/editor-dep.mjs <local|published>');
  process.exit(1);
}

const vendorVersion = JSON.parse(fs.readFileSync(VENDOR, 'utf8')).version;
const target =
  mode === 'local' ? 'file:vendor/lobe-editor' : `npm:@fgbg/lobe-editor@${vendorVersion}`;

const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
const current = pkg.dependencies['@lobehub/editor'];
if (current === target) {
  console.log(`已经是 ${mode}：${target}`);
} else {
  pkg.dependencies['@lobehub/editor'] = target;
  fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`@lobehub/editor → ${target}`);
  console.log('重新安装依赖…');
  execFileSync('pnpm', ['install'], { cwd: ROOT, stdio: 'inherit' });
}

console.log(mode === 'local'
  ? '提示：package.json 现在是本地模式，提交前记得切回 published'
  : '已恢复为发布包模式');
