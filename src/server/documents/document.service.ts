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
  listDocumentsByPathPrefix,
  updateDocumentContent,
  type DocumentRow,
} from "../db/repositories/document.repo.js";
import {
  findDomainById,
  isDomainMember,
} from "../db/repositories/domain.repo.js";
import {
  resolveDomainAccess,
  canEnterDomainTree,
} from "../access/domain-access.js";
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
import {
  markDirty,
  removeIndex,
  rebuildDocument,
} from "../search/document-index-manager.js";
import type {
  DocumentDetail,
  DocumentSummary,
} from "../../shared/types/document.js";
import { getConfig } from "../config/index.js";
import { markdownToLexicalJson } from "./markdown-to-lexical.js";

// ============================================================
//  列文档（域内可见列表）
// ============================================================

export function listDocuments(
  domainId?: string,
  visitorId?: string | null,
): DocumentSummary[] {
  const cfg = getConfig();
  const effective = domainId?.trim() || cfg.defaultDomainId;
  const db = getDb();

  const domain = findDomainById(db, effective);
  const access = resolveDomainAccess(db, domain, effective, visitorId);
  if (!canEnterDomainTree(access)) return [];

  const domainPermission = domain?.permission ?? "public";
  const isMember = !!(
    visitorId &&
    domain &&
    isDomainMember(db, domain.domain_id, visitorId)
  );
  const domainInfo: DomainAccessInfo = {
    domainPermission,
    isDomainMember: isMember,
  };

  const rows = listDocumentsByDomain(db, effective);
  const filtered = rows.filter((r) =>
    canReadDocument(r, visitorId ?? null, domainInfo),
  );
  return filtered.map(rowToSummary);
}

// ============================================================
//  创建文档
// ============================================================

/**
 * 规范化文件名：确保文件名有效且以 .md 结尾
 */
function normalizeFileName(fileName: string): string {
  let normalized = fileName.trim();

  // 移除路径字符，只保留文件名
  normalized = normalized.split(/[\\/]/).pop() || "untitled";

  // 替换非法字符
  normalized = normalized.replace(/[^\w\u4e00-\u9fa5\-_.]/g, "_");

  // 确保以 .md 结尾
  if (!normalized.toLowerCase().endsWith(".md")) {
    normalized += ".md";
  }

  // 避免空文件名
  if (normalized === ".md") {
    normalized = "untitled.md";
  }

  return normalized;
}

export function createDocument(params: {
  actorVisitorId: string;
  fileName: string; // 改为只接受文件名，后端自动计算路径
  displayName?: string;
  content: string;
  domainId?: string;
  permission?: number;
  fileType?: string;
  parentId?: string | null;
  /** 内容格式，默认 'lexical'；传 'markdown' 时自动转换为 Lexical JSON */
  contentFormat?: "markdown" | "lexical";
}): DocumentDetail {
  // 如果 markdown 格式，先转为 Lexical JSON
  const content =
    params.contentFormat === "markdown"
      ? markdownToLexicalJson(params.content)
      : params.content;
  const cfg = getConfig();
  const domainId = params.domainId?.trim() || cfg.defaultDomainId;
  const db = getDb();

  const domainRow = findDomainById(db, domainId);
  if (!domainRow) {
    throw new DocumentError("DOMAIN_NOT_FOUND", "域不存在", 404);
  }
  const access = resolveDomainAccess(
    db,
    domainRow,
    domainId,
    params.actorVisitorId,
  );
  if (access.kind !== "full") {
    throw new DocumentError("FORBIDDEN", "无权在该域创建文档", 403);
  }

  // 自动计算 relativePath
  let relativePath: string;
  const normalizedFileName = normalizeFileName(params.fileName);

  if (!params.parentId) {
    // 没有 parentId，是域的顶层文件
    relativePath = normalizedFileName;
  } else {
    // 有 parentId，找到父节点路径并拼接
    const parentDoc = findDocumentById(db, params.parentId);
    if (!parentDoc || parentDoc.file_type !== "dir") {
      throw new DocumentError(
        "INVALID_PARENT",
        "无效的父节点或父节点不是文件夹",
        400,
      );
    }
    // 确保父节点路径以 / 结尾
    const parentPath = parentDoc.relative_path.endsWith("/")
      ? parentDoc.relative_path
      : parentDoc.relative_path + "/";
    relativePath = parentPath + normalizedFileName;
  }

  const existing = findDocumentByPath(db, domainId, relativePath);
  if (existing) {
    throw new DocumentError("DOC_EXISTS", "文档已存在", 409);
  }

  const displayName = deriveDisplayName(params.displayName, relativePath);
  const documentId = randomUUID();
  const now = new Date().toISOString();

  const defaultPermission =
    domainId === params.actorVisitorId
      ? Permission.PRIVATE
      : domainRow.permission === "restricted"
        ? Permission.DOMAIN_READ
        : Permission.PUBLIC_READ;

  let permission: number;
  if (params.permission !== undefined) {
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

  // 磁盘路径现在自动带上 {domain_id}/ 前缀
  const write = writeDocument(domainId, relativePath, content);

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
      fileType: params.fileType ?? "md",
      parentId: params.parentId ?? null,
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

  // 异步标记并重建索引（不阻塞 API 响应）
  markDirty(documentId);
  process.nextTick(() => {
    try {
      rebuildDocument(documentId);
    } catch (err) {
      // 忽略索引失败，定时器会再次扫描 dirty
    }
  });

  return {
    documentId,
    domainId,
    relativePath,
    displayName,
    ownerVisitorId: params.actorVisitorId,
    updatedBy: params.actorVisitorId,
    updatedAt: now,
    createdAt: now,
    content,
    contentHash: write.contentHash,
    permission,
  };
}

// ============================================================
//  读单篇文档（调用方需先鉴权）
// ============================================================

export function getDocument(documentId: string, visitorId?: string | null): DocumentDetail {
  const row = findDocumentById(getDb(), documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  const { content, contentHash } = readDocument(
    row.domain_id,
    row.relative_path,
  );
  // 检查访客是否通过邀请获得编辑权限
  let invitedEdit = false;
  if (visitorId && row.owner_visitor_id !== visitorId) {
    const invite = findDocumentInvite(getDb(), documentId, visitorId);
    invitedEdit = invite?.permission === "edit";
  }
  return {
    ...rowToSummary(row),
    content,
    contentHash,
    permission: row.permission,
    ...(invitedEdit ? { invitedEdit: true } : {}),
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
  /** 内容格式，默认 'lexical'；传 'markdown' 时自动转换为 Lexical JSON */
  contentFormat?: "markdown" | "lexical";
}): DocumentDetail {
  // 如果 markdown 格式，先转为 Lexical JSON
  const content =
    params.contentFormat === "markdown"
      ? markdownToLexicalJson(params.content)
      : params.content;
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);

  const domain = findDomainById(db, row.domain_id);
  const domainPermission = domain?.permission ?? "public";
  const isMember = !!(
    domain && isDomainMember(db, domain.domain_id, params.actorVisitorId)
  );
  const domainInfo: DomainAccessInfo = {
    domainPermission,
    isDomainMember: isMember,
  };
  if (!canEditDocument(row, params.actorVisitorId, domainInfo)) {
    throw new DocumentError("FORBIDDEN", "无权编辑此文档", 403);
  }

  if (
    params.permission !== undefined &&
    !validateDomainPermission(domainPermission, params.permission)
  ) {
    throw new DocumentError(
      "INVALID_PERMISSION",
      `域类型"${domainPermission}"不允许权限值 ${params.permission}`,
      400,
    );
  }

  const displayName = params.displayName?.trim() || row.display_name;
  const write = writeDocument(row.domain_id, row.relative_path, content);
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

  // 异步标记并重建索引（不阻塞 API 响应）
  markDirty(row.document_id);
  process.nextTick(() => {
    try {
      rebuildDocument(row.document_id);
    } catch (err) {
      // 忽略索引失败，定时器会再次扫描 dirty
    }
  });

  return {
    documentId: row.document_id,
    domainId: row.domain_id,
    relativePath: row.relative_path,
    displayName,
    ownerVisitorId: row.owner_visitor_id,
    updatedBy: params.actorVisitorId,
    updatedAt: now,
    createdAt: row.created_at,
    content,
    contentHash: write.contentHash,
    permission:
      params.permission !== undefined ? params.permission : row.permission,
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
  deleteDocumentFile(row.domain_id, row.relative_path);
  // 从全文索引中移除
  removeIndex(row.document_id);
}

// ============================================================
//  删除目录（批量删除目录下所有文档和子目录）
// ============================================================

export function removeFolder(params: {
  actorVisitorId: string;
  folderDocumentId: string;
}): { deletedCount: number } {
  const db = getDb();
  let folder = findDocumentById(db, params.folderDocumentId);
  if (!folder) throw new DocumentError("DOC_NOT_FOUND", "目录不存在", 404);

  // 如果传进来的是 ___desc___.md 文档，自动查找它的父目录
  if (folder.file_type === "md" && folder.relative_path.endsWith("/___desc___.md")) {
    if (!folder.parent_id) {
      throw new DocumentError("BAD_REQUEST", "描述文档无父目录", 400);
    }
    folder = findDocumentById(db, folder.parent_id);
    if (!folder || folder.file_type !== "dir") {
      throw new DocumentError("DOC_NOT_FOUND", "父目录不存在", 404);
    }
  }

  if (folder.file_type !== "dir") {
    throw new DocumentError("BAD_REQUEST", "不是目录", 400);
  }
  if (folder.owner_visitor_id !== params.actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可删除此目录", 403);
  }

  // 目录路径前缀，用于匹配所有子文档和子目录
  const pathPrefix = `${folder.relative_path}/`;

  // 找出该目录下所有文档（包括子目录、描述文档、普通文档）
  const allDocs = listDocumentsByPathPrefix(db, folder.domain_id, pathPrefix);

  // 加上目录本身
  const allToDelete = [...allDocs, folder];

  if (allToDelete.length === 0) return { deletedCount: 0 };

  // 校验所有文档都是当前用户创建的
  const notOwned = allToDelete.filter((d) => d.owner_visitor_id !== params.actorVisitorId);
  if (notOwned.length > 0) {
    throw new DocumentError(
      "FORBIDDEN",
      `目录下有 ${notOwned.length} 篇文档不属于你，无法删除`,
      403,
    );
  }

  const now = new Date().toISOString();
  const deletedIds: string[] = [];

  const tx = db.transaction(() => {
    for (const doc of allToDelete) {
      deleteDocument(db, doc.document_id);
      deletedIds.push(doc.document_id);
      insertAuditLog(db, {
        actorVisitorId: params.actorVisitorId,
        action: doc.file_type === "dir" ? "folder.delete" : "document.delete",
        targetType: doc.file_type === "dir" ? "folder" : "document",
        targetId: doc.document_id,
        metadata: { relativePath: doc.relative_path, viaFolderDelete: true },
        createdAt: now,
      });
    }
  });
  tx();

  // 删除磁盘文件和索引（只删 md 文件有内容的，dir 类型不写磁盘）
  for (const doc of allToDelete) {
    if (doc.file_type === "md") {
      deleteDocumentFile(doc.domain_id, doc.relative_path);
      removeIndex(doc.document_id);
    }
  }

  return { deletedCount: allToDelete.length };
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

export function getDocumentInvites(
  documentId: string,
): { visitorId: string; permission: string }[] {
  const db = getDb();
  const rows = listDocumentInvites(db, documentId);
  return rows.map((r) => ({
    visitorId: r.visitor_id,
    permission: r.permission,
  }));
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
    fileType: row.file_type,
    parentId: row.parent_id,
  };
}

function deriveDisplayName(
  raw: string | undefined,
  relativePath: string,
): string {
  const t = raw?.trim();
  if (t) return t.slice(0, 200);
  const base = relativePath.split("/").pop() ?? relativePath;
  return base.replace(/\.md$/i, "") || relativePath;
}
