import type Database from "better-sqlite3";

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS visitors (
    visitor_id TEXT PRIMARY KEY,
    visitor_name TEXT NOT NULL,
    visitor_token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT,
    disabled_at TEXT,
    merged_into_visitor_id TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_visitors_token_hash ON visitors (visitor_token_hash)`,
  `CREATE TABLE IF NOT EXISTS domains (
    domain_id TEXT PRIMARY KEY,
    domain_name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    document_id TEXT PRIMARY KEY,
    domain_id TEXT NOT NULL,
    relative_path TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    owner_visitor_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_documents_domain ON documents (domain_id)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents (owner_visitor_id)`,
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
];

export function applySchema(db: Database.Database): void {
  const tx = db.transaction(() => {
    for (const stmt of SCHEMA_STATEMENTS) {
      db.exec(stmt);
    }
    migrateDocumentsTitleToDisplayName(db);
    ensureDefaultDomain(db);
  });
  tx();
}

/** Older DBs used `title`; rename once so code can use `display_name` consistently. */
function migrateDocumentsTitleToDisplayName(db: Database.Database): void {
  const exists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='documents'`)
    .get() as { name: string } | undefined;
  if (!exists) return;
  const cols = db.prepare(`PRAGMA table_info(documents)`).all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (names.has("display_name")) return;
  if (names.has("title")) {
    db.exec(`ALTER TABLE documents RENAME COLUMN title TO display_name`);
  }
}

function ensureDefaultDomain(db: Database.Database): void {
  const row = db
    .prepare(`SELECT domain_id FROM domains WHERE domain_id = ?`)
    .get("default");
  if (row) return;
  db.prepare(
    `INSERT INTO domains (domain_id, domain_name, created_by, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run("default", "Default", "system", new Date().toISOString());
}
