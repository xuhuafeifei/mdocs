import { randomUUID } from "node:crypto";
import { getDb } from "../db/connection.js";
import {
  deleteDocument,
  findDocumentById,
  findDocumentByPath,
  findDocumentInvite,
  insertDocument,
  insertDocumentInvite,
  deleteDocumentInvite,
  listDocumentInvites,
  listDocumentsByDomain,
  updateDocumentContent,
  type DocumentRow,
} from "../db/repositories/document.repo.js";
import { findDomainById } from "../db/repositories/domain.repo.js";
import { insertAuditLog } from "../db/repositories/audit.repo.js";
import {
  deleteDocumentFile,
  readDocument,
  writeDocument,
} from "../storage/file-store.js";
import { normaliseDocRelativePath } from "../storage/paths.js";
import type {
  DocumentDetail,
  DocumentSummary,
} from "../../shared/types/document.js";
import { DocPathError } from "../../shared/docPath.js";
import { normaliseRelativePathForStorage } from "../../shared/storagePath.js";
import { prefixPersonalDomainStoragePath } from "../../shared/personalDomain.js";
import { getConfig } from "../config/index.js";

export class DocumentError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const Permission = {
  PRIVATE: 0,
  PUBLIC_READ: 1,
  PUBLIC_EDIT: 2,
  INVITE: 3,
} as const;

export function canReadDocument(row: DocumentRow, visitorId: string | null): boolean {
  if (row.owner_visitor_id === visitorId) return true;
  if (row.permission === Permission.PUBLIC_READ || row.permission === Permission.PUBLIC_EDIT) return true;
  if (!visitorId) return false;
  if (row.permission === Permission.INVITE) {
    return !!findDocumentInvite(getDb(), row.document_id, visitorId);
  }
  return false;
}

export function canEditDocument(row: DocumentRow, visitorId: string | null): boolean {
  if (row.owner_visitor_id === visitorId) return true;
  if (row.permission === Permission.PUBLIC_EDIT) return true;
  if (!visitorId) return false;
  if (row.permission === Permission.INVITE) {
    const invite = findDocumentInvite(getDb(), row.document_id, visitorId);
    return invite?.permission === "edit";
  }
  return false;
}

export function assertDocumentAccess(
  documentId: string,
  visitorId: string | null,
  action: "read" | "edit" | "delete",
): void {
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row) {
    throw new DocumentError("DOC_NOT_FOUND", "document not found", 404);
  }

  if (action === "read") {
    if (!canReadDocument(row, visitorId)) {
      throw new DocumentError("FORBIDDEN", "no permission to read this document", 403);
    }
  } else if (action === "edit") {
    if (!canEditDocument(row, visitorId)) {
      throw new DocumentError("FORBIDDEN", "no permission to edit this document", 403);
    }
  } else if (action === "delete") {
    if (row.owner_visitor_id !== visitorId) {
      throw new DocumentError("FORBIDDEN", "only the owner can delete this document", 403);
    }
  }
}

export function listDocuments(domainId?: string, visitorId?: string | null): DocumentSummary[] {
  const cfg = getConfig();
  const effective = domainId?.trim() || cfg.defaultDomainId;
  const db = getDb();
  const rows = listDocumentsByDomain(db, effective);
  const filtered = visitorId
    ? rows.filter((r) => canReadDocument(r, visitorId))
    : rows.filter((r) => r.permission === Permission.PUBLIC_READ || r.permission === Permission.PUBLIC_EDIT);
  return filtered.map(rowToSummary);
}

export function createDocument(params: {
  actorVisitorId: string;
  relativePath: string;
  displayName?: string;
  content: string;
  domainId?: string;
  permission?: number;
}): DocumentDetail {
  const cfg = getConfig();
  const domainId = params.domainId?.trim() || cfg.defaultDomainId;

  if (domainId !== cfg.defaultDomainId && domainId !== params.actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "cannot create documents in this domain", 403);
  }

  let pathFromUser: string;
  try {
    pathFromUser = normaliseRelativePathForStorage(params.relativePath);
  } catch (e) {
    if (e instanceof DocPathError) {
      throw new DocumentError("INVALID_PATH", e.message, 400);
    }
    throw e;
  }
  const relativePath =
    domainId === params.actorVisitorId
      ? normaliseDocRelativePath(prefixPersonalDomainStoragePath(params.actorVisitorId, pathFromUser))
      : normaliseDocRelativePath(pathFromUser);
  const db = getDb();

  const existing = findDocumentByPath(db, relativePath);
  if (existing) {
    throw new DocumentError("DOC_EXISTS", "document already exists", 409);
  }

  const displayName = deriveDisplayName(params.displayName, relativePath);
  const documentId = randomUUID();
  const now = new Date().toISOString();

  // Default permission: private for personal domain, public-read for default domain
  const permission =
    params.permission !== undefined
      ? params.permission
      : domainId === params.actorVisitorId
        ? Permission.PRIVATE
        : Permission.PUBLIC_READ;

  const write = writeDocument(relativePath, params.content);

  const tx = db.transaction(() => {
    insertDocument(db, {
      documentId,
      domainId,
      relativePath,
      displayName,
      ownerVisitorId: params.actorVisitorId,
      createdBy: params.actorVisitorId,
      updatedBy: params.actorVisitorId,
      contentHash: write.contentHash,
      createdAt: now,
      updatedAt: now,
      permission,
    });
    insertAuditLog(db, {
      actorVisitorId: params.actorVisitorId,
      action: "document.create",
      targetType: "document",
      targetId: documentId,
      metadata: { relativePath, bytes: write.bytes },
      createdAt: now,
    });
  });
  tx();

  return {
    documentId,
    domainId,
    relativePath,
    displayName,
    ownerVisitorId: params.actorVisitorId,
    updatedBy: params.actorVisitorId,
    updatedAt: now,
    createdAt: now,
    content: params.content,
    contentHash: write.contentHash,
    permission,
  };
}

export function getDocument(documentId: string): DocumentDetail {
  const row = findDocumentById(getDb(), documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "document not found", 404);
  const { content, contentHash } = readDocument(row.relative_path);
  return {
    ...rowToSummary(row),
    content,
    contentHash,
    permission: row.permission,
  };
}

export function updateDocument(params: {
  actorVisitorId: string;
  documentId: string;
  content: string;
  displayName?: string;
  permission?: number;
}): DocumentDetail {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "document not found", 404);
  if (!canEditDocument(row, params.actorVisitorId)) {
    throw new DocumentError("FORBIDDEN", "no permission to edit this document", 403);
  }

  const displayName = params.displayName?.trim() || row.display_name;
  const write = writeDocument(row.relative_path, params.content);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    updateDocumentContent(db, {
      documentId: row.document_id,
      displayName,
      contentHash: write.contentHash,
      updatedBy: params.actorVisitorId,
      updatedAt: now,
      permission: params.permission,
    });
    insertAuditLog(db, {
      actorVisitorId: params.actorVisitorId,
      action: "document.update",
      targetType: "document",
      targetId: row.document_id,
      metadata: { bytes: write.bytes },
      createdAt: now,
    });
  });
  tx();

  return {
    documentId: row.document_id,
    domainId: row.domain_id,
    relativePath: row.relative_path,
    displayName,
    ownerVisitorId: row.owner_visitor_id,
    updatedBy: params.actorVisitorId,
    updatedAt: now,
    createdAt: row.created_at,
    content: params.content,
    contentHash: write.contentHash,
    permission: params.permission !== undefined ? params.permission : row.permission,
  };
}

export function removeDocument(params: {
  actorVisitorId: string;
  documentId: string;
}): void {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "document not found", 404);
  if (row.owner_visitor_id !== params.actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "only the owner can delete this document", 403);
  }
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    deleteDocument(db, row.document_id);
    insertAuditLog(db, {
      actorVisitorId: params.actorVisitorId,
      action: "document.delete",
      targetType: "document",
      targetId: row.document_id,
      metadata: { relativePath: row.relative_path },
      createdAt: now,
    });
  });
  tx();
  deleteDocumentFile(row.relative_path);
}

export function addDocumentInvite(
  actorVisitorId: string,
  documentId: string,
  targetVisitorId: string,
  targetPermission: string,
): void {
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "document not found", 404);
  if (row.owner_visitor_id !== actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "only the owner can invite to this document", 403);
  }
  const domain = findDomainById(db, row.domain_id);
  // Private domains have a single domain member (domain owner = domain_id); do not invite them.
  if (domain?.permission === "private" && targetVisitorId === domain.domain_id) {
    throw new DocumentError(
      "BAD_REQUEST",
      "private domain owner is the only domain member; invite is not used for that visitor",
      400,
    );
  }
  insertDocumentInvite(db, documentId, targetVisitorId, targetPermission);
}

export function removeDocumentInvite(
  actorVisitorId: string,
  documentId: string,
  targetVisitorId: string,
): void {
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "document not found", 404);
  if (row.owner_visitor_id !== actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "only the owner can manage invites", 403);
  }
  deleteDocumentInvite(db, documentId, targetVisitorId);
}

export function getDocumentInvites(documentId: string): { visitorId: string; permission: string }[] {
  const db = getDb();
  const rows = listDocumentInvites(db, documentId);
  return rows.map((r) => ({ visitorId: r.visitor_id, permission: r.permission }));
}

function rowToSummary(row: DocumentRow): DocumentSummary {
  return {
    documentId: row.document_id,
    domainId: row.domain_id,
    relativePath: row.relative_path,
    displayName: row.display_name,
    ownerVisitorId: row.owner_visitor_id,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    permission: row.permission,
  };
}

function deriveDisplayName(raw: string | undefined, relativePath: string): string {
  const t = raw?.trim();
  if (t) return t.slice(0, 200);
  const base = relativePath.split("/").pop() ?? relativePath;
  return base.replace(/\.md$/i, "") || relativePath;
}
