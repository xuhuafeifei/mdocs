import { randomUUID } from "node:crypto";
import { getDb } from "../db/connection.js";
import {
  deleteDocument,
  findDocumentById,
  findDocumentByPath,
  insertDocument,
  insertDocumentInvite,
  deleteDocumentInvite,
  listDocumentInvites,
  listDocumentsByDomain,
  updateDocumentContent,
  type DocumentRow,
} from "../db/repositories/document.repo.js";
import { findDomainById, isDomainMember } from "../db/repositories/domain.repo.js";
import { resolveDomainAccess, canEnterDomainTree } from "../access/domain-access.js";
import {
  DocumentError,
  Permission,
  canReadDocument,
  canEditDocument,
  type DomainAccessInfo,
  validateDomainPermission,
} from "../access/access-control.js";
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

// ============================================================
//  列文档（域内可见列表）
// ============================================================

export function listDocuments(domainId?: string, visitorId?: string | null): DocumentSummary[] {
  const cfg = getConfig();
  const effective = domainId?.trim() || cfg.defaultDomainId;
  const db = getDb();

  // 域入口过滤
  const domain = findDomainById(db, effective);
  const access = resolveDomainAccess(db, domain, effective, visitorId);
  if (!canEnterDomainTree(access)) return [];

  // 构建域上下文（一次查成员身份，避免逐行查库）
  const domainPermission = domain?.permission ?? "public";
  const isMember = !!(
    visitorId && domain && isDomainMember(db, domain.domain_id, visitorId)
  );
  const domainInfo: DomainAccessInfo = { domainPermission, isDomainMember: isMember };

  const rows = listDocumentsByDomain(db, effective);
  const filtered = rows.filter((r) => canReadDocument(r, visitorId ?? null, domainInfo));
  return filtered.map(rowToSummary);
}

// ============================================================
//  创建文档
// ============================================================

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
  const db = getDb();

  const domainRow = findDomainById(db, domainId);
  if (!domainRow) {
    throw new DocumentError("DOMAIN_NOT_FOUND", "域不存在", 404);
  }
  const access = resolveDomainAccess(db, domainRow, domainId, params.actorVisitorId);
  if (access.kind !== "full") {
    throw new DocumentError("FORBIDDEN", "无权在该域创建文档", 403);
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

  const existing = findDocumentByPath(db, relativePath);
  if (existing) {
    throw new DocumentError("DOC_EXISTS", "文档已存在", 409);
  }

  const displayName = deriveDisplayName(params.displayName, relativePath);
  const documentId = randomUUID();
  const now = new Date().toISOString();

  // 默认权限：private 域 → 0 (private)，public 域 → 3 (public_read)，restricted → 1 (domain_read)
  const defaultPermission =
    domainId === params.actorVisitorId
      ? Permission.PRIVATE
      : domainRow.permission === "restricted"
        ? Permission.DOMAIN_READ
        : Permission.PUBLIC_READ;

  let permission: number;
  if (params.permission !== undefined) {
    // 调用方指定了权限 → 校验是否在域允许范围内
    if (!validateDomainPermission(domainRow.permission, params.permission)) {
      throw new DocumentError(
        "INVALID_PERMISSION",
        `域类型"${domainRow.permission}"不允许权限值 ${params.permission}`,
        400,
      );
    }
    permission = params.permission;
  } else {
    permission = defaultPermission;
  }

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

// ============================================================
//  读单篇文档（调用方需先鉴权）
// ============================================================

export function getDocument(documentId: string): DocumentDetail {
  const row = findDocumentById(getDb(), documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  const { content, contentHash } = readDocument(row.relative_path);
  return {
    ...rowToSummary(row),
    content,
    contentHash,
    permission: row.permission,
  };
}

// ============================================================
//  更新文档
// ============================================================

export function updateDocument(params: {
  actorVisitorId: string;
  documentId: string;
  content: string;
  displayName?: string;
  permission?: number;
}): DocumentDetail {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);

  // 构建域上下文校验编辑权限
  const domain = findDomainById(db, row.domain_id);
  const domainPermission = domain?.permission ?? "public";
  const isMember = !!(domain && isDomainMember(db, domain.domain_id, params.actorVisitorId));
  const domainInfo: DomainAccessInfo = { domainPermission, isDomainMember: isMember };
  if (!canEditDocument(row, params.actorVisitorId, domainInfo)) {
    throw new DocumentError("FORBIDDEN", "无权编辑此文档", 403);
  }

  // 如果改了权限值，校验是否在域允许范围内
  if (params.permission !== undefined && !validateDomainPermission(domainPermission, params.permission)) {
    throw new DocumentError(
      "INVALID_PERMISSION",
      `域类型"${domainPermission}"不允许权限值 ${params.permission}`,
      400,
    );
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

// ============================================================
//  删除文档
// ============================================================

export function removeDocument(params: {
  actorVisitorId: string;
  documentId: string;
}): void {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  if (row.owner_visitor_id !== params.actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可删除此文档", 403);
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

// ============================================================
//  文档邀请
// ============================================================

export function addDocumentInvite(
  actorVisitorId: string,
  documentId: string,
  targetVisitorId: string,
  targetPermission: string,
): void {
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  if (row.owner_visitor_id !== actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可邀请他人", 403);
  }

  const domain = findDomainById(db, row.domain_id);

  // 邀请与域成员互斥：已是该域成员则禁止 invite
  if (domain && isDomainMember(db, domain.domain_id, targetVisitorId)) {
    throw new DocumentError(
      "BAD_REQUEST",
      "该访客已是域成员，无需邀请；邀请与域成员互斥",
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
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  if (row.owner_visitor_id !== actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可管理邀请", 403);
  }
  deleteDocumentInvite(db, documentId, targetVisitorId);
}

export function getDocumentInvites(documentId: string): { visitorId: string; permission: string }[] {
  const db = getDb();
  const rows = listDocumentInvites(db, documentId);
  return rows.map((r) => ({ visitorId: r.visitor_id, permission: r.permission }));
}

// ============================================================
//  内部辅助
// ============================================================

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
