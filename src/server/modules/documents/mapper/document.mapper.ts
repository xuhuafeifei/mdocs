/**
 * documents 聚合映射：进参/事实 → 落库行；表行 → 对外形状。
 * 对照 document-comment / my-document mapper；编排仍在 document.service（→ E3）。
 */
import type { PublishSource } from "../../../../shared/publish-meta.js";
import { isPublishSource } from "../../../../shared/publish-meta.js";
import type { DocumentDetail, DocumentSummary } from "../../../../shared/types/document.js";
import type { DocumentCommits } from "../entity/commit.entity.js";
import type { DocumentInvites, Documents } from "../entity/document.entity.js";

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

export type DocumentInvitePublic = {
  visitorId: string;
  permission: string;
};

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

/** Documents 行 → 列表摘要。 */
export function toDocumentSummary(row: Documents): DocumentSummary {
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

/**
 * 写后出参：以已落库/待落库的 Documents 行为准，只再补正文与可选旗标。
 * 编排侧不必再抄一遍 displayName / permission / head…
 */
export function toDocumentDetailAfterWrite(
  row: Documents,
  content: string,
  flags?: { invitedEdit?: boolean; domainMemberWrite?: boolean },
): DocumentDetail {
  if (!row.head_commit_id) {
    throw new Error("toDocumentDetailAfterWrite: head_commit_id required");
  }
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
    headCommitId: row.head_commit_id,
    content,
    contentHash: row.content_hash,
    invitedEdit: flags?.invitedEdit ? true : undefined,
    domainMemberWrite: flags?.domainMemberWrite ? true : undefined,
  };
}

/**
 * 组装 API DocumentDetail（行尚未反映最新写结果时用 overrides）。
 * 优先用 `toDocumentDetailAfterWrite`。
 */
export function toDocumentDetail(
  row: Documents,
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
  return toDocumentDetailAfterWrite(
    {
      ...row,
      display_name: overrides.displayName,
      content_hash: overrides.contentHash,
      updated_by: overrides.updatedBy,
      updated_at: overrides.updatedAt,
      permission: overrides.permission,
      head_commit_id: overrides.headCommitId,
    },
    overrides.content,
    {
      invitedEdit: overrides.invitedEdit,
      domainMemberWrite: overrides.domainMemberWrite,
    },
  );
}

/**
 * 创建文档：create 的 params + 编排算好的事实 → documents 插入行。
 * owner/created_by/updated_by、parent_id、is_dirty、双时间戳由本函数填。
 */
export function toDocumentsForCreate(
  params: { actorVisitorId: string; parentId?: string | null },
  facts: {
    documentId: string;
    domainId: string;
    relativePath: string;
    displayName: string;
    contentHash: string;
    headCommitId: string;
    permission: number;
    fileType: string;
    now: string;
  },
): Documents {
  return {
    document_id: facts.documentId,
    domain_id: facts.domainId,
    relative_path: facts.relativePath,
    display_name: facts.displayName,
    owner_visitor_id: params.actorVisitorId,
    created_by: params.actorVisitorId,
    updated_by: params.actorVisitorId,
    content_hash: facts.contentHash,
    head_commit_id: facts.headCommitId,
    created_at: facts.now,
    updated_at: facts.now,
    permission: facts.permission,
    file_type: facts.fileType,
    parent_id: params.parentId ?? null,
    is_dirty: 1,
  };
}

/**
 * 从审计恢复：params + recovery + 编排少量事实 → documents 插入行。
 * displayName/owner/permission/fileType/双时间戳等从 recovery 拆；updated_by 用 params.actor。
 */
export function toDocumentsForRestore(
  params: { actorVisitorId: string },
  recovery: DocumentDeleteRecovery,
  facts: {
    documentId: string;
    relativePath: string;
    contentHash: string;
    parentId: string | null;
    now: string;
  },
): Documents {
  return {
    document_id: facts.documentId,
    domain_id: recovery.domainId,
    relative_path: facts.relativePath,
    display_name: recovery.displayName,
    owner_visitor_id: recovery.ownerVisitorId,
    created_by: recovery.createdBy,
    updated_by: params.actorVisitorId,
    content_hash: facts.contentHash,
    head_commit_id: recovery.headCommitId,
    created_at: recovery.createdAt,
    updated_at: facts.now,
    permission: recovery.permission,
    file_type: recovery.fileType,
    parent_id: facts.parentId,
    is_dirty: 1,
  };
}

/**
 * 恢复首版 commit：从 recovery 拆 head/blob/作者/时间，只再补 documentId + 写盘 hash。
 */
export function toDocumentCommitsForRestore(
  recovery: DocumentDeleteRecovery,
  facts: { documentId: string; contentHash: string },
): DocumentCommits {
  return {
    commit_id: recovery.headCommitId!,
    document_id: facts.documentId,
    content_hash: facts.contentHash,
    blob_ref: recovery.blobRef!,
    author_visitor_id: recovery.ownerVisitorId,
    created_at: recovery.updatedAt,
    message: "",
    source: "manual",
  };
}

/**
 * 创建首版 / 普通发布：params.actor + 事实 → document_commits 行。
 * message/source 默认空与 manual。
 */
export function toDocumentCommitsRow(input: {
  commitId: string;
  documentId: string;
  contentHash: string;
  blobRef: string;
  actorVisitorId: string;
  createdAt: string;
  message?: string;
  source?: PublishSource;
}): DocumentCommits {
  return {
    commit_id: input.commitId,
    document_id: input.documentId,
    content_hash: input.contentHash,
    blob_ref: input.blobRef,
    author_visitor_id: input.actorVisitorId,
    created_at: input.createdAt,
    message: input.message ?? "",
    source: input.source ?? "manual",
  };
}

/** 邀请进参 → document_invites 行。 */
export function toDocumentInvitesRow(input: {
  documentId: string;
  visitorId: string;
  permission: string;
}): DocumentInvites {
  return {
    document_id: input.documentId,
    visitor_id: input.visitorId,
    permission: input.permission,
  };
}

/** document_invites 行 → 对外邀请项。 */
export function toDocumentInvitePublic(row: DocumentInvites): DocumentInvitePublic {
  return {
    visitorId: row.visitor_id,
    permission: row.permission,
  };
}

function commitSourceOf(source: string | null | undefined): PublishSource {
  return isPublishSource(source) ? source : "manual";
}

/** commit 行 + 作者名 / head → 版本摘要。 */
export function toDocumentCommitSummary(
  commit: DocumentCommits,
  opts: { headCommitId: string | null; authorVisitorName: string | null },
): DocumentCommitSummary {
  return {
    commitId: commit.commit_id,
    createdAt: commit.created_at,
    authorVisitorId: commit.author_visitor_id,
    authorVisitorName: opts.authorVisitorName,
    contentHash: commit.content_hash,
    isHead: opts.headCommitId != null && commit.commit_id === opts.headCommitId,
    message: commit.message ?? "",
    source: commitSourceOf(commit.source),
  };
}

/** 版本摘要 + 正文 → 版本详情。 */
export function toDocumentCommitDetail(
  commit: DocumentCommits,
  opts: {
    headCommitId: string | null;
    authorVisitorName: string | null;
    content: string;
  },
): DocumentCommitDetail {
  return {
    ...toDocumentCommitSummary(commit, opts),
    content: opts.content,
  };
}
