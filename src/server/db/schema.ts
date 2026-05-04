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
    creator_visitor_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'public'
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
    updated_at TEXT NOT NULL,
    permission INTEGER NOT NULL DEFAULT 1
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
];

export function applySchema(db: Database.Database): void {
  const tx = db.transaction(() => {
    for (const stmt of SCHEMA_STATEMENTS) {
      db.exec(stmt);
    }
    migrateDomainsTable(db);
    ensureDefaultDomain(db);
  });
  tx();
}

function domainColumnNames(db: Database.Database): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(domains)`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/** Align legacy `domains` rows with creator_visitor_id + updated_at (SQLite ALTER / RENAME). */
function migrateDomainsTable(db: Database.Database): void {
  let names = domainColumnNames(db);
  if (!names.has("domain_id")) return;

  if (!names.has("updated_at")) {
    db.exec(`ALTER TABLE domains ADD COLUMN updated_at TEXT`);
    db.prepare(`UPDATE domains SET updated_at = created_at WHERE updated_at IS NULL`).run();
    names = domainColumnNames(db);
  }

  if (names.has("created_by") && !names.has("creator_visitor_id")) {
    db.exec(`ALTER TABLE domains RENAME COLUMN created_by TO creator_visitor_id`);
  }
}

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
