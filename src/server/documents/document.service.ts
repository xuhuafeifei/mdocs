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
  updateDocumentLocation,
  type DocumentRow,
} from "../db/repositories/document.repo.js";
import {
  insertCommit,
  insertCommitParent,
  findCommitById,
  listCommitsByDocument as listCommitRowsByDocument,
} from "../db/repositories/commit.repo.js";
import {
  AUTO_PUBLISH_MESSAGE,
  isPublishSource,
  PUBLISH_MESSAGE_MAX_LENGTH,
  type PublishSource,
} from "../../shared/publish-meta.js";
import {
  assertCommitBelongsToDocument,
  assertMergeFork,
  findMergeBaseCommitId,
  isAncestorOf,
} from "./commit-graph.js";
import { findVisitorById } from "../db/repositories/visitor.repo.js";
import {
  findDomainById,
  getDomainMemberRole,
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
  makeDomainAccessInfo,
  validateDomainPermission,
} from "../access/access-control.js";
import {
  findAuditById,
  insertAuditLog,
  listDocumentDeleteAuditsByActor,
} from "../db/repositories/audit.repo.js";
import {
  deleteDocumentFile,
  readCommitBlob,
  readDocument,
  renameDocumentFile,
  renameDocumentFileIfPresent,
  sha256,
  writeCommitBlob,
  writeDocument,
} from "../storage/file-store.js";
import {
  markDirty,
  removeIndex,
  rebuildDocument,
} from "../search/document-index-manager.js";
import { upsertDocumentEmbeddings } from "../search/embedding-store.js";
import type {
  DocumentDetail,
  DocumentMergeContext,
  DocumentSummary,
  DocumentSyncStatus,
  PublishVersionContext,
} from "../../shared/types/document.js";
import { getConfig } from "../config/index.js";
import { markdownToLexicalJson } from "./markdown-to-lexical.js";
import { lexicalJsonToMarkdown } from "./lexical-to-markdown.js";
import { extractPlainTextFromLexical } from "./lexical-text.js";
import { FILE_TYPE, isGraphFileType } from "../../shared/file-types.js";
import { isFolderDescPath } from "../../shared/folderDesc.js";
import { getPolicy } from "../../shared/file-type-policy.js";
import {
  onArticleDeleted,
  onArticleMoved,
  onArticlePublished,
  onFolderDeleted,
  scheduleGraphLifecycle,
} from "./graph/lifecycle.js";

function scheduleFtsIfNeeded(fileType: string, documentId: string): void {
  const policy = getPolicy(fileType as any);
  if (!policy?.ftsIndex) return;
  markDirty(documentId);
  process.nextTick(() => {
    try {
      const plain = rebuildDocument(documentId);
      if (plain) {
        void upsertDocumentEmbeddings({
          documentId,
          domainId: plain.domainId,
          plainText: plain.plainText,
          label: plain.displayName || plain.relativePath || documentId,
        });
      }
    } catch {
      // 定时器会再扫 dirty
    }
  });
}

function scheduleGraphIfExtractable(
  fileType: string,
  task: () => Promise<void>,
): void {
  const policy = getPolicy(fileType as any);
  if (!policy?.graphExtract) return;
  scheduleGraphLifecycle(task);
}

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
  const domainInfo = makeDomainAccessInfo(db, effective, visitorId, domainPermission);

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
  const domainInfo = makeDomainAccessInfo(
    db,
    folder.domain_id,
    visitorId,
    domainPermission,
  );

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
function normalizeFileName(fileName: string, fileType?: string): string {
  let normalized = fileName.trim();

  // 移除路径字符，只保留文件名
  normalized = normalized.split(/[\\/]/).pop() || "untitled";

  // 替换非法字符
  normalized = normalized.replace(/[^\w\u4e00-\u9fa5\-_.]/g, "_");

  // 按 fileType 确定目标后缀
  const ext =
    fileType === FILE_TYPE.HTML
      ? ".html"
      : fileType === FILE_TYPE.SHEET
        ? ".sheet"
        : ".md";

  // 确保以正确后缀结尾
  const lower = normalized.toLowerCase();
  if (!lower.endsWith(".md") && !lower.endsWith(".html") && !lower.endsWith(".sheet")) {
    normalized += ext;
  }

  // 避免空文件名
  const checkLower = normalized.toLowerCase();
  if (checkLower === ".md" || checkLower === ".html" || checkLower === ".sheet") {
    normalized = "untitled" + ext;
  }

  return normalized;
}

export function createDocument(params: {
  actorVisitorId: string;
  fileName: string;
  displayName?: string;
  content: string;
  domainId?: string;
  permission?: number;
  fileType?: string;
  parentId?: string | null;
  /** 内容格式，默认 'lexical'；传 'markdown' 时自动转换为 Lexical JSON */
  contentFormat?: "markdown" | "lexical";
}): DocumentDetail {
  const fileType = params.fileType ?? FILE_TYPE.DOCUMENT;
  const policy = getPolicy(fileType as any);

  if (policy.writeNormalize === "raw" && params.contentFormat === "markdown") {
    throw new DocumentError(
      "BAD_REQUEST",
      "raw 文档不支持 contentFormat=markdown",
      400,
    );
  }

  // html 等 raw 类型：内容原样存；md：可 markdown→Lexical
  const content =
    policy.writeNormalize === "raw"
      ? params.content
      : params.contentFormat === "markdown"
        ? markdownToLexicalJson(params.content)
        : params.content;
  const cfg = getConfig();
  const domainId = params.domainId?.trim() || cfg.defaultDomainId;
  const db = getDb();

  const domainRow = findDomainById(db, domainId);
  if (!domainRow) {
    throw new DocumentError("DOMAIN_NOT_FOUND", "工作空间不存在", 404);
  }
  const access = resolveDomainAccess(
    db,
    domainRow,
    domainId,
    params.actorVisitorId,
  );
  if (access.kind !== "full") {
    throw new DocumentError("FORBIDDEN", "无权在该工作空间创建文档", 403);
  }

  // 自动计算 relativePath
  let relativePath: string;
  const normalizedFileName = normalizeFileName(params.fileName, fileType);

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
        `工作空间类型"${domainRow.permission}"不允许权限值 ${params.permission}`,
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
      fileType,
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

  // 异步标记并重建索引（仅 ftsIndex 类型）
  scheduleFtsIfNeeded(fileType, documentId);

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
  format?: "json" | "text" | "md",
): DocumentDetail {
  const row = findDocumentById(getDb(), documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  const { content, contentHash } = readDocument(
    row.domain_id,
    row.relative_path,
  );
  const invitedEdit = visitorId
    ? resolveInvitedEditFlag(getDb(), row, visitorId)
    : false;
  const domainMemberWrite = visitorId
    ? resolveDomainMemberWriteFlag(getDb(), row, visitorId)
    : false;
  // 根据政策表的 textExtract 决定 format 行为
  const policy = getPolicy(row.file_type as any);
  let finalContent: string;
  if (policy.textExtract === 'none') {
    // 图谱等：忽略 format，始终返回原始内容
    finalContent = content;
  } else if (policy.textExtract === 'raw') {
    // html 等：返回原始内容（可选剥标签）
    finalContent = content;
  } else if (format === "text") {
    finalContent = extractPlainTextFromLexical(content);
  } else if (format === "md") {
    finalContent = lexicalJsonToMarkdown(content);
  } else {
    // 默认 json：Lexical 原文
    finalContent = content;
  }
  return {
    ...rowToSummary(row),
    content: finalContent,
    contentHash,
    permission: row.permission,
    ...(invitedEdit ? { invitedEdit: true } : {}),
    ...(domainMemberWrite ? { domainMemberWrite: true } : {}),
  };
}

// ============================================================
//  更新文档
// ============================================================

/** 规范化发布 message / source；auto 强制文案。 */
export function normalizePublishMeta(input?: {
  message?: string;
  source?: string;
}): { message: string; source: PublishSource } {
  const source: PublishSource = isPublishSource(input?.source) ? input!.source! : "manual";
  if (source === "auto") {
    return { message: AUTO_PUBLISH_MESSAGE, source };
  }
  const message = typeof input?.message === "string" ? input.message : "";
  if (message.length > PUBLISH_MESSAGE_MAX_LENGTH) {
    throw new DocumentError(
      "BAD_REQUEST",
      `message 最长 ${PUBLISH_MESSAGE_MAX_LENGTH} 字符`,
      400,
    );
  }
  return { message, source };
}

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
  /** 发布说明（类似 git commit message） */
  message?: string;
  /** 发布来源 */
  source?: PublishSource | string;
}): DocumentDetail {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);

  // html 等 raw：不走 markdown→Lexical
  const policy = getPolicy(row.file_type as any);
  if (policy.writeNormalize === "raw" && params.contentFormat === "markdown") {
    throw new DocumentError(
      "BAD_REQUEST",
      "raw 文档不支持 contentFormat=markdown",
      400,
    );
  }
  const content =
    policy.writeNormalize === "raw"
      ? params.content
      : normalizeDocumentContent(params.content, params.contentFormat);

  const domain = findDomainById(db, row.domain_id);
  const domainPermission = domain?.permission ?? "public";
  const domainInfo = makeDomainAccessInfo(
    db,
    row.domain_id,
    params.actorVisitorId,
    domainPermission,
  );
  if (!canEditDocument(row, params.actorVisitorId, domainInfo)) {
    throw new DocumentError("FORBIDDEN", "无权编辑此文档", 403);
  }

  if (
    params.permission !== undefined &&
    !validateDomainPermission(domainPermission, params.permission)
  ) {
    throw new DocumentError(
      "INVALID_PERMISSION",
      `工作空间类型"${domainPermission}"不允许权限值 ${params.permission}`,
      400,
    );
  }

  const displayName = params.displayName?.trim() || row.display_name;
  const now = new Date().toISOString();
  const version = params.version;
  const localBaseCommitId = version?.localBaseCommitId;
  const mergeCtx = version?.merge;
  const publishMeta = normalizePublishMeta({
    message: params.message,
    source: params.source,
  });

  // 冲突解决后的合并发布：插 r_local + 双父 merge 节点
  if (mergeCtx) {
    if (!localBaseCommitId) {
      throw new DocumentError(
        "BAD_REQUEST",
        "merge 发布需要在 version 中提供 localBaseCommitId",
        400,
      );
    }
    if (mergeCtx.forceLocal === true && row.owner_visitor_id !== params.actorVisitorId) {
      throw new DocumentError("FORBIDDEN", "仅文档所有者可以强制覆盖", 403);
    }
    const localSnapshotContent =
      mergeCtx.localSnapshotContent !== undefined
        ? policy.writeNormalize === "raw"
          ? mergeCtx.localSnapshotContent
          : normalizeDocumentContent(mergeCtx.localSnapshotContent, params.contentFormat)
        : undefined;
    const mergeContent =
      mergeCtx.forceLocal === true ? (localSnapshotContent ?? content) : content;
    return publishMergeDocument({
      row,
      actorVisitorId: params.actorVisitorId,
      content: mergeContent,
      displayName,
      permission: params.permission,
      localBaseCommitId,
      remoteCommitId: mergeCtx.remoteCommitId,
      localSnapshotContent,
      now,
      message: publishMeta.message,
      source: publishMeta.source,
    });
  }

  // 普通线性发布：客户端 base 必须等于当前 head（未传 version 则跳过校验）
  assertNoVersionConflict(db, row, localBaseCommitId);

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
      message: publishMeta.message,
      source: publishMeta.source,
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

  scheduleFtsIfNeeded(row.file_type, row.document_id);

  scheduleGraphIfExtractable(row.file_type, () =>
    onArticlePublished({
      domainId: row.domain_id,
      documentId: row.document_id,
      parentId: row.parent_id,
    }),
  );

  // 写后直接返回最新 DocumentDetail（而非要求前端再 GET）：
  // 1) 降低竞争态：避免 PUT 与后续 GET 间隙被他人再次推进 head；
  // 2) 单一真相：以后端实际落库结果为准（权限、head、invite 派生字段等）。
  const invitedEdit = resolveInvitedEditFlag(db, row, params.actorVisitorId);
  const domainMemberWrite = resolveDomainMemberWriteFlag(
    db,
    row,
    params.actorVisitorId,
  );
  return buildDocumentDetail(row, {
    displayName,
    content,
    contentHash: write.contentHash,
    updatedBy: params.actorVisitorId,
    updatedAt: now,
    permission:
      params.permission !== undefined ? params.permission : row.permission,
    headCommitId: commitId,
    invitedEdit,
    domainMemberWrite,
  });
}

// ============================================================
//  删除文档 / 恢复
// ============================================================

/** 删文审计里的 recovery 快照（head 指针，正文在 commit blob）。 */
export type DocumentDeleteRecovery = {
  domainId: string;
  displayName: string;
  fileType: string;
  permission: number;
  parentId: string | null;
  ownerVisitorId: string;
  createdBy: string;
  contentHash: string;
  headCommitId: string | null;
  blobRef: string | null;
  createdAt: string;
  updatedAt: string;
};

function buildDeleteRecovery(
  db: ReturnType<typeof getDb>,
  row: DocumentRow,
): DocumentDeleteRecovery {
  let blobRef: string | null = null;
  let contentHash = row.content_hash;
  if (row.head_commit_id) {
    const commit = findCommitById(db, row.head_commit_id);
    if (commit) {
      blobRef = commit.blob_ref;
      contentHash = commit.content_hash;
    }
  }
  return {
    domainId: row.domain_id,
    displayName: row.display_name,
    fileType: row.file_type,
    permission: row.permission,
    parentId: row.parent_id,
    ownerVisitorId: row.owner_visitor_id,
    createdBy: row.created_by,
    contentHash,
    headCommitId: row.head_commit_id,
    blobRef,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseDeleteRecovery(raw: unknown): DocumentDeleteRecovery | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.domainId !== "string" || !o.domainId.trim()) return null;
  if (typeof o.displayName !== "string") return null;
  if (typeof o.fileType !== "string") return null;
  if (typeof o.permission !== "number") return null;
  if (typeof o.ownerVisitorId !== "string") return null;
  if (typeof o.createdBy !== "string") return null;
  if (typeof o.contentHash !== "string") return null;
  if (typeof o.createdAt !== "string" || typeof o.updatedAt !== "string") return null;
  return {
    domainId: o.domainId,
    displayName: o.displayName,
    fileType: o.fileType,
    permission: o.permission,
    parentId: typeof o.parentId === "string" ? o.parentId : o.parentId === null ? null : null,
    ownerVisitorId: o.ownerVisitorId,
    createdBy: o.createdBy,
    contentHash: o.contentHash,
    headCommitId: typeof o.headCommitId === "string" ? o.headCommitId : null,
    blobRef: typeof o.blobRef === "string" ? o.blobRef : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

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
  const hook = {
    domainId: row.domain_id,
    documentId: row.document_id,
    parentId: row.parent_id,
  };
  const now = new Date().toISOString();
  const recovery = buildDeleteRecovery(db, row);
  const tx = db.transaction(() => {
    deleteDocument(db, row.document_id);
    insertAuditLog(db, {
      actorVisitorId: params.actorVisitorId,
      action: "document.delete",
      targetType: "document",
      targetId: row.document_id,
      metadata: { relativePath: row.relative_path, recovery },
      createdAt: now,
    });
  });
  tx();
  deleteDocumentFile(row.domain_id, row.relative_path);
  // 从全文索引中移除（非 fts 类型也安全 no-op）
  removeIndex(row.document_id);

  scheduleGraphIfExtractable(row.file_type, () => onArticleDeleted(hook));
}

export type DeletedDocumentListItem = {
  auditId: number;
  documentId: string;
  deletedAt: string;
  relativePath: string;
  displayName: string;
  domainId: string;
  fileType: string;
  viaFolderDelete: boolean;
  restorable: boolean;
};

/** 当前访客删过的、带 recovery 的文档（最近 N 条）。 */
export function listDeletedDocuments(params: {
  actorVisitorId: string;
  limit?: number;
}): DeletedDocumentListItem[] {
  const db = getDb();
  const rows = listDocumentDeleteAuditsByActor(
    db,
    params.actorVisitorId,
    params.limit ?? 50,
  );
  const out: DeletedDocumentListItem[] = [];
  for (const row of rows) {
    let meta: Record<string, unknown> = {};
    try {
      meta = row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : {};
    } catch {
      continue;
    }
    const recovery = parseDeleteRecovery(meta.recovery);
    if (!recovery) continue;
    if (recovery.ownerVisitorId !== params.actorVisitorId) continue;
    const relativePath =
      typeof meta.relativePath === "string" ? meta.relativePath : recovery.displayName;
    out.push({
      auditId: row.id,
      documentId: row.target_id ?? "",
      deletedAt: row.created_at,
      relativePath,
      displayName: recovery.displayName,
      domainId: recovery.domainId,
      fileType: recovery.fileType,
      viaFolderDelete: meta.viaFolderDelete === true,
      restorable: !!(
        recovery.headCommitId &&
        recovery.blobRef &&
        recovery.fileType !== "dir" &&
        recovery.fileType !== FILE_TYPE.GRAPH_DIR
      ),
    });
  }
  return out;
}

/** 按删除审计恢复文档（同 documentId + head blob）。 */
export function restoreDocumentFromAudit(params: {
  actorVisitorId: string;
  auditId: number;
}): DocumentDetail {
  const db = getDb();
  const audit = findAuditById(db, params.auditId);
  if (!audit || audit.action !== "document.delete") {
    throw new DocumentError("AUDIT_NOT_FOUND", "删除审计不存在", 404);
  }
  let meta: Record<string, unknown> = {};
  try {
    meta = audit.metadata_json
      ? (JSON.parse(audit.metadata_json) as Record<string, unknown>)
      : {};
  } catch {
    throw new DocumentError("INVALID_RECOVERY", "删除审计 metadata 无法解析", 400);
  }
  const recovery = parseDeleteRecovery(meta.recovery);
  if (!recovery) {
    throw new DocumentError("INVALID_RECOVERY", "该删除记录无可恢复快照", 400);
  }
  if (recovery.ownerVisitorId !== params.actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "仅原创建者可恢复此文档", 403);
  }
  const documentId = audit.target_id?.trim();
  if (!documentId) {
    throw new DocumentError("INVALID_RECOVERY", "删除审计缺少 documentId", 400);
  }
  const relativePath =
    typeof meta.relativePath === "string" && meta.relativePath.trim()
      ? meta.relativePath.trim()
      : null;
  if (!relativePath) {
    throw new DocumentError("INVALID_RECOVERY", "删除审计缺少 relativePath", 400);
  }
  if (!recovery.headCommitId || !recovery.blobRef) {
    throw new DocumentError("BLOB_MISSING", "无 head 快照，无法恢复正文", 409);
  }
  if (recovery.fileType === "dir" || recovery.fileType === FILE_TYPE.GRAPH_DIR) {
    throw new DocumentError("NOT_RESTORABLE", "目录节点本期不支持恢复", 400);
  }

  if (findDocumentById(db, documentId)) {
    throw new DocumentError("DOC_EXISTS", "文档已存在，无法恢复到同一 documentId", 409);
  }
  const pathTaken = findDocumentByPath(db, recovery.domainId, relativePath);
  if (pathTaken) {
    throw new DocumentError(
      "PATH_EXISTS",
      "同路径已被占用，无法恢复",
      409,
      { existingDocumentId: pathTaken.document_id, relativePath },
    );
  }

  let content: string;
  try {
    content = readCommitBlob(recovery.blobRef);
  } catch {
    throw new DocumentError("BLOB_MISSING", "commit blob 不存在或不可读", 409);
  }
  const contentHash = sha256(Buffer.from(content, "utf8"));
  if (contentHash !== recovery.contentHash) {
    throw new DocumentError("BLOB_HASH_MISMATCH", "blob 内容与记录的 hash 不一致", 409);
  }

  const parentId =
    recovery.parentId && findDocumentById(db, recovery.parentId)
      ? recovery.parentId
      : null;

  const now = new Date().toISOString();
  const write = writeDocument(recovery.domainId, relativePath, content);

  const tx = db.transaction(() => {
    insertDocument(db, {
      documentId,
      domainId: recovery.domainId,
      relativePath,
      displayName: recovery.displayName,
      ownerVisitorId: recovery.ownerVisitorId,
      createdBy: recovery.createdBy,
      updatedBy: params.actorVisitorId,
      contentHash: write.contentHash,
      headCommitId: recovery.headCommitId!,
      createdAt: recovery.createdAt,
      updatedAt: now,
      permission: recovery.permission,
      fileType: recovery.fileType,
      parentId,
    });
    insertCommit(db, {
      commitId: recovery.headCommitId!,
      documentId,
      contentHash: write.contentHash,
      blobRef: recovery.blobRef!,
      authorVisitorId: recovery.ownerVisitorId,
      createdAt: recovery.updatedAt,
    });
    insertAuditLog(db, {
      actorVisitorId: params.actorVisitorId,
      action: "document.restore",
      targetType: "document",
      targetId: documentId,
      metadata: {
        auditId: params.auditId,
        relativePath,
        headCommitId: recovery.headCommitId,
      },
      createdAt: now,
    });
  });
  tx();

  scheduleFtsIfNeeded(recovery.fileType, documentId);

  const row = findDocumentById(db, documentId)!;
  return buildDocumentDetail(row, {
    displayName: row.display_name,
    content,
    contentHash: row.content_hash,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    permission: row.permission,
    headCommitId: row.head_commit_id!,
  });
}

// ============================================================
//  版本历史 / 选版恢复（旧内容新 commit）
// ============================================================

export type DocumentCommitSummary = {
  commitId: string;
  createdAt: string;
  authorVisitorId: string;
  authorVisitorName: string | null;
  contentHash: string;
  isHead: boolean;
  message: string;
  source: PublishSource;
};

export type DocumentCommitDetail = DocumentCommitSummary & {
  content: string;
};

function commitSourceOf(c: { source?: string | null }): PublishSource {
  return isPublishSource(c.source) ? c.source : "manual";
}

export function listDocumentCommits(documentId: string): DocumentCommitSummary[] {
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  const head = row.head_commit_id;
  const commits = listCommitRowsByDocument(db, documentId);
  return commits.map((c) => {
    const author = findVisitorById(db, c.author_visitor_id);
    return {
      commitId: c.commit_id,
      createdAt: c.created_at,
      authorVisitorId: c.author_visitor_id,
      authorVisitorName: author?.visitor_name ?? null,
      contentHash: c.content_hash,
      isHead: head != null && c.commit_id === head,
      message: c.message ?? "",
      source: commitSourceOf(c),
    };
  });
}

export function getDocumentCommit(
  documentId: string,
  commitId: string,
): DocumentCommitDetail {
  const db = getDb();
  const row = findDocumentById(db, documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  const commit = findCommitById(db, commitId);
  if (!commit || commit.document_id !== documentId) {
    throw new DocumentError("COMMIT_NOT_FOUND", "版本不存在", 404);
  }
  let content: string;
  try {
    content = readCommitBlob(commit.blob_ref);
  } catch {
    throw new DocumentError("BLOB_MISSING", "该版本正文不可读", 409);
  }
  const author = findVisitorById(db, commit.author_visitor_id);
  return {
    commitId: commit.commit_id,
    createdAt: commit.created_at,
    authorVisitorId: commit.author_visitor_id,
    authorVisitorName: author?.visitor_name ?? null,
    contentHash: commit.content_hash,
    isHead: row.head_commit_id != null && commit.commit_id === row.head_commit_id,
    message: commit.message ?? "",
    source: commitSourceOf(commit),
    content,
  };
}

/**
 * 将选中历史版正文作为新 commit 发布（parent = 当前 head）。
 * 若目标已是 head 且工作区 hash 一致 → 不插新节点，直接返回当前详情。
 */
export function restoreDocumentVersion(params: {
  actorVisitorId: string;
  documentId: string;
  commitId: string;
}): DocumentDetail {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);

  const domain = findDomainById(db, row.domain_id);
  const domainPermission = domain?.permission ?? "public";
  const domainInfo = makeDomainAccessInfo(
    db,
    row.domain_id,
    params.actorVisitorId,
    domainPermission,
  );
  if (!canEditDocument(row, params.actorVisitorId, domainInfo)) {
    throw new DocumentError("FORBIDDEN", "无权编辑此文档", 403);
  }

  const source = findCommitById(db, params.commitId);
  if (!source || source.document_id !== params.documentId) {
    throw new DocumentError("COMMIT_NOT_FOUND", "版本不存在", 404);
  }

  let content: string;
  try {
    content = readCommitBlob(source.blob_ref);
  } catch {
    throw new DocumentError("BLOB_MISSING", "该版本正文不可读", 409);
  }

  if (
    row.head_commit_id === source.commit_id &&
    row.content_hash === source.content_hash
  ) {
    return getDocument(params.documentId, params.actorVisitorId);
  }

  const now = new Date().toISOString();
  const write = writeDocument(row.domain_id, row.relative_path, content);
  const newCommitId = randomUUID();
  const blob = writeCommitBlob(write.contentHash, content);
  const previousHead = row.head_commit_id;

  const tx = db.transaction(() => {
    updateDocumentContent(db, {
      documentId: row.document_id,
      displayName: row.display_name,
      contentHash: write.contentHash,
      updatedBy: params.actorVisitorId,
      updatedAt: now,
    });
    insertCommit(db, {
      commitId: newCommitId,
      documentId: row.document_id,
      contentHash: write.contentHash,
      blobRef: blob.blobRef,
      authorVisitorId: params.actorVisitorId,
      createdAt: now,
      message: "",
      source: "manual",
    });
    if (previousHead) {
      insertCommitParent(db, {
        childCommitId: newCommitId,
        parentCommitId: previousHead,
      });
    }
    updateDocumentHeadCommit(db, {
      documentId: row.document_id,
      headCommitId: newCommitId,
      updatedBy: params.actorVisitorId,
      updatedAt: now,
    });
    insertAuditLog(db, {
      actorVisitorId: params.actorVisitorId,
      action: "document.restore_version",
      targetType: "document",
      targetId: row.document_id,
      metadata: {
        fromCommitId: source.commit_id,
        newCommitId,
        previousHeadCommitId: previousHead,
      },
      createdAt: now,
    });
  });
  tx();

  scheduleFtsIfNeeded(row.file_type, row.document_id);
  scheduleGraphIfExtractable(row.file_type, () =>
    onArticlePublished({
      domainId: row.domain_id,
      documentId: row.document_id,
      parentId: row.parent_id,
    }),
  );

  const invitedEdit = resolveInvitedEditFlag(db, row, params.actorVisitorId);
  const domainMemberWrite = resolveDomainMemberWriteFlag(
    db,
    row,
    params.actorVisitorId,
  );
  return buildDocumentDetail(row, {
    displayName: row.display_name,
    content,
    contentHash: write.contentHash,
    updatedBy: params.actorVisitorId,
    updatedAt: now,
    permission: row.permission,
    headCommitId: newCommitId,
    invitedEdit,
    domainMemberWrite,
  });
}

// ============================================================
//  移动文档（同域；改 parent_id + relative_path + 磁盘）
// ============================================================

function basenameRelativePath(relativePath: string): string {
  const i = relativePath.lastIndexOf("/");
  return i === -1 ? relativePath : relativePath.slice(i + 1);
}

export function moveDocument(params: {
  actorVisitorId: string;
  documentId: string;
  parentId: string | null;
}): DocumentDetail {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  if (row.owner_visitor_id !== params.actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可移动此文件", 403);
  }

  if (row.file_type === FILE_TYPE.FOLDER) {
    return moveFolder(params);
  }

  if (!getPolicy(row.file_type as any).movable) {
    throw new DocumentError("INVALID_TYPE", "该类型文件不支持移动", 400);
  }

  const currentParent = row.parent_id ?? null;
  const targetParent = params.parentId;
  if (currentParent === targetParent) {
    return getDocument(params.documentId, params.actorVisitorId);
  }

  let newParentId: string | null;
  let newRelativePath: string;
  const baseName = basenameRelativePath(row.relative_path);

  if (targetParent == null) {
    newParentId = null;
    newRelativePath = baseName;
  } else {
    const parentDoc = findDocumentById(db, targetParent);
    if (!parentDoc || parentDoc.file_type !== "dir") {
      throw new DocumentError(
        "INVALID_PARENT",
        "无效的父节点或父节点不是文件夹",
        400,
      );
    }
    if (parentDoc.domain_id !== row.domain_id) {
      throw new DocumentError("CROSS_DOMAIN", "不能跨工作空间移动文档", 400);
    }
    newParentId = targetParent;
    const parentPath = parentDoc.relative_path.endsWith("/")
      ? parentDoc.relative_path.slice(0, -1)
      : parentDoc.relative_path;
    newRelativePath = `${parentPath}/${baseName}`;
  }

  const existing = findDocumentByPath(db, row.domain_id, newRelativePath);
  if (existing && existing.document_id !== row.document_id) {
    throw new DocumentError("DOC_EXISTS", "目标位置已存在同名文档", 409);
  }

  const now = new Date().toISOString();
  const oldPath = row.relative_path;
  const oldParentId = currentParent;
  const pathChanged = oldPath !== newRelativePath;

  if (pathChanged) {
    try {
      renameDocumentFile(row.domain_id, oldPath, newRelativePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new DocumentError("STORAGE_ERROR", msg, 500);
    }
  }

  try {
    const tx = db.transaction(() => {
      updateDocumentLocation(db, {
        documentId: row.document_id,
        parentId: newParentId,
        relativePath: newRelativePath,
        updatedBy: params.actorVisitorId,
        updatedAt: now,
      });
      insertAuditLog(db, {
        actorVisitorId: params.actorVisitorId,
        action: "document.move",
        targetType: "document",
        targetId: row.document_id,
        metadata: {
          fromRelativePath: oldPath,
          toRelativePath: newRelativePath,
          parentId: newParentId,
        },
        createdAt: now,
      });
    });
    tx();
  } catch (err) {
    if (pathChanged) {
      try {
        renameDocumentFile(row.domain_id, newRelativePath, oldPath);
      } catch {
        // 回滚失败留给运维；主错误仍抛出
      }
    }
    throw err;
  }

  scheduleFtsIfNeeded(row.file_type, row.document_id);

  scheduleGraphIfExtractable(row.file_type, () =>
    onArticleMoved({
      domainId: row.domain_id,
      documentId: row.document_id,
      oldParentId,
      newParentId,
    }),
  );

  return getDocument(params.documentId, params.actorVisitorId);
}

/**
 * 移动目录：子孙 relative_path 一并改写；图谱隐藏文件不搬家，直接删。
 */
function moveFolder(params: {
  actorVisitorId: string;
  documentId: string;
  parentId: string | null;
}): DocumentDetail {
  const db = getDb();
  const folder = findDocumentById(db, params.documentId);
  if (!folder || folder.file_type !== FILE_TYPE.FOLDER) {
    throw new DocumentError("DOC_NOT_FOUND", "目录不存在", 404);
  }
  if (folder.owner_visitor_id !== params.actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可移动此目录", 403);
  }

  const currentParent = folder.parent_id ?? null;
  const targetParent = params.parentId;
  if (currentParent === targetParent) {
    return getDocument(params.documentId, params.actorVisitorId);
  }

  if (targetParent === folder.document_id) {
    throw new DocumentError("INVALID_PARENT", "不能将目录移动到自身下", 400);
  }

  let newParentId: string | null;
  let newFolderPath: string;
  const baseName = basenameRelativePath(folder.relative_path);

  if (targetParent == null) {
    newParentId = null;
    newFolderPath = baseName;
  } else {
    const parentDoc = findDocumentById(db, targetParent);
    if (!parentDoc || parentDoc.file_type !== "dir") {
      throw new DocumentError(
        "INVALID_PARENT",
        "无效的父节点或父节点不是文件夹",
        400,
      );
    }
    if (parentDoc.domain_id !== folder.domain_id) {
      throw new DocumentError("CROSS_DOMAIN", "不能跨工作空间移动目录", 400);
    }
    if (
      parentDoc.relative_path === folder.relative_path ||
      parentDoc.relative_path.startsWith(`${folder.relative_path}/`)
    ) {
      throw new DocumentError("INVALID_PARENT", "不能将目录移动到其子孙下", 400);
    }
    newParentId = targetParent;
    const parentPath = parentDoc.relative_path.endsWith("/")
      ? parentDoc.relative_path.slice(0, -1)
      : parentDoc.relative_path;
    newFolderPath = `${parentPath}/${baseName}`;
  }

  const oldFolderPath = folder.relative_path;
  const oldPrefix = `${oldFolderPath}/`;
  const descendants = listDocumentsByPathPrefix(db, folder.domain_id, oldPrefix);
  const subtree = [folder, ...descendants];

  const notOwned = subtree.filter((d) => d.owner_visitor_id !== params.actorVisitorId);
  if (notOwned.length > 0) {
    throw new DocumentError(
      "FORBIDDEN",
      `目录下有 ${notOwned.length} 篇文档不属于你，无法移动`,
      403,
    );
  }

  const graphDocs = descendants.filter((d) => isGraphFileType(d.file_type));
  const movingDocs = subtree.filter((d) => !isGraphFileType(d.file_type));

  type MovePlan = { row: DocumentRow; newPath: string; newParentId: string | null };
  const plans: MovePlan[] = movingDocs.map((doc) => {
    if (doc.document_id === folder.document_id) {
      return { row: doc, newPath: newFolderPath, newParentId };
    }
    const suffix = doc.relative_path.slice(oldPrefix.length);
    return {
      row: doc,
      newPath: `${newFolderPath}/${suffix}`,
      newParentId: doc.parent_id,
    };
  });

  const movingIds = new Set(plans.map((p) => p.row.document_id));
  for (const plan of plans) {
    const existing = findDocumentByPath(db, folder.domain_id, plan.newPath);
    if (existing && !movingIds.has(existing.document_id)) {
      throw new DocumentError("DOC_EXISTS", "目标位置已存在同名文档", 409);
    }
  }

  const now = new Date().toISOString();
  // dir 无盘上独立文件；resolveDocAbsolutePath 还要求 .md/.html/… 后缀，
  // 对无后缀的目录 path 会抛「must end with .md…」。只搬真实文件。
  const diskOps = plans
    .filter((p) => p.row.relative_path !== p.newPath)
    .filter((p) => p.row.file_type !== FILE_TYPE.FOLDER)
    .sort((a, b) => b.row.relative_path.length - a.row.relative_path.length);

  const doneDisk: Array<{ from: string; to: string }> = [];
  try {
    for (const plan of diskOps) {
      renameDocumentFileIfPresent(folder.domain_id, plan.row.relative_path, plan.newPath);
      doneDisk.push({ from: plan.row.relative_path, to: plan.newPath });
    }
  } catch (err) {
    for (const op of [...doneDisk].reverse()) {
      try {
        renameDocumentFileIfPresent(folder.domain_id, op.to, op.from);
      } catch {
        /* 回滚尽力 */
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new DocumentError("STORAGE_ERROR", msg, 500);
  }

  try {
    const tx = db.transaction(() => {
      for (const g of graphDocs) {
        deleteDocument(db, g.document_id);
        insertAuditLog(db, {
          actorVisitorId: params.actorVisitorId,
          action: "document.delete",
          targetType: "document",
          targetId: g.document_id,
          metadata: {
            relativePath: g.relative_path,
            viaFolderMove: true,
            reason: "graph-hidden-on-folder-move",
          },
          createdAt: now,
        });
      }
      for (const plan of plans) {
        updateDocumentLocation(db, {
          documentId: plan.row.document_id,
          parentId: plan.newParentId,
          relativePath: plan.newPath,
          updatedBy: params.actorVisitorId,
          updatedAt: now,
        });
      }
      insertAuditLog(db, {
        actorVisitorId: params.actorVisitorId,
        action: "folder.move",
        targetType: "folder",
        targetId: folder.document_id,
        metadata: {
          fromRelativePath: oldFolderPath,
          toRelativePath: newFolderPath,
          parentId: newParentId,
          movedCount: plans.length,
          deletedGraphCount: graphDocs.length,
        },
        createdAt: now,
      });
    });
    tx();
  } catch (err) {
    for (const op of [...doneDisk].reverse()) {
      try {
        renameDocumentFileIfPresent(folder.domain_id, op.to, op.from);
      } catch {
        /* 回滚尽力 */
      }
    }
    throw err;
  }

  for (const g of graphDocs) {
    try {
      deleteDocumentFile(folder.domain_id, g.relative_path);
    } catch {
      /* 盘上可能已不存在 */
    }
    removeIndex(g.document_id);
  }

  for (const plan of plans) {
    scheduleFtsIfNeeded(plan.row.file_type, plan.row.document_id);
    scheduleGraphIfExtractable(plan.row.file_type, () =>
      onArticleMoved({
        domainId: folder.domain_id,
        documentId: plan.row.document_id,
        oldParentId: plan.row.parent_id,
        newParentId: plan.newParentId,
      }),
    );
  }

  const updated = findDocumentById(db, params.documentId)!;
  return {
    ...rowToSummary(updated),
    content: "",
    contentHash: updated.content_hash ?? "",
    permission: updated.permission,
  };
}

// ============================================================
//  重命名文档文件名（同域、同父目录；只改 basename）
// ============================================================

export function renameDocument(params: {
  actorVisitorId: string;
  documentId: string;
  fileName: string;
}): DocumentDetail {
  const db = getDb();
  const row = findDocumentById(db, params.documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  if (row.owner_visitor_id !== params.actorVisitorId) {
    throw new DocumentError("FORBIDDEN", "仅创建者可重命名此文件", 403);
  }
  if (!getPolicy(row.file_type as any).movable) {
    throw new DocumentError("INVALID_TYPE", "该类型文件不支持重命名", 400);
  }
  if (!params.fileName?.trim()) {
    throw new DocumentError("BAD_REQUEST", "fileName is required", 400);
  }

  const baseName = normalizeFileName(params.fileName, row.file_type);
  const slash = row.relative_path.lastIndexOf("/");
  const newRelativePath =
    slash === -1 ? baseName : `${row.relative_path.slice(0, slash)}/${baseName}`;

  if (newRelativePath === row.relative_path) {
    return getDocument(params.documentId, params.actorVisitorId);
  }

  const existing = findDocumentByPath(db, row.domain_id, newRelativePath);
  if (existing && existing.document_id !== row.document_id) {
    throw new DocumentError("DOC_EXISTS", "目标位置已存在同名文档", 409);
  }

  const now = new Date().toISOString();
  const oldPath = row.relative_path;

  try {
    renameDocumentFile(row.domain_id, oldPath, newRelativePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DocumentError("STORAGE_ERROR", msg, 500);
  }

  try {
    const tx = db.transaction(() => {
      updateDocumentLocation(db, {
        documentId: row.document_id,
        parentId: row.parent_id ?? null,
        relativePath: newRelativePath,
        updatedBy: params.actorVisitorId,
        updatedAt: now,
      });
      insertAuditLog(db, {
        actorVisitorId: params.actorVisitorId,
        action: "document.rename",
        targetType: "document",
        targetId: row.document_id,
        metadata: {
          fromRelativePath: oldPath,
          toRelativePath: newRelativePath,
        },
        createdAt: now,
      });
    });
    tx();
  } catch (err) {
    try {
      renameDocumentFile(row.domain_id, newRelativePath, oldPath);
    } catch {
      // 回滚失败留给运维；主错误仍抛出
    }
    throw err;
  }

  scheduleFtsIfNeeded(row.file_type, row.document_id);

  return getDocument(params.documentId, params.actorVisitorId);
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

  // 选中目录时打开的是隐藏描述文件。类型现为 folder_desc，旧数据仍可能是 md。
  if (folder.file_type === FILE_TYPE.FOLDER_DESC || isFolderDescPath(folder.relative_path)) {
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
  const parentOfFolder = folder.parent_id;
  const domainId = folder.domain_id;

  const tx = db.transaction(() => {
    for (const doc of allToDelete) {
      const recovery = buildDeleteRecovery(db, doc);
      deleteDocument(db, doc.document_id);
      deletedIds.push(doc.document_id);
      insertAuditLog(db, {
        actorVisitorId: params.actorVisitorId,
        action: doc.file_type === "dir" ? "folder.delete" : "document.delete",
        targetType: doc.file_type === "dir" ? "folder" : "document",
        targetId: doc.document_id,
        metadata: {
          relativePath: doc.relative_path,
          viaFolderDelete: true,
          recovery,
        },
        createdAt: now,
      });
    }
  });
  tx();

  // 磁盘：有文件就删（dir / graph_dir 通常无独立文件，exists 检查后 noop）
  for (const doc of allToDelete) {
    try {
      deleteDocumentFile(doc.domain_id, doc.relative_path);
    } catch {
      // 盘上可能已不存在
    }
    // 始终清 FTS + 语义（非索引类型也是安全 no-op）
    removeIndex(doc.document_id);
  }

  scheduleGraphLifecycle(() =>
    onFolderDeleted({ domainId, parentId: parentOfFolder }),
  );

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
    throw new DocumentError("FORBIDDEN", "仅创建者可管理邀请", 403);
  }

  const domain = findDomainById(db, row.domain_id);

  if (domain && isDomainMember(db, domain.domain_id, targetVisitorId)) {
    throw new DocumentError(
      "BAD_REQUEST",
      "该访客已是工作空间成员，无需邀请；邀请与工作空间成员互斥",
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
    invitedEdit?: boolean;
    domainMemberWrite?: boolean;
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
    ...(overrides.invitedEdit ? { invitedEdit: true } : {}),
    ...(overrides.domainMemberWrite ? { domainMemberWrite: true } : {}),
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
 * 普通发布前的乐观锁：localBaseCommitId 与 head 不一致则冲突。
 * 未传 localBaseCommitId 时跳过（兼容尚未接入的前端）。
 */
function assertNoVersionConflict(
  db: ReturnType<typeof getDb>,
  row: DocumentRow,
  localBaseCommitId: string | undefined,
): void {
  // 客户端没传 localBase：旧版前端或未启用冲突检测，直接放行（不进行冲突校验）
  // 文档尚无 head：历史数据/异常态，无法比对，也放行
  if (!localBaseCommitId || !row.head_commit_id) return;

  // 客户端认为的「我基于的那一版」仍等于服务端当前 head → 无人插队，可 fast-forward 发布
  if (localBaseCommitId === row.head_commit_id) return;

  // 走到这里：localBase 有值且与 head 不同 → 说明在你编辑期间 head 已被别人/另一标签推进 → 409
  assertCommitBelongsToDocument(db, localBaseCommitId, row.document_id);
  const { content, contentHash } = readDocument(row.domain_id, row.relative_path);
  throwVersionConflict(row, content, contentHash);
}

/**
 * 合并发布（用户在浏览器合稿后，PUT version.merge）。
 *
 * 提交图（merge 完成后）示意：
 *
 *     localBaseCommitId（开编分叉点，version.localBaseCommitId）
 *      ├── remoteCommitId（冲突时远端 tip，version.merge.remoteCommitId）
 *      └── localCommitId（r_local，本次首次落库；父 = localBaseCommitId）
 *             \      /
 *              mergeCommitId（合成稿，新 head；父 = remoteCommitId + localCommitId）
 *
 * 步骤：
 * 1. 校验：remoteCommitId 仍为当前 head；localBase 是 remote 的祖先（assertMergeFork）
 * 2. 写盘：工作区 = 合成稿；commits 目录落 r_local / merge 快照（writeCommitBlob）
 * 3. 事务：插 r_local + merge 节点与边，更新 documents.head_commit_id
 */
function publishMergeDocument(params: {
  row: DocumentRow;
  actorVisitorId: string;
  content: string;
  displayName: string;
  permission?: number;
  localBaseCommitId: string;
  remoteCommitId: string;
  /** 已按 contentFormat 转换后的本地快照；未传则用 content */
  localSnapshotContent?: string;
  now: string;
  message: string;
  source: PublishSource;
}): DocumentDetail {
  const { row, actorVisitorId, content, displayName, now, message, source } = params;
  const db = getDb();

  // 如果row.head_commit_id为空大概率是因为旧客户文章没有commit_id, 不能走conflict merge逻辑
  if (!row.head_commit_id) {
    throw new DocumentError("BAD_REQUEST", "文档尚无提交历史，无法合并发布", 400);
  }
  // 合并过程中若 head 又被别人推进，同样 409
  if (params.remoteCommitId !== row.head_commit_id) {
    const { content: serverContent, contentHash } = readDocument(
      row.domain_id,
      row.relative_path,
    );
    throwVersionConflict(row, serverContent, contentHash);
  }

  assertCommitBelongsToDocument(db, params.localBaseCommitId, row.document_id);
  assertCommitBelongsToDocument(db, params.remoteCommitId, row.document_id);
  assertMergeFork(db, params.localBaseCommitId, params.remoteCommitId);

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
      message,
      source,
    });
    insertCommitParent(db, {
      childCommitId: localCommitId,
      parentCommitId: params.localBaseCommitId,
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
      message,
      source,
    });
    // merge node 拥有两个 parent, r_local 和 远端head
    // 这里存储的是远端head
    insertCommitParent(db, {
      childCommitId: mergeCommitId,
      parentCommitId: params.remoteCommitId,
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
        localBaseCommitId: params.localBaseCommitId,
        remoteCommitId: params.remoteCommitId,
        localCommitId,
        mergeCommitId,
      },
      createdAt: now,
    });
  });
  tx();

  scheduleFtsIfNeeded(row.file_type, row.document_id);

  scheduleGraphIfExtractable(row.file_type, () =>
    onArticlePublished({
      domainId: row.domain_id,
      documentId: row.document_id,
      parentId: row.parent_id,
    }),
  );

  // merge 发布同样采用“写后即返回最新资源”：
  // - 避免前端二次查询引入时序偏差；
  // - 确保 UI 使用服务端合并后的最终状态作为唯一真相。
  const invitedEdit = resolveInvitedEditFlag(db, row, actorVisitorId);
  const domainMemberWrite = resolveDomainMemberWriteFlag(db, row, actorVisitorId);
  return buildDocumentDetail(row, {
    displayName,
    content,
    contentHash: write.contentHash,
    updatedBy: actorVisitorId,
    updatedAt: now,
    permission:
      params.permission !== undefined ? params.permission : row.permission,
    headCommitId: mergeCommitId,
    invitedEdit,
    domainMemberWrite,
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

function resolveInvitedEditFlag(
  db: ReturnType<typeof getDb>,
  row: DocumentRow,
  actorVisitorId: string,
): boolean {
  if (row.owner_visitor_id === actorVisitorId) return false;
  const invite = findDocumentInvite(db, row.document_id, actorVisitorId);
  return invite?.permission === "edit";
}

function resolveDomainMemberWriteFlag(
  db: ReturnType<typeof getDb>,
  row: DocumentRow,
  actorVisitorId: string,
): boolean {
  if (row.owner_visitor_id === actorVisitorId) return false;
  return getDomainMemberRole(db, row.domain_id, actorVisitorId) === "write";
}

// ============================================================
//  同步状态（轻量轮询，不返回正文）
// ============================================================

/**
 * 比较客户端 localBaseCommitId 与服务端 head（remoteCommitId），用于 Sync 指示。
 * - up_to_date：localBase 未传、无 head、或 localBase === head
 * - behind：localBase 是 head 的祖先（远端有更新）
 * - ahead：其余（含分叉、历史回退等）
 */
export function getDocumentSyncStatus(
  documentId: string,
  localBaseCommitId: string | undefined,
): DocumentSyncStatus {
  const row = findDocumentById(getDb(), documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);
  const head = row.head_commit_id;
  if (!localBaseCommitId || !head) {
    return { status: "up_to_date", headCommitId: head };
  }
  if (localBaseCommitId === head) {
    return { status: "up_to_date", headCommitId: head };
  }
  const db = getDb();
  if (isAncestorOf(db, localBaseCommitId, head)) {
    return { status: "behind", headCommitId: head };
  }
  return { status: "ahead", headCommitId: head };
}

/**
 * 为 merge UI 提供 LCA 正文：根据 localBase / remote 在 DAG 上求 mergeBase，读取 blob。
 * 无法求 LCA 或读 blob 失败时返回 two_way（前端可退化为开编快照或两方 diff）。
 */
export function getDocumentMergeContext(
  documentId: string,
  localBaseCommitId: string,
  remoteCommitId: string,
): DocumentMergeContext {
  const row = findDocumentById(getDb(), documentId);
  if (!row) throw new DocumentError("DOC_NOT_FOUND", "文档不存在", 404);

  const db = getDb();
  assertCommitBelongsToDocument(db, localBaseCommitId, documentId);
  assertCommitBelongsToDocument(db, remoteCommitId, documentId);

  let mergeBaseCommitId: string;
  try {
    mergeBaseCommitId = findMergeBaseCommitId(db, localBaseCommitId, remoteCommitId);
  } catch {
    return { mode: "two_way", mergeBaseCommitId: null, mergeBaseContent: null };
  }

  const baseCommit = findCommitById(db, mergeBaseCommitId);
  if (!baseCommit) {
    return { mode: "two_way", mergeBaseCommitId: null, mergeBaseContent: null };
  }

  try {
    const mergeBaseContent = readCommitBlob(baseCommit.blob_ref);
    return { mode: "three_way", mergeBaseCommitId, mergeBaseContent };
  } catch {
    return { mode: "two_way", mergeBaseCommitId: null, mergeBaseContent: null };
  }
}

/** 内容格式转换（merge 发布：markdown → Lexical）。 */
export function convertDocumentContent(params: {
  content: string;
  from: "markdown" | "lexical";
  to: "markdown" | "lexical";
}): string {
  if (params.from === params.to) return params.content;
  if (params.from === "markdown" && params.to === "lexical") {
    return markdownToLexicalJson(params.content);
  }
  if (params.from === "lexical" && params.to === "markdown") {
    return lexicalJsonToMarkdown(params.content);
  }
  throw new DocumentError("BAD_REQUEST", "unsupported conversion", 400);
}
