import type Database from "better-sqlite3";
import { backfillFolderDescHeadCommits } from "../documents/initial-commit.js";

/** 数据库初始化所需的全部 DDL 语句，按顺序执行。 */
const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS visitors (
    visitor_id TEXT PRIMARY KEY,
    visitor_name TEXT NOT NULL UNIQUE,
    visitor_token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT,
    disabled_at TEXT,
    merged_into_visitor_id TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_visitors_token_hash ON visitors (visitor_token_hash)`,
  `CREATE TABLE IF NOT EXISTS visitor_sessions (
    session_id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    device_name TEXT,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    FOREIGN KEY (visitor_id) REFERENCES visitors(visitor_id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor ON visitor_sessions (visitor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_visitor_sessions_token_hash ON visitor_sessions (token_hash)`,
  `CREATE TABLE IF NOT EXISTS domains (
    domain_id TEXT PRIMARY KEY,
    domain_name TEXT NOT NULL UNIQUE,
    creator_visitor_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'public'
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    document_id TEXT PRIMARY KEY,
    domain_id TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    display_name TEXT NOT NULL,
    owner_visitor_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    head_commit_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    permission INTEGER NOT NULL DEFAULT 1,
    file_type TEXT NOT NULL DEFAULT 'md',
    parent_id TEXT,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    UNIQUE(domain_id, relative_path)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_documents_domain ON documents (domain_id)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents (owner_visitor_id)`,
  // document_commits：每次 publish 一条节点；commit_parents：DAG 边（merge 时一子多父）
  `CREATE TABLE IF NOT EXISTS document_commits (
    commit_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    blob_ref TEXT NOT NULL,
    author_visitor_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_document_commits_document ON document_commits (document_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS commit_parents (
    child_commit_id TEXT NOT NULL,
    parent_commit_id TEXT NOT NULL,
    PRIMARY KEY (child_commit_id, parent_commit_id),
    FOREIGN KEY (child_commit_id) REFERENCES document_commits(commit_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_commit_id) REFERENCES document_commits(commit_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS attachments (
    attachment_id TEXT PRIMARY KEY,
    document_id TEXT,
    relative_path TEXT NOT NULL,
    mime_type TEXT,
    byte_size INTEGER NOT NULL,
    owner_visitor_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_visitor_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_visitor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs (target_type, target_id)`,
  `DROP INDEX IF EXISTS idx_diagrams_owner`,
  `DROP TABLE IF EXISTS diagrams`,
  `CREATE TABLE IF NOT EXISTS visitor_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_visitor_id TEXT NOT NULL,
    to_visitor_id TEXT NOT NULL,
    affected_counts_json TEXT NOT NULL,
    executed_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS document_invites (
    document_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'read',
    PRIMARY KEY (document_id, visitor_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_document_invites_doc ON document_invites (document_id)`,
  `CREATE TABLE IF NOT EXISTS domain_members (
    domain_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (domain_id, visitor_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_domain_members_domain ON domain_members (domain_id)`,
  `CREATE INDEX IF NOT EXISTS idx_domain_members_visitor ON domain_members (visitor_id)`,
  `CREATE TABLE IF NOT EXISTS domain_member_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    domain_visitor_ids TEXT NOT NULL DEFAULT '',
    create_visitor_id TEXT NOT NULL,
    create_time TEXT NOT NULL,
    update_time TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_domain_member_templates_owner ON domain_member_templates (create_visitor_id)`,
  `CREATE TABLE IF NOT EXISTS documents_fts_rowid (
    document_id TEXT PRIMARY KEY,
    fts_rowid INTEGER NOT NULL
  )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    content,
    document_id UNINDEXED,
    display_name UNINDEXED,
    relative_path UNINDEXED,
    domain_id UNINDEXED,
    owner_visitor_id UNINDEXED,
    permission UNINDEXED,
    tokenize='unicode61'
  )`,
  `CREATE TABLE IF NOT EXISTS cli_tokens (
    token_id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cli_tokens_visitor ON cli_tokens (visitor_id)`,
  `CREATE TABLE IF NOT EXISTS document_bookmarks (
    visitor_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (visitor_id, document_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookmarks_visitor ON document_bookmarks (visitor_id)`,
  `CREATE TABLE IF NOT EXISTS document_comments (
    comment_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    visitor_name TEXT NOT NULL,
    parent_id TEXT,
    reply_to_visitor_id TEXT,
    reply_to_visitor_name TEXT,
    content TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_comments_document ON document_comments (document_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_parent ON document_comments (parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_visitor ON document_comments (visitor_id)`,
];


/**
 * 在数据库上应用完整 Schema。
 * 所有语句在单个事务中执行，并包含 domains 表迁移与默认域创建。
 */
export function applySchema(db: Database.Database): void {
  const tx = db.transaction(() => {
    for (const stmt of SCHEMA_STATEMENTS) {
      db.exec(stmt);
    }
    migrateDomainsTable(db);
    migrateDomainNameUnique(db);
    migrateDocumentsTable(db);
    migrateDocumentsDirty(db);
    migrateDocumentsHeadCommit(db);
    backfillFolderDescHeadCommits(db);
    migrateVisitorsRecoveryCode(db);
    migrateVisitorsPasswordHash(db);
    migrateVisitorSessions(db);
    ensureDefaultDomain(db);
  });
  tx();
}

/** 获取 domains 表当前已有的列名集合。 */
function domainColumnNames(db: Database.Database): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(domains)`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/** 将旧版 domains 表迁移到包含 creator_visitor_id 与 updated_at 的新结构（SQLite ALTER/RENAME）。 */
function migrateDomainsTable(db: Database.Database): void {
  let names = domainColumnNames(db);
  if (!names.has("domain_id")) return;

  // 若缺少 updated_at 列，则添加并用 created_at 回填
  if (!names.has("updated_at")) {
    db.exec(`ALTER TABLE domains ADD COLUMN updated_at TEXT`);
    db.prepare(`UPDATE domains SET updated_at = created_at WHERE updated_at IS NULL`).run();
    names = domainColumnNames(db);
  }

  // 将旧列名 created_by 重命名为 creator_visitor_id
  if (names.has("created_by") && !names.has("creator_visitor_id")) {
    db.exec(`ALTER TABLE domains RENAME COLUMN created_by TO creator_visitor_id`);
  }
}

/** 为 domains 表的 domain_name 列添加 UNIQUE 约束（SQLite 需重建表）。 */
function migrateDomainNameUnique(db: Database.Database): void {
  // 检查 domain_name 是否已存在 UNIQUE 约束
  const indexes = db.prepare(`PRAGMA index_list(domains)`).all() as { name: string }[];
  const hasUniqueIndex = indexes.some(
    (idx) => idx.name === "sqlite_autoindex_domains_1" || idx.name === "idx_domains_name_unique"
  );
  if (hasUniqueIndex) return;

  // 第一步：去重 — 给重复的域名加后缀 (2), (3)...
  const dupRows = db
    .prepare<[], { domain_name: string; cnt: number }>(
      `SELECT domain_name, COUNT(*) as cnt FROM domains GROUP BY domain_name HAVING cnt > 1`
    )
    .all();

  for (const dup of dupRows) {
    const rows = db
      .prepare<string, { domain_id: string; domain_name: string }>(
        `SELECT domain_id, domain_name FROM domains WHERE domain_name = ? ORDER BY created_at`
      )
      .all(dup.domain_name);
    // 第一条保留原名，从第二条开始加后缀
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const newName = `${row.domain_name} (${i + 1})`;
      db.prepare(`UPDATE domains SET domain_name = ? WHERE domain_id = ?`).run(newName, row.domain_id);
    }
  }

  // 第二步：重建表，添加 UNIQUE 约束
  db.exec(`CREATE TABLE domains_new (
    domain_id TEXT PRIMARY KEY,
    domain_name TEXT NOT NULL UNIQUE,
    creator_visitor_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'public'
  )`);

  db.exec(`INSERT INTO domains_new
    (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
    SELECT domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission
    FROM domains`);

  db.exec(`DROP TABLE domains`);
  db.exec(`ALTER TABLE domains_new RENAME TO domains`);
}

/** 若不存在 id 为 default 的域，则插入一条默认域记录。 */
function ensureDefaultDomain(db: Database.Database): void {
  const row = db
    .prepare(`SELECT domain_id FROM domains WHERE domain_id = ?`)
    .get("default");
  if (row) return;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, creator_visitor_id, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("default", "Default", "system", now, now, "public");
}

/** 将旧版 documents 表迁移到包含 file_type、parent_id 且 relative_path 为域内唯一的新结构。 */
function migrateDocumentsTable(db: Database.Database): void {
  const names = documentColumnNames(db);
  // 如果已有 file_type 列，说明已迁移过
  if (names.has("file_type")) return;

  // SQLite 不支持直接删除 UNIQUE 约束或添加新组合约束。
  // 需要重建表：创建新表 → 复制数据 → 删除旧表 → 重命名。
  db.exec(`CREATE TABLE documents_new (
    document_id TEXT PRIMARY KEY,
    domain_id TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    display_name TEXT NOT NULL,
    owner_visitor_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    permission INTEGER NOT NULL DEFAULT 1,
    file_type TEXT NOT NULL DEFAULT 'md',
    parent_id TEXT,
    UNIQUE(domain_id, relative_path)
  )`);

  db.exec(`INSERT INTO documents_new
    (document_id, domain_id, relative_path, display_name, owner_visitor_id,
     created_by, updated_by, content_hash, created_at, updated_at, permission)
    SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
           created_by, updated_by, content_hash, created_at, updated_at, permission
    FROM documents`);

  db.exec(`DROP TABLE documents`);
  db.exec(`ALTER TABLE documents_new RENAME TO documents`);

  // 重建索引
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_domain ON documents (domain_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents (owner_visitor_id)`);
}

/** 为旧版 documents 表添加 is_dirty 列（若不存在）。现有文档默认标记为 dirty（1），由索引器首次启动时全量重建。 */
function migrateDocumentsDirty(db: Database.Database): void {
  const names = documentColumnNames(db);
  if (names.has("is_dirty")) return;
  db.exec(`ALTER TABLE documents ADD COLUMN is_dirty INTEGER NOT NULL DEFAULT 1`);
}

/** 为 documents 表添加 head_commit_id 列（若不存在）。 */
function migrateDocumentsHeadCommit(db: Database.Database): void {
  const names = documentColumnNames(db);
  if (names.has("head_commit_id")) return;
  db.exec(`ALTER TABLE documents ADD COLUMN head_commit_id TEXT`);
}

function documentColumnNames(db: Database.Database): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(documents)`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/** 为 visitors 表添加 recovery_code_hash 列（若不存在）。 */
function migrateVisitorsRecoveryCode(db: Database.Database): void {
  const names = visitorColumnNames(db);
  if (names.has("recovery_code_hash")) return;
  db.exec(`ALTER TABLE visitors ADD COLUMN recovery_code_hash TEXT`);
}

function visitorColumnNames(db: Database.Database): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(visitors)`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/** 为 visitors 表添加 password_hash 列（若不存在）。 */
function migrateVisitorsPasswordHash(db: Database.Database): void {
  const names = visitorColumnNames(db);
  if (names.has("password_hash")) return;
  db.exec(`ALTER TABLE visitors ADD COLUMN password_hash TEXT`);
}

/** 将 visitors 表的 token 迁移到 visitor_sessions 表（向后兼容）。 */
function migrateVisitorSessions(db: Database.Database): void {
  // 检查是否已经迁移过（有 session 记录说明迁过了）
  const hasSessions = db.prepare(`SELECT 1 AS c FROM visitor_sessions LIMIT 1`).get() as { c: number } | undefined;
  if (hasSessions) return;

  // 把所有现有 visitor 的 token 迁移到 visitor_sessions 表（作为初始 session）
  const stmt = db.prepare(`
    INSERT INTO visitor_sessions (session_id, visitor_id, token_hash, device_name, created_at, last_seen_at)
    SELECT
      'legacy_' || visitor_id,
      visitor_id,
      visitor_token_hash,
      'Legacy Device',
      created_at,
      COALESCE(last_seen_at, created_at)
    FROM visitors
    WHERE visitor_token_hash IS NOT NULL
  `);
  stmt.run();
}
