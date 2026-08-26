/**
 * 数据迁移：将 ___desc___.md 文件的 document_id 改为 `{parent_dir_id}-folder-desc`。
 *
 * 用法：
 *   npx tsx src/server/migrations/004-folder-desc-id.ts
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

// 找出所有 ___desc___.md 文件（有父目录的）
const descRows = db.prepare(`
  SELECT document_id, parent_id, relative_path
  FROM documents
  WHERE relative_path LIKE '%/___desc___.md'
    AND parent_id IS NOT NULL
`).all() as Array<{ document_id: string; parent_id: string; relative_path: string }>;

console.log(`找到 ${descRows.length} 个 ___desc___.md 文件`);

if (descRows.length === 0) {
  console.log('无需迁移。');
  db.close();
  process.exit(0);
}

// 检查目标 ID 是否已存在（避免冲突）
const conflicts = descRows.filter((row) => {
  const newId = `${row.parent_id}-folder-desc`;
  const existing = db
    .prepare('SELECT document_id FROM documents WHERE document_id = ?')
    .get(newId);
  return !!existing && existing !== row.document_id;
});

if (conflicts.length > 0) {
  console.error(`有 ${conflicts.length} 个目标 ID 已存在，迁移中止：`);
  for (const c of conflicts) {
    console.error(`  ${c.relative_path} -> ${c.parent_id}-folder-desc`);
  }
  db.close();
  process.exit(1);
}

// 需要更新 document_id 的表
const tablesWithDocId = [
  'documents',
  'document_commits',
  'audit_logs',
  'document_invites',
  'document_bookmarks',
  'document_comments',
];

// 临时关闭外键检查
db.pragma('foreign_keys = OFF');

let totalUpdated = 0;

for (const row of descRows) {
  const oldId = row.document_id;
  const newId = `${row.parent_id}-folder-desc`;

  if (oldId === newId) continue; // 已经是目标格式，跳过

  for (const table of tablesWithDocId) {
    // 检查表是否存在 document_id 列
    const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'document_id')) continue;

    const result = db
      .prepare(`UPDATE ${table} SET document_id = ? WHERE document_id = ?`)
      .run(newId, oldId);

    if (result.changes > 0) {
      totalUpdated += result.changes;
    }
  }
}

db.pragma('foreign_keys = ON');

console.log(`共更新 ${totalUpdated} 条记录（所有表合计）`);

// 验证
const verifyRows = db.prepare(`
  SELECT document_id, parent_id, relative_path
  FROM documents
  WHERE relative_path LIKE '%/___desc___.md'
  LIMIT 10
`).all() as Array<{ document_id: string; parent_id: string; relative_path: string }>;

console.log('\n验证（前 10 条）：');
for (const row of verifyRows) {
  const expected = `${row.parent_id}-folder-desc`;
  const ok = row.document_id === expected ? '✓' : '✗';
  console.log(`  ${ok} ${row.relative_path}`);
  console.log(`      当前: ${row.document_id}`);
  console.log(`      期望: ${expected}`);
}

db.close();
console.log('\n迁移完成。');
