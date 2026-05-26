import { randomUUID } from "node:crypto";
import { getDb } from "../db/connection.js";
import {
  deleteDocument,
  findDocumentById,
  findDocumentByPath,
  findDocumentInvite,
  findChildrenByParent,
  insertDocument,
  insertDocumentInvite,
  deleteDocumentInvite,
  listDocumentInvites,
  listDocumentsByDomain,
  listDocumentsByPathPrefix,
  updateDocumentContent,
  updateDocumentHeadCommit,
  type DocumentRow,
} from "../db/repositories/document.repo.js";
import { insertCommit, insertCommitParent } from "../db/repositories/commit.repo.js";
import {
  assertCommitBelongsToDocument,
  assertMergeFork,
} from "./commit-graph.js";
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
  sha256,
  writeCommitBlob,
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
  PublishVersionContext,
} from "../../shared/types/document.js";
import { getConfig } from "../config/index.js";
import { markdownToLexicalJson } from "./markdown-to-lexical.js";
import { extractPlainTextFromLexical } from "./lexical-text.js";

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
//  列出目录下的子节点
// ============================================================

export function listFolderChildren(
  folderId: string,
  visitorId?: string | null,
): DocumentSummary[] {
  const db = getDb();

  // 先查文件夹本身，确认存在且有权限
  const folder = findDocumentById(db, folderId);
  if (!folder) return [];

  const domain = findDomainById(db, folder.domain_id);
  const access = resolveDomainAccess(db, domain, folder.domain_id, visitorId);
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

  // 检查对文件夹本身是否有读权限
  if (!canReadDocument(folder, visitorId ?? null, domainInfo)) {
    return [];
  }

  // 查询所有直接子节点
  const children = findChildrenByParent(db, folderId);
  const filtered = children.filter((r) =>
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
  // 首版提交：工作区文件 + 不可变 blob + head 指针
  const commitId = randomUUID();
  const blob = writeCommitBlob(write.contentHash, content);

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
      headCommitId: commitId,
      createdAt: now,
      updatedAt: now,
      permission,
      fileType: params.fileType ?? "md",
      parentId: params.parentId ?? null,
    });
    insertCommit(db, {
      commitId,
      documentId,
      contentHash: write.contentHash,
      blobRef: blob.blobRef,
      authorVisitorId: params.actorVisitorId,
      createdAt: now,
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
    fileType: params.fileType ?? "md",
    parentId: params.parentId ?? null,
    headCommitId: commitId,
  };
}

// ============================================================
//  读单篇文档（调用方需先鉴权）
// ============================================================

export function getDocument(
  documentId: string,
  visitorId?: string | null,
  format?: "json" | "text",
): DocumentDetail {
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
  // 根据 format 决定返回原始 JSON 还是纯文本
  const finalContent = format === "text"
    ? extractPlainTextFromLexical(content)
    : content;
  return {
    ...rowToSummary(row),
    content: finalContent,
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
  /** 发布版本信息：乐观锁与 merge 发布 */
  version?: PublishVersionContext;
}): DocumentDetail {
  const content = normalizeDocumentContent(params.content, params.contentFormat);
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
  const now = new Date().toISOString();
  const version = params.version;
  const baseCommitId = version?.baseCommitId;
  const mergeCtx = version?.merge;

  // 冲突解决后的合并发布：插 r_local + 双父 merge 节点
  if (mergeCtx) {
    if (!baseCommitId) {
      throw new DocumentError(
        "BAD_REQUEST",
        "merge 发布需要在 version 中提供 baseCommitId",
        400,
      );
    }
    const localSnapshotContent =
      mergeCtx.localSnapshotContent !== undefined
        ? normalizeDocumentContent(mergeCtx.localSnapshotContent, params.contentFormat)
        : undefined;
    return publishMergeDocument({
      row,
      actorVisitorId: params.actorVisitorId,
      content,
      displayName,
      permission: params.permission,
      baseCommitId,
      expectedHeadCommitId: mergeCtx.expectedHeadCommitId,
      localSnapshotContent,
      now,
    });
  }

  // 普通线性发布：客户端 base 必须等于当前 head（未传 version 则跳过校验）
  assertNoVersionConflict(db, row, baseCommitId);

  const write = writeDocument(row.domain_id, row.relative_path, content);
  const commitId = randomUUID();
  const blob = writeCommitBlob(write.contentHash, content);

  const tx = db.transaction(() => {
    updateDocumentContent(db, {
      documentId: row.document_id,
      displayName,
      contentHash: write.contentHash,
      updatedBy: params.actorVisitorId,
      updatedAt: now,
      permission: params.permission,
    });
    insertCommit(db, {
      commitId,
      documentId: row.document_id,
      contentHash: write.contentHash,
      blobRef: blob.blobRef,
      authorVisitorId: params.actorVisitorId,
      createdAt: now,
    });
    // 有上一版 head 时挂一条父边（fast-forward）
    if (row.head_commit_id) {
      insertCommitParent(db, {
        childCommitId: commitId,
        parentCommitId: row.head_commit_id,
      });
    }
    updateDocumentHeadCommit(db, {
      documentId: row.document_id,
      headCommitId: commitId,
      updatedBy: params.actorVisitorId,
      updatedAt: now,
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

  markDirty(row.document_id);
  process.nextTick(() => {
    try {
      rebuildDocument(row.document_id);
    } catch (err) {
      // ignore
    }
  });

  return buildDocumentDetail(row, {
    displayName,
    content,
    contentHash: write.contentHash,
    updatedBy: params.actorVisitorId,
    updatedAt: now,
    permission:
      params.permission !== undefined ? params.permission : row.permission,
    headCommitId: commitId,
  });
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

// --- 版本提交与冲突 ---

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
    ...(row.head_commit_id ? { headCommitId: row.head_commit_id } : {}),
  };
}

/** 组装 API 返回的 DocumentDetail，并带上最新 headCommitId。 */
function buildDocumentDetail(
  row: DocumentRow,
  overrides: {
    displayName: string;
    content: string;
    contentHash: string;
    updatedBy: string;
    updatedAt: string;
    permission: number;
    headCommitId: string;
  },
): DocumentDetail {
  return {
    ...rowToSummary({ ...row, head_commit_id: overrides.headCommitId }),
    content: overrides.content,
    contentHash: overrides.contentHash,
    displayName: overrides.displayName,
    updatedBy: overrides.updatedBy,
    updatedAt: overrides.updatedAt,
    permission: overrides.permission,
  };
}

/**
 * 抛出 409 VERSION_CONFLICT。
 * details 供前端对照合并：当前 head、服务端工作区正文。
 */
function throwVersionConflict(
  row: DocumentRow,
  serverContent: string,
  serverContentHash: string,
): never {
  throw new DocumentError("VERSION_CONFLICT", "版本冲突，请先合并后再发布", 409, {
    headCommitId: row.head_commit_id,
    content: serverContent,
    contentHash: serverContentHash,
  });
}

/**
 * 普通发布前的乐观锁：baseCommitId 与 head 不一致则冲突。
 * 未传 baseCommitId 时跳过（兼容尚未接入的前端）。
 */
function assertNoVersionConflict(
  db: ReturnType<typeof getDb>,
  row: DocumentRow,
  baseCommitId: string | undefined,
): void {
  // 客户端没传 base：旧版前端或未启用冲突检测，直接放行（不进行冲突校验）
  // 文档尚无 head：历史数据/异常态，无法比对，也放行
  if (!baseCommitId || !row.head_commit_id) return;

  // 客户端认为的「我基于的那一版」仍等于服务端当前 head → 无人插队，可 fast-forward 发布
  if (baseCommitId === row.head_commit_id) return;

  // 走到这里：base 有值且与 head 不同 → 说明在你编辑期间 head 已被别人/另一标签推进 → 409
  assertCommitBelongsToDocument(db, baseCommitId, row.document_id);
  const { content, contentHash } = readDocument(row.domain_id, row.relative_path);
  throwVersionConflict(row, content, contentHash);
}

/**
 * 合并发布（用户在浏览器合稿后，PUT version.merge）。
 *
 * 提交图（merge 完成后）示意：
 *
 *     base（开编时的 head，version.baseCommitId）
 *      ├── expectedHead（冲突时远端最新，version.merge.expectedHeadCommitId）
 *      └── r_local（本地支，本次首次落库；父 = base）
 *             \      /
 *              merge（合成稿，新 head；父 = expectedHead + r_local）
 *
 * 步骤：
 * 1. 校验：expectedHead 仍为当前 head；base 是 expectedHead 的祖先（assertMergeFork）
 * 2. 写盘：工作区 = 合成稿；commits 目录落 r_local / merge 快照（writeCommitBlob）
 * 3. 事务：插 r_local + merge 节点与边，更新 documents.head_commit_id
 */
function publishMergeDocument(params: {
  row: DocumentRow;
  actorVisitorId: string;
  content: string;
  displayName: string;
  permission?: number;
  baseCommitId: string;
  expectedHeadCommitId: string;
  /** 已按 contentFormat 转换后的本地快照；未传则用 content */
  localSnapshotContent?: string;
  now: string;
}): DocumentDetail {
  const { row, actorVisitorId, content, displayName, now } = params;
  const db = getDb();

  // 如果row.head_commit_id为空大概率是因为旧客户文章没有commit_id, 不能走conflict merge逻辑
  if (!row.head_commit_id) {
    throw new DocumentError("BAD_REQUEST", "文档尚无提交历史，无法合并发布", 400);
  }
  // 合并过程中若 head 又被别人推进，同样 409
  if (params.expectedHeadCommitId !== row.head_commit_id) {
    const { content: serverContent, contentHash } = readDocument(
      row.domain_id,
      row.relative_path,
    );
    throwVersionConflict(row, serverContent, contentHash);
  }

  assertCommitBelongsToDocument(db, params.baseCommitId, row.document_id);
  assertCommitBelongsToDocument(db, params.expectedHeadCommitId, row.document_id);
  assertMergeFork(db, params.baseCommitId, params.expectedHeadCommitId);

  // 写盘：工作区 + 两份历史快照（r_local 支 / merge 结果）
  const localContent = params.localSnapshotContent ?? content;
  const localHash = sha256(Buffer.from(localContent, "utf8"));
  const write = writeDocument(row.domain_id, row.relative_path, content); // 当前 .md = 合成稿
  const localWrite = writeCommitBlob(localHash, localContent); // r_local 快照
  const mergeBlob = writeCommitBlob(write.contentHash, content); // merge 快照（常与合成稿同 hash）

  const localCommitId = randomUUID();
  const mergeCommitId = randomUUID();

  /*
   * 事务执行步骤
   * 1. 插入r_local commit
   *    1.1 插入 r_local commit parent 边
   *    1.2 更新document content
   * 2. 插入merge commit
   *    2.1 插入merge commit parent 边 (r_local 和 远端 head 双边)
   *    2.2 更新document content
   * 3. 插入audit log
   */
  const tx = db.transaction(() => {
    // 本地支尖端（此前仅存在于浏览器，此处首次落库）
    // 保存r_local
    insertCommit(db, {
      commitId: localCommitId,
      documentId: row.document_id,
      contentHash: localHash,
      blobRef: localWrite.blobRef,
      authorVisitorId: actorVisitorId,
      createdAt: now,
    });
    insertCommitParent(db, {
      childCommitId: localCommitId,
      parentCommitId: params.baseCommitId,
    });

    updateDocumentContent(db, {
      documentId: row.document_id,
      displayName,
      contentHash: write.contentHash,
      updatedBy: actorVisitorId,
      updatedAt: now,
      permission: params.permission,
    });
    // merge 节点：双父 = 远端 head + r_local
    insertCommit(db, {
      commitId: mergeCommitId,
      documentId: row.document_id,
      contentHash: write.contentHash,
      blobRef: mergeBlob.blobRef,
      authorVisitorId: actorVisitorId,
      createdAt: now,
    });
    // merge node 拥有两个 parent, r_local 和 远端head
    // 这里存储的是远端head
    insertCommitParent(db, {
      childCommitId: mergeCommitId,
      parentCommitId: params.expectedHeadCommitId,
    });
    // 这里存储的是r_local
    insertCommitParent(db, {
      childCommitId: mergeCommitId,
      parentCommitId: localCommitId,
    });
    updateDocumentHeadCommit(db, {
      documentId: row.document_id,
      headCommitId: mergeCommitId,
      updatedBy: actorVisitorId,
      updatedAt: now,
    });
    insertAuditLog(db, {
      actorVisitorId,
      action: "document.merge",
      targetType: "document",
      targetId: row.document_id,
      metadata: {
        baseCommitId: params.baseCommitId,
        expectedHeadCommitId: params.expectedHeadCommitId,
        localCommitId,
        mergeCommitId,
      },
      createdAt: now,
    });
  });
  tx();

  markDirty(row.document_id);
  process.nextTick(() => {
    try {
      rebuildDocument(row.document_id);
    } catch {
      // ignore
    }
  });

  return buildDocumentDetail(row, {
    displayName,
    content,
    contentHash: write.contentHash,
    updatedBy: actorVisitorId,
    updatedAt: now,
    permission:
      params.permission !== undefined ? params.permission : row.permission,
    headCommitId: mergeCommitId,
  });
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

/** 将请求正文统一转为落盘格式（Lexical JSON 字符串）。 */
function normalizeDocumentContent(
  content: string,
  contentFormat?: "markdown" | "lexical",
): string {
  return contentFormat === "markdown" ? markdownToLexicalJson(content) : content;
}
