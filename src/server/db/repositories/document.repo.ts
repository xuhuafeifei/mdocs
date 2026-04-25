import type Database from "better-sqlite3";

export interface DocumentRow {
  document_id: string;
  domain_id: string;
  relative_path: string;
  title: string;
  owner_visitor_id: string;
  created_by: string;
  updated_by: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export interface InsertDocumentInput {
  documentId: string;
  domainId: string;
  relativePath: string;
  title: string;
  ownerVisitorId: string;
  createdBy: string;
  updatedBy: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export function insertDocument(
  db: Database.Database,
  input: InsertDocumentInput,
): void {
  db.prepare(
    `INSERT INTO documents (
      document_id, domain_id, relative_path, title,
      owner_visitor_id, created_by, updated_by,
      content_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.documentId,
    input.domainId,
    input.relativePath,
    input.title,
    input.ownerVisitorId,
    input.createdBy,
    input.updatedBy,
    input.contentHash,
    input.createdAt,
    input.updatedAt,
  );
}

export function findDocumentByPath(
  db: Database.Database,
  relativePath: string,
): DocumentRow | undefined {
  return db
    .prepare<string, DocumentRow>(
      `SELECT * FROM documents WHERE relative_path = ?`,
    )
    .get(relativePath);
}

export function findDocumentById(
  db: Database.Database,
  documentId: string,
): DocumentRow | undefined {
  return db
    .prepare<string, DocumentRow>(`SELECT * FROM documents WHERE document_id = ?`)
    .get(documentId);
}

export function listDocumentsByDomain(
  db: Database.Database,
  domainId: string,
): DocumentRow[] {
  return db
    .prepare<string, DocumentRow>(
      `SELECT * FROM documents WHERE domain_id = ? ORDER BY updated_at DESC`,
    )
    .all(domainId);
}

export function updateDocumentContent(
  db: Database.Database,
  input: {
    documentId: string;
    title: string;
    contentHash: string;
    updatedBy: string;
    updatedAt: string;
  },
): void {
  db.prepare(
    `UPDATE documents
        SET title = ?, content_hash = ?, updated_by = ?, updated_at = ?
      WHERE document_id = ?`,
  ).run(
    input.title,
    input.contentHash,
    input.updatedBy,
    input.updatedAt,
    input.documentId,
  );
}

export function deleteDocument(db: Database.Database, documentId: string): void {
  db.prepare(`DELETE FROM documents WHERE document_id = ?`).run(documentId);
}

export function countDocumentsByOwner(
  db: Database.Database,
  visitorId: string,
): number {
  const row = db
    .prepare<string, { c: number }>(
      `SELECT COUNT(*) AS c FROM documents WHERE owner_visitor_id = ?`,
    )
    .get(visitorId);
  return row?.c ?? 0;
}
