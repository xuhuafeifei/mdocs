/**
 * 数据迁移：将 ___desc___.md 文件的 file_type 从 'md' 改为 'folder_desc'。
 *
 * 用法：
 *   npx tsx src/server/migrations/003-folder-desc-file-type.ts
 *
 * 会自动从 ~/.mdocs/ 读取数据库，也可以通过 MDOCS_DATA_DIR 环境变量指定。
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const dataDir = process.env.MDOCS_DATA_DIR?.trim() || path.join(os.homedir(), '.mdocs');
const dbFile = path.join(dataDir, 'sqlite', 'data.sqlite');

if (!fs.existsSync(dbFile)) {
  console.error(`数据库文件不存在：${dbFile}`);
  process.exit(1);
}

const db = new Database(dbFile);

// 统计当前 ___desc___.md 的数量
const countResult = db.prepare(
  `SELECT COUNT(*) as cnt FROM documents WHERE relative_path LIKE '%/___desc___.md' AND file_type = 'md'`,
).get() as { cnt: number };

console.log(`找到 ${countResult.cnt} 个 ___desc___.md 文件（file_type = 'md'）`);

if (countResult.cnt === 0) {
  console.log('无需迁移。');
  process.exit(0);
}

// 执行更新
const result = db.prepare(
  `UPDATE documents SET file_type = 'folder_desc', updated_at = datetime('now') 
   WHERE relative_path LIKE '%/___desc___.md' AND file_type = 'md'`,
).run();

console.log(`已更新 ${result.changes} 条记录。`);

// 验证
const verifyResult = db.prepare(
  `SELECT COUNT(*) as cnt FROM documents WHERE relative_path LIKE '%/___desc___.md' AND file_type = 'folder_desc'`,
).get() as { cnt: number };

console.log(`验证：当前有 ${verifyResult.cnt} 个 folder_desc 类型的 ___desc___.md 文件。`);

// 打印前 5 条看看
const rows = db.prepare(
  `SELECT relative_path, file_type FROM documents 
   WHERE relative_path LIKE '%/___desc___.md' LIMIT 5`,
).all();

console.log('\n前 5 条：');
for (const row of rows as any[]) {
  console.log(`  ${row.file_type}\t${row.relative_path}`);
}

db.close();
console.log('\n迁移完成。');
