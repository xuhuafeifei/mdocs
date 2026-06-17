import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getDb } from "../db/connection.js";
import { findDomainById } from "../db/repositories/domain.repo.js";
import { findDocumentById, findDocumentByPath, insertDocument, countChildrenByParent, deleteDocument } from "../db/repositories/document.repo.js";
import { resolveDomainAccess } from "../access/domain-access.js";
import {
  DocumentError,
  Permission,
  validateDomainPermission,
} from "../access/access-control.js";
import { insertAuditLog } from "../db/repositories/audit.repo.js";
import { FOLDER_DESC_FILENAME, folderDescPathForFolder } from "../../shared/folderDesc.js";
import { normalisePathSegmentForStorage } from "../../shared/storagePath.js";
import { writeDocument } from "../storage/file-store.js";
import { insertMarkdownDocumentWithInitialCommit } from "../documents/initial-commit.js";
import { getConfig } from "../config/index.js";
import { useLogger } from "../logger/logger.js";

const log = useLogger("folders-route");

export function buildFoldersRouter(): Router {
  const router = Router();

  /**
   * POST /
   * 创建新目录。
   */
  router.post("/", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    const body = (req.body ?? {}) as {
      name?: unknown;
      parentId?: unknown;
      domainId?: unknown;
      description?: unknown;
      permission?: unknown;
    };

    if (typeof body.name !== "string" || !body.name.trim()) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "name is required" } });
      return;
    }

    try {
      const result = createFolder({
        actorVisitorId: req.visitor.visitor_id,
        name: body.name.trim(),
        parentId: typeof body.parentId === "string" ? body.parentId : undefined,
        domainId: typeof body.domainId === "string" ? body.domainId : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        permission: typeof body.permission === "number" ? body.permission : undefined,
      });
      res.status(201).json({ data: result });
    } catch (err) {
      respondError(res, err, "folders-route.create");
    }
  });

  /**
   * DELETE /:folderId
   * 删除空目录。非空时拒绝。
   */
  router.delete("/:folderId", (req: Request, res: Response) => {
    if (!req.visitor) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "no visitor" } });
      return;
    }

    try {
      deleteFolder({
        actorVisitorId: req.visitor.visitor_id,
        folderId: req.params.folderId!,
      });
      res.status(204).end();
    } catch (err) {
      respondError(res, err, "folders-route.delete");
    }
  });

  return router;
}

// ============================================================
//  服务函数
// ============================================================

function createFolder(params: {
  actorVisitorId: string;
  name: string;
  parentId?: string;
  domainId?: string;
  description?: string;
  permission?: number;
}): { folderId: string; path: string } {
  const cfg = getConfig();
  const domainId = params.domainId?.trim() || cfg.defaultDomainId;
  const db = getDb();

  const domainRow = findDomainById(db, domainId);
  if (!domainRow) {
    throw new DocumentError("DOMAIN_NOT_FOUND", "域不存在", 404);
  }

  const access = resolveDomainAccess(db, domainRow, domainId, params.actorVisitorId);
  if (access.kind !== "full") {
    throw new DocumentError("FORBIDDEN", "无权在该域创建目录", 403);
  }

  // 规范化目录名（空格转下划线等），用于 relative_path
  const storageName = normalisePathSegmentForStorage(params.name);
  if (!storageName) {
    throw new DocumentError("INVALID_PATH", "目录名不合法", 400);
  }

  // 校验父目录
  let normalizedPath: string;
  if (params.parentId) {
    const parent = findDocumentById(db, params.parentId);
    if (!parent || parent.file_type !== 'dir') {
      throw new DocumentError("INVALID_PARENT", "父目录不存在", 404);
    }
    if (parent.domain_id !== domainId) {
      throw new DocumentError("FORBIDDEN", "不能跨域创建目录", 403);
    }
    normalizedPath = `${parent.relative_path}/${storageName}`;
  } else {
    normalizedPath = storageName;
  }

  // 查重
  const existing = findDocumentByPath(db, domainId, normalizedPath);
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
      throw new DocumentError("INVALID_PERMISSION", `域类型不允许该权限值`, 400);
    }
    permission = params.permission;
  } else {
    permission = defaultPermission;
  }

  // 始终创建 ___desc___.md，内容为默认标题
  const descPath = folderDescPathForFolder(normalizedPath);
  const descContent = params.description ?? `# ${params.name}`;

  const tx = db.transaction(() => {
    // 插入目录记录，displayName 保留用户原始输入
    insertDocument(db, {
      documentId: folderId,
      domainId,
      relativePath: normalizedPath,
      displayName: params.name,
      ownerVisitorId: params.actorVisitorId,
      createdBy: params.actorVisitorId,
      updatedBy: params.actorVisitorId,
      contentHash: '',
      createdAt: now,
      updatedAt: now,
      permission,
      fileType: 'dir',
      parentId: params.parentId ?? null,
    });

    // 创建 ___desc___.md（与普通 md 相同：首版 commit + head）
    const descDocumentId = randomUUID();
    insertMarkdownDocumentWithInitialCommit(db, {
      documentId: descDocumentId,
      domainId,
      relativePath: descPath,
      displayName: params.name,
      content: descContent,
      ownerVisitorId: params.actorVisitorId,
      actorVisitorId: params.actorVisitorId,
      createdAt: now,
      updatedAt: now,
      permission,
      fileType: "md",
      parentId: folderId,
    });

    insertAuditLog(db, {
      actorVisitorId: params.actorVisitorId,
      action: "folder.create",
      targetType: "folder",
      targetId: folderId,
      metadata: { relativePath: normalizedPath },
      createdAt: now,
    });
  });
  tx();

  return { folderId, path: normalizedPath };
}

function deleteFolder(params: { actorVisitorId: string; folderId: string }): void {
  const db = getDb();
  const folder = findDocumentById(db, params.folderId);
  if (!folder) throw new DocumentError("DOC_NOT_FOUND", "目录不存在", 404);
  if (folder.file_type !== 'dir') throw new DocumentError("BAD_REQUEST", "不是目录", 400);
  if (folder.owner_visitor_id !== params.actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可删除目录", 403);
  }

  // 检查是否为空目录
  const childCount = countChildrenByParent(db, params.folderId);
  if (childCount > 0) {
    throw new DocumentError("NOT_EMPTY", "目录不为空，无法删除", 409);
  }

  const now = new Date().toISOString();
  db.transaction(() => {
    deleteDocument(db, params.folderId);
    insertAuditLog(db, {
      actorVisitorId: params.actorVisitorId,
      action: "folder.delete",
      targetType: "folder",
      targetId: params.folderId,
      metadata: { relativePath: folder.relative_path },
      createdAt: now,
    });
  })();
}

function respondError(res: Response, err: unknown, context: string): void {
  if (err instanceof DocumentError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  log.error("%s failed: %s", context, err instanceof Error ? err.message : String(err));
  res.status(500).json({ error: { code: "INTERNAL", message: "internal error" } });
}
