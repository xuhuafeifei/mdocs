/**
 * 数据迁移：特殊文件 document_id 后缀格式统一。
 *
 * 旧格式 → 新格式：
 * - folder_desc: {dirId}-folder-desc → {dirId}.folder-desc
 * - graph_file:    {resourceId}-graph → {resourceId}.graph-file
 * - graph_dir:    随机 UUID → {parentId}.graph-dir
 *
 * 用法：
 *   npx tsx src/server/migrations/005-special-file-id-format.ts
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

// 所有包含 document_id 的表
const tablesWithDocId = [
  'documents',
  'document_commits',
  'audit_logs',
  'document_invites',
  'document_bookmarks',
  'document_comments',
];

function getNewId(row: {
  document_id: string;
  parent_id: string | null;
  file_type: string;
}): string | null {
  if (row.file_type === 'folder_desc') {
    if (!row.parent_id) return null;
    return `${row.parent_id}.folder-desc`;
  }

  if (row.file_type === 'graph_file') {
    // 从旧 ID 去掉 -graph 后缀得到 resourceId
    if (row.document_id.endsWith('-graph')) {
      const resourceId = row.document_id.slice(0, -'-graph'.length);
      return `${resourceId}.graph-file`;
    }
    return null; // 格式不对，跳过
  }

  if (row.file_type === 'graph_dir') {
    if (!row.parent_id) return null;
    return `${row.parent_id}.graph-dir`;
  }

  return null;
}

// 找出所有特殊文件
const specialRows = db.prepare(`
  SELECT document_id, parent_id, file_type, relative_path
  FROM documents
  WHERE file_type IN ('folder_desc', 'graph_file', 'graph_dir')
`).all() as Array<{
  document_id: string;
  parent_id: string | null;
  file_type: string;
  relative_path: string;
}>;

console.log(`找到 ${specialRows.length} 个特殊文件：`);
console.log(`  folder_desc: ${specialRows.filter(r => r.file_type === 'folder_desc').length}`);
console.log(`  graph_file:  ${specialRows.filter(r => r.file_type === 'graph_file').length}`);
console.log(`  graph_dir:   ${specialRows.filter(r => r.file_type === 'graph_dir').length}`);

if (specialRows.length === 0) {
  console.log('无需迁移。');
  db.close();
  process.exit(0);
}

// 关外键
db.pragma('foreign_keys = OFF');

let totalUpdated = 0;

for (const row of specialRows) {
  const oldId = row.document_id;
  const newId = getNewId(row);

  if (!newId) {
    console.log(`  ⚠ 跳过（无法推断新ID）: ${row.file_type} ${oldId}`);
    continue;
  }

  if (oldId === newId) continue;

  // 检查目标 ID 是否已存在
  const existing = db
    .prepare('SELECT document_id FROM documents WHERE document_id = ?')
    .get(newId);
  if (existing) {
    console.log(`  ⚠ 跳过（目标ID已存在）: ${oldId} → ${newId}`);
    continue;
  }

  // 更新所有表
  for (const table of tablesWithDocId) {
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

console.log(`\n共更新 ${totalUpdated} 条记录（所有表合计）`);

// 验证
const verifyRows = db.prepare(`
  SELECT document_id, parent_id, file_type
  FROM documents
  WHERE file_type IN ('folder_desc', 'graph_file', 'graph_dir')
  ORDER BY file_type
  LIMIT 15
`).all() as Array<{ document_id: string; parent_id: string | null; file_type: string }>;

console.log('\n验证（前 15 条）：');
for (const row of verifyRows) {
  const expected = getNewId(row);
  const ok = expected && row.document_id === expected ? '✓' : '✗';
  console.log(`  ${ok} [${row.file_type}] ${row.document_id}`);
  if (expected) {
    console.log(`         期望: ${expected}`);
  }
}

db.close();
console.log('\n迁移完成。');
