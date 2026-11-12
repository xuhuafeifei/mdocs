/**
 * 数据迁移：将 agent_model_configs 表中的 api_key 明文迁移到 secrets 文件。
 *
 * - 读取所有 api_key 明文，写入 ~/.mdocs/secrets/api-keys.json
 * - 清空 DB 中的 api_key 字段（设为空串）
 * - 以后 apiKey 只存在 secrets 文件里，DB 只做引用
 *
 * 用法：
 *   npx tsx src/server/migrations/004-api-key-to-secrets.ts
 *
 * 会自动从 ~/.mdocs/ 读取数据库，也可以通过 MDOCS_DATA_DIR 环境变量指定。
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const dataDir = process.env.MDOCS_DATA_DIR?.trim() || path.join(os.homedir(), '.mdocs');
const dbFile = path.join(dataDir, 'sqlite', 'data.sqlite');
const secretsDir = path.join(dataDir, 'secrets');
const apiKeysFile = path.join(secretsDir, 'api-keys.json');

if (!fs.existsSync(dbFile)) {
  console.error(`数据库文件不存在：${dbFile}`);
  process.exit(1);
}

const db = new Database(dbFile);

// 检查表是否存在
const tableExists = db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name='agent_model_configs'`,
).get();
if (!tableExists) {
  console.log('agent_model_configs 表不存在，无需迁移。');
  db.close();
  process.exit(0);
}

// 读取所有 api_key
const rows = db.prepare(
  `SELECT owner_visitor_id, api_key FROM agent_model_configs WHERE api_key IS NOT NULL AND api_key != ''`,
).all() as Array<{ owner_visitor_id: string; api_key: string }>;

console.log(`找到 ${rows.length} 条带 api_key 的配置`);

if (rows.length === 0) {
  console.log('无需迁移。');
  db.close();
  process.exit(0);
}

// 确保 secrets 目录存在
if (!fs.existsSync(secretsDir)) {
  fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
}

// 读取现有 secrets 文件（如果有的话）
let existingKeys: Record<string, string> = {};
if (fs.existsSync(apiKeysFile)) {
  try {
    existingKeys = JSON.parse(fs.readFileSync(apiKeysFile, 'utf8'));
  } catch {
    console.log('现有 secrets 文件解析失败，将覆盖。');
    existingKeys = {};
  }
}

// 合并新的 key
let migratedCount = 0;
for (const row of rows) {
  if (!existingKeys[row.owner_visitor_id]) {
    existingKeys[row.owner_visitor_id] = row.api_key;
    migratedCount++;
  }
}

// 原子写入
const tmpFile = `${apiKeysFile}.tmp.${process.pid}`;
try {
  fs.writeFileSync(tmpFile, JSON.stringify(existingKeys, null, 2), { mode: 0o600 });
  fs.renameSync(tmpFile, apiKeysFile);
} catch (e) {
  console.error('写入 secrets 文件失败：', e);
  if (fs.existsSync(tmpFile)) {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
  db.close();
  process.exit(1);
}

console.log(`已迁移 ${migratedCount} 个 api_key 到 secrets 文件`);

// 清空 DB 中的 api_key 字段
const result = db.prepare(
  `UPDATE agent_model_configs SET api_key = '' WHERE api_key IS NOT NULL AND api_key != ''`,
).run();

console.log(`已清空 DB 中 ${result.changes} 条记录的 api_key 字段`);

// 验证
const verifyCount = db.prepare(
  `SELECT COUNT(*) as cnt FROM agent_model_configs WHERE api_key IS NOT NULL AND api_key != ''`,
).get() as { cnt: number };

console.log(`验证：DB 中剩余 ${verifyCount.cnt} 条非空 api_key 记录`);

db.close();
console.log('\n迁移完成。');
