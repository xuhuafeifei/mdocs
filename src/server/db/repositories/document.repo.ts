import type Database from "better-sqlite3";

export interface DocumentRow {
  document_id: string;
  domain_id: string;
  relative_path: string;
  display_name: string;
  owner_visitor_id: string;
  created_by: string;
  updated_by: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
  permission: number;
}

export interface InsertDocumentInput {
  documentId: string;
  domainId: string;
  relativePath: string;
  displayName: string;
  ownerVisitorId: string;
  createdBy: string;
  updatedBy: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  permission: number;
}

export interface UpdateDocumentContentInput {
  documentId: string;
  displayName: string;
  contentHash: string;
  updatedBy: string;
  updatedAt: string;
  permission?: number;
}

export function countDocumentsByDomain(db: Database.Database, domainId: string): number {
  const row = db
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) as c FROM documents WHERE domain_id = ?`,
    )
    .get(domainId);
  return row?.c ?? 0;
}

export function listDocumentsByDomain(db: Database.Database, domainId: string): DocumentRow[] {
  return db
    .prepare<string, DocumentRow>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, created_at, updated_at, permission
       FROM documents WHERE domain_id = ? ORDER BY relative_path`,
    )
    .all(domainId);
}

export function findDocumentById(db: Database.Database, documentId: string): DocumentRow | undefined {
  return db
    .prepare<string, DocumentRow>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, created_at, updated_at, permission
       FROM documents WHERE document_id = ?`,
    )
    .get(documentId);
}

export function findDocumentByPath(db: Database.Database, relativePath: string): DocumentRow | undefined {
  return db
    .prepare<string, DocumentRow>(
      `SELECT document_id, domain_id, relative_path, display_name, owner_visitor_id,
              created_by, updated_by, content_hash, created_at, updated_at, permission
       FROM documents WHERE relative_path = ?`,
    )
    .get(relativePath);
}

export function insertDocument(db: Database.Database, input: InsertDocumentInput): void {
  db.prepare(
    `INSERT INTO documents
     (document_id, domain_id, relative_path, display_name, owner_visitor_id,
      created_by, updated_by, content_hash, created_at, updated_at, permission)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.documentId,
    input.domainId,
    input.relativePath,
    input.displayName,
    input.ownerVisitorId,
    input.createdBy,
    input.updatedBy,
    input.contentHash,
    input.createdAt,
    input.updatedAt,
    input.permission,
  );
}

export function updateDocumentContent(db: Database.Database, input: UpdateDocumentContentInput): void {
  if (input.permission !== undefined) {
    db.prepare(
      `UPDATE documents
       SET display_name = ?, content_hash = ?, updated_by = ?, updated_at = ?, permission = ?
       WHERE document_id = ?`,
    ).run(input.displayName, input.contentHash, input.updatedBy, input.updatedAt, input.permission, input.documentId);
  } else {
    db.prepare(
      `UPDATE documents
       SET display_name = ?, content_hash = ?, updated_by = ?, updated_at = ?
       WHERE document_id = ?`,
    ).run(input.displayName, input.contentHash, input.updatedBy, input.updatedAt, input.documentId);
  }
}

export function deleteDocument(db: Database.Database, documentId: string): void {
  db.prepare(`DELETE FROM documents WHERE document_id = ?`).run(documentId);
}

export interface DocumentInviteRow {
  document_id: string;
  visitor_id: string;
  permission: string;
}

export function findDocumentInvite(
  db: Database.Database,
  documentId: string,
  visitorId: string,
): DocumentInviteRow | undefined {
  return db
    .prepare<[string, string], DocumentInviteRow>(
      `SELECT document_id, visitor_id, permission FROM document_invites WHERE document_id = ? AND visitor_id = ?`,
    )
    .get(documentId, visitorId);
}

export function insertDocumentInvite(
  db: Database.Database,
  documentId: string,
  visitorId: string,
  permission: string,
): void {
  db.prepare(
    `INSERT INTO document_invites (document_id, visitor_id, permission) VALUES (?, ?, ?)
     ON CONFLICT(document_id, visitor_id) DO UPDATE SET permission = excluded.permission`,
  ).run(documentId, visitorId, permission);
}

export function deleteDocumentInvite(db: Database.Database, documentId: string, visitorId: string): void {
  db.prepare(`DELETE FROM document_invites WHERE document_id = ? AND visitor_id = ?`).run(documentId, visitorId);
}

export function listDocumentInvites(db: Database.Database, documentId: string): DocumentInviteRow[] {
  return db
    .prepare<string, DocumentInviteRow>(
      `SELECT document_id, visitor_id, permission FROM document_invites WHERE document_id = ?`,
    )
    .all(documentId);
}

/**
 * 查的是什么：当前访客在「文档邀请」里涉及到的所有域 ID（同一域多篇邀请只算一次）。
 * 怎么实现：`document_invites` 按 `document_id` 关联 `documents`，用 `visitor_id = ?` 过滤，`DISTINCT` 取 `domain_id`。
 */
export function listDomainIdsWithDocumentInviteForVisitor(db: Database.Database, visitorId: string): string[] {
  const rows = db
    .prepare<string, { domain_id: string }>(
      `SELECT DISTINCT d.domain_id AS domain_id
       FROM document_invites di
       INNER JOIN documents d ON d.document_id = di.document_id
       WHERE di.visitor_id = ?`,
    )
    .all(visitorId);
  return rows.map((r) => r.domain_id);
}

/**
 * 查的是什么：给定域里，是否存在至少一篇文档对当前访客有邀请记录。
 * 怎么实现：同样的 invite 联 documents，加上 `domain_id = ?` 与 `visitor_id = ?`，用 `EXISTS` 只判断有无一行。
 */
export function hasDocumentInviteInDomain(
  db: Database.Database,
  domainId: string,
  visitorId: string,
): boolean {
  const row = db
    .prepare<[string, string], { ok: number }>(
      `SELECT EXISTS (
         SELECT 1 FROM document_invites di
         INNER JOIN documents d ON d.document_id = di.document_id
         WHERE d.domain_id = ? AND di.visitor_id = ?
       ) AS ok`,
    )
    .get(domainId, visitorId);
  return (row?.ok ?? 0) === 1;
}
