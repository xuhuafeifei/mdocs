import { randomUUID } from "node:crypto";
import { getDb } from "../../../infra/db/connection.js";
import { findDomainById } from "../../domains/repo/domain.repo.js";
import {
  countChildrenByParent,
  deleteDocument,
  findDocumentById,
  findDocumentByPath,
  insertDocument,
} from "../repo/document.repo.js";
import { resolveDomainAccess } from "../../access/domain-access.js";
import {
  DocumentError,
  Permission,
  validateDomainPermission,
} from "../../access/access-control.js";
import { insertAuditLog } from "../repo/audit.repo.js";
import { folderDescPathForFolder } from "../../../../shared/folderDesc.js";
import { normalisePathSegmentForStorage } from "../../../../shared/storagePath.js";
import { insertMarkdownDocumentWithInitialCommit } from "../initial-commit.js";
import { getConfig } from "../../../infra/config/index.js";

export function createFolder(params: {
  actorVisitorId: string;
  name: string;
  parentId?: string;
  domainId?: string;
  description?: string;
  permission?: number;
}): { folderId: string; path: string } {
  const name = params.name.trim();
  if (!name) {
    throw new DocumentError("BAD_REQUEST", "name is required", 400);
  }

  const cfg = getConfig();
  const domainId = params.domainId?.trim() || cfg.defaultDomainId;
  const db = getDb();

  const domainRow = findDomainById(domainId, db);
  if (!domainRow) {
    throw new DocumentError("DOMAIN_NOT_FOUND", "工作空间不存在", 404);
  }

  const access = resolveDomainAccess(db, domainRow, domainId, params.actorVisitorId);
  if (access.kind !== "full") {
    throw new DocumentError("FORBIDDEN", "无权在该工作空间创建目录", 403);
  }

  const storageName = normalisePathSegmentForStorage(name);
  if (!storageName) {
    throw new DocumentError("INVALID_PATH", "目录名不合法", 400);
  }

  let normalizedPath: string;
  if (params.parentId) {
    const parent = findDocumentById(params.parentId, db);
    if (!parent || parent.file_type !== "dir") {
      throw new DocumentError("INVALID_PARENT", "父目录不存在", 404);
    }
    if (parent.domain_id !== domainId) {
      throw new DocumentError("FORBIDDEN", "不能跨工作空间创建目录", 403);
    }
    normalizedPath = `${parent.relative_path}/${storageName}`;
  } else {
    normalizedPath = storageName;
  }

  const existing = findDocumentByPath(domainId, normalizedPath, db);
  if (existing) {
    throw new DocumentError("DOC_EXISTS", "同名目录已存在", 409);
  }

  const folderId = randomUUID();
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
      throw new DocumentError("INVALID_PERMISSION", `工作空间类型不允许该权限值`, 400);
    }
    permission = params.permission;
  } else {
    permission = defaultPermission;
  }

  const descPath = folderDescPathForFolder(normalizedPath);
  const descContent = params.description ?? `# ${name}`;

  const tx = db.transaction(() => {
    insertDocument({
      document_id: folderId,
      domain_id: domainId,
      relative_path: normalizedPath,
      display_name: name,
      owner_visitor_id: params.actorVisitorId,
      created_by: params.actorVisitorId,
      updated_by: params.actorVisitorId,
      content_hash: "",
      head_commit_id: null,
      created_at: now,
      updated_at: now,
      permission,
      file_type: "dir",
      parent_id: params.parentId ?? null,
      is_dirty: 1,
    }, db);

    const descDocumentId = `${folderId}.folder-desc`;
    insertMarkdownDocumentWithInitialCommit(db, {
      documentId: descDocumentId,
      domainId,
      relativePath: descPath,
      displayName: name,
      content: descContent,
      ownerVisitorId: params.actorVisitorId,
      actorVisitorId: params.actorVisitorId,
      createdAt: now,
      updatedAt: now,
      permission,
      fileType: "folder_desc",
      parentId: folderId,
    });

    insertAuditLog({
      id: null,
      actor_visitor_id: params.actorVisitorId,
      action: "folder.create",
      target_type: "folder",
      target_id: folderId,
      metadata_json: JSON.stringify({ relativePath: normalizedPath }),
      created_at: now,
    }, db);
  });
  tx();

  return { folderId, path: normalizedPath };
}

export function deleteFolder(params: { actorVisitorId: string; folderId: string }): void {
  const db = getDb();
  const folder = findDocumentById(params.folderId, db);
  if (!folder) throw new DocumentError("DOC_NOT_FOUND", "目录不存在", 404);
  if (folder.file_type !== "dir") throw new DocumentError("BAD_REQUEST", "不是目录", 400);
  if (folder.owner_visitor_id !== params.actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可删除目录", 403);
  }

  const childCount = countChildrenByParent(params.folderId, db);
  if (childCount > 0) {
    throw new DocumentError("NOT_EMPTY", "目录不为空，无法删除", 409);
  }

  const now = new Date().toISOString();
  db.transaction(() => {
    deleteDocument(params.folderId, db);
    insertAuditLog({
      id: null,
      actor_visitor_id: params.actorVisitorId,
      action: "folder.delete",
      target_type: "folder",
      target_id: params.folderId,
      metadata_json: JSON.stringify({ relativePath: folder.relative_path }),
      created_at: now,
    }, db);
  })();
}
