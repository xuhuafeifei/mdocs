/**
 * 后端 API 端点封装
 * 按业务领域分类导出所有与后端交互的函数：
 * - 访客：注册、获取当前身份
 * - 域：增删改查、成员管理、权限设置
 * - 文档树：获取目录结构
 * - 文档：创建、读取、更新、删除、邀请管理
 * - 资源：文件上传
 * - 成员模板：批量管理受限域成员
 */
import { api, ApiRequestError, isDemoMode } from "./client";
import type {
  DocumentDetail,
  DocumentMergeContext,
  DocumentSyncStatus,
  PublishVersionContext,
} from "../../shared/types/document";
import type {
  VisitorDirectoryEntry,
  VisitorMeResponse,
  VisitorPublic,
  VisitorRecoverResponse,
  VisitorRegisterResponse,
} from "../../shared/types/visitor";
import type { TreeNode } from "../../shared/types/tree";
import type { DomainSummary, DomainMemberListEntry } from "../../shared/types/domain";
import type { DomainMemberTemplate } from "../../shared/types/domainMemberTemplate";

/**
 * 访客注册：创建新访客并返回身份令牌和恢复码。
 */
export function registerVisitorApi(
  visitorName: string,
  password?: string,
): Promise<VisitorRegisterResponse> {
  return api<VisitorRegisterResponse>("/api/visitors/register", {
    method: "POST",
    body: JSON.stringify({ visitorName, password }),
  });
}

/**
 * 使用恢复码找回访客身份（无需已有 Token）。
 * 返回新的身份令牌，旧 Token 失效。
 */
export function recoverVisitorApi(recoveryCode: string): Promise<VisitorRecoverResponse> {
  return api<VisitorRecoverResponse>("/api/visitors/recover", {
    method: "POST",
    body: JSON.stringify({ recoveryCode }),
  });
}

/**
 * 使用用户名+密码登录。
 */
export function loginWithPasswordApi(
  visitorName: string,
  password: string,
): Promise<VisitorRecoverResponse> {
  return api<VisitorRecoverResponse>("/api/visitors/login", {
    method: "POST",
    body: JSON.stringify({ visitorName, password }),
  });
}

/**
 * 为当前访客设置密码。
 */
export function setPasswordApi(password: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>("/api/visitors/set-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

/**
 * 为当前已登录访客生成新的恢复码（覆盖旧的）。
 */
export function generateRecoveryCodeApi(): Promise<{ recoveryCode: string }> {
  return api<{ recoveryCode: string }>("/api/visitors/recovery-code", {
    method: "POST",
  });
}

/**
 * 获取当前登录访客的基本信息。
 */
export async function fetchMe(): Promise<VisitorPublic> {
  const res = await api<VisitorMeResponse>("/api/visitors/me");
  return res.visitor;
}

/**
 * 获取活跃访客目录（用于成员选择弹窗）。
 */
export function fetchVisitorsDirectoryApi(): Promise<VisitorDirectoryEntry[]> {
  return api<{ visitors: VisitorDirectoryEntry[] }>("/api/visitors").then((d) => d.visitors);
}

/**
 * 获取当前访客可访问的所有域列表。
 */
export function fetchDomainsApi(): Promise<DomainSummary[]> {
  return api<DomainSummary[]>("/api/domains");
}

/**
 * 创建新域。
 */
export function createDomainApi(input: {
  domainName: string;
  permission: string;
}): Promise<DomainSummary> {
  return api<DomainSummary>("/api/domains", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * 重命名指定域。
 */
export function renameDomainApi(domainId: string, domainName: string): Promise<void> {
  return api<void>(`/api/domains/${encodeURIComponent(domainId)}`, {
    method: "PUT",
    body: JSON.stringify({ domainName }),
  });
}

/**
 * 修改域的访问权限（public / restricted / private）。
 */
export function updateDomainPermissionApi(domainId: string, permission: string): Promise<void> {
  return api<void>(`/api/domains/${encodeURIComponent(domainId)}/permission`, {
    method: "PUT",
    body: JSON.stringify({ permission }),
  });
}

/**
 * 删除域及其下的所有文档。
 */
export function deleteDomainApi(domainId: string): Promise<void> {
  return api<void>(`/api/domains/${encodeURIComponent(domainId)}`, {
    method: "DELETE",
  });
}

/**
 * 获取受限域的成员列表（含正常/已停用/已删除状态）。
 */
export function fetchDomainMembersApi(domainId: string): Promise<DomainMemberListEntry[]> {
  return api<{ members: DomainMemberListEntry[] }>(
    `/api/domains/${encodeURIComponent(domainId)}/members`,
  ).then((d) => d.members);
}

/**
 * 批量设置受限域的成员（覆盖式）。
 */
export function putDomainMembersApi(domainId: string, visitorIds: string[]): Promise<{ memberCount: number }> {
  return api<{ memberCount: number }>(`/api/domains/${encodeURIComponent(domainId)}/members`, {
    method: "PUT",
    body: JSON.stringify({ visitorIds }),
  });
}

/**
 * 获取所有成员模板列表。
 */
export function fetchDomainMemberTemplatesApi(): Promise<DomainMemberTemplate[]> {
  return api<DomainMemberTemplate[]>("/api/domain-member-templates");
}

/**
 * 创建成员模板。
 */
export function createDomainMemberTemplateApi(input: {
  displayName: string;
  visitorIds: string[];
}): Promise<DomainMemberTemplate> {
  return api<DomainMemberTemplate>("/api/domain-member-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * 更新成员模板。
 */
export function updateDomainMemberTemplateApi(
  id: number,
  input: { displayName: string; visitorIds: string[] },
): Promise<DomainMemberTemplate> {
  return api<DomainMemberTemplate>(`/api/domain-member-templates/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/**
 * 删除成员模板。
 */
export function deleteDomainMemberTemplateApi(id: number): Promise<void> {
  return api<void>(`/api/domain-member-templates/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}

/**
 * 获取指定域的文档树结构。
 */
export function fetchTreeApi(domainId?: string): Promise<TreeNode[]> {
  const q = domainId?.trim() ? `?domainId=${encodeURIComponent(domainId.trim())}` : "";
  return api<TreeNode[]>(`/api/tree${q}`);
}

/**
 * 获取单篇文档的完整内容（含权限、路径等元数据）。
 */
export function getDocumentApi(documentId: string): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/api/documents/${encodeURIComponent(documentId)}`);
}

/**
 * 创建新文档。
 */
export function createDocumentApi(input: {
  fileName: string;
  displayName?: string;
  content: string;
  domainId?: string;
  permission?: number;
  parentId?: string;
}): Promise<DocumentDetail> {
  return api<DocumentDetail>("/api/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * 更新文档内容或元数据（即发布）。
 */
export function updateDocumentApi(
  documentId: string,
  input: {
    content: string;
    displayName?: string;
    permission?: number;
    contentFormat?: "markdown" | "lexical";
    version?: PublishVersionContext;
  },
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function getDocumentSyncStatusApi(
  documentId: string,
  localBaseCommitId?: string,
): Promise<DocumentSyncStatus> {
  const q = localBaseCommitId
    ? `?localBaseCommitId=${encodeURIComponent(localBaseCommitId)}`
    : "";
  return api(`/api/documents/${encodeURIComponent(documentId)}/sync-status${q}`);
}

export function getDocumentMergeContextApi(
  documentId: string,
  localBaseCommitId: string,
  remoteCommitId: string,
): Promise<DocumentMergeContext> {
  const params = new URLSearchParams({
    localBaseCommitId,
    remoteCommitId,
  });
  return api(
    `/api/documents/${encodeURIComponent(documentId)}/merge-context?${params}`,
  );
}

export function convertContentApi(input: {
  content: string;
  from: "lexical" | "markdown";
  to: "lexical" | "markdown";
}): Promise<{ content: string }> {
  return api<{ content: string }>("/api/documents/convert", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * 删除指定文档。
 */
export function deleteDocumentApi(documentId: string): Promise<void> {
  return api<void>(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
}

/**
 * 获取文档的协作者邀请列表。
 */
export function getDocumentInvitesApi(documentId: string): Promise<{ visitorId: string; permission: string }[]> {
  return api<{ visitorId: string; permission: string }[]>(`/api/documents/${encodeURIComponent(documentId)}/invites`);
}

/**
 * 为文档添加协作者邀请。
 */
export function addDocumentInviteApi(
  documentId: string,
  targetVisitorId: string,
  targetPermission: string,
): Promise<void> {
  return api<void>(`/api/documents/${encodeURIComponent(documentId)}/invites`, {
    method: "POST",
    body: JSON.stringify({ targetVisitorId, targetPermission }),
  });
}

/**
 * 移除文档的某个协作者邀请。
 */
export function removeDocumentInviteApi(documentId: string, targetVisitorId: string): Promise<void> {
  return api<void>(`/api/documents/${encodeURIComponent(documentId)}/invites/${encodeURIComponent(targetVisitorId)}`, {
    method: "DELETE",
  });
}

/**
 * 上传文件到服务器资源存储。
 * 使用原生 fetch（而非 `api()`），因为 FormData 不能带 `Content-Type: application/json`。
 * 返回首个上传文件的服务器 URL。
 * Demo Mode 下返回 Data URL。
 */
export async function uploadAssetApi(file: File, documentId: string): Promise<string> {
  // Demo Mode 下将文件转为 Data URL
  if (isDemoMode()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  // 构建 FormData，包含文件和文档 ID
  const formData = new FormData();
  formData.append("file[]", file);
  formData.append("documentId", documentId);

  // 手动构建请求头，不添加 Content-Type
  //（浏览器会自动为 FormData 设置正确的 multipart/form-data）
  const headers = new Headers();

  const res = await fetch("/api/assets/upload", {
    method: "POST",
    headers,
    body: formData,
  });

  const body: unknown = await res.json();
  if (!res.ok) {
    const err = (body as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiRequestError(res.status, err?.code ?? "UNKNOWN", err?.message ?? "upload failed");
  }

  /**
   * 提取上传成功后的文件 URL 并返回。
   */
  const succMap = (body as { data: { succMap: Record<string, string> } }).data.succMap;
  const urls = Object.values(succMap);
  if (urls.length === 0) throw new Error("upload succeeded but no URL returned");
  return urls[0]!;
}

/**
 * 创建目录。
 */
export function createFolderApi(input: {
  name: string;
  parentId?: string;
  domainId?: string;
  description?: string;
}): Promise<{ folderId: string; path: string }> {
  return api<{ folderId: string; path: string }>("/api/folders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * 删除目录及其下所有内容（递归删除）。
 */
export function deleteFolderApi(folderDocumentId: string): Promise<{ deletedCount: number }> {
  return api<{ deletedCount: number }>(`/api/documents/folder/${encodeURIComponent(folderDocumentId)}`, {
    method: "DELETE",
  });
}

/**
 * 创建 CLI Token。
 * 创建前会自动吊销该访客的所有已有 Token。
 */
export function createCliTokenApi(input?: {
  name?: string;
}): Promise<{ tokenId: string; token: string; name: string; createdAt: string }> {
  return api<{ tokenId: string; token: string; name: string; createdAt: string }>("/api/cli/tokens", {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
}

/**
 * 列出当前访客的所有 CLI Token（含已吊销的）。
 */
export function listCliTokensApi(): Promise<{
  tokenId: string;
  name: string;
  revoked: boolean;
  createdAt: string;
}[]> {
  return api<{ tokenId: string; name: string; revoked: boolean; createdAt: string }[]>("/api/cli/tokens");
}

/**
 * 吊销指定的 CLI Token。
 */
export function revokeCliTokenApi(tokenId: string): Promise<void> {
  return api<void>(`/api/cli/tokens/${encodeURIComponent(tokenId)}`, {
    method: "DELETE",
  });
}

/** 搜索结果条目 */
export interface SearchResult {
  documentId: string;
  displayName: string;
  relativePath: string;
  domainId: string;
  snippet: string;
  bm25Score: number;
}

/**
 * 全文检索文档。
 */
export function searchDocumentsApi(input: {
  query: string;
  domainId?: string;
  topN?: number;
}): Promise<SearchResult[]> {
  return api<SearchResult[]>("/api/documents/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ========== 书签/收藏 ==========

/** 收藏的文档条目 */
export interface Bookmark {
  documentId: string;
  domainId: string | null;
  relativePath: string | null;
  displayName: string | null;
  ownerVisitorId: string | null;
  ownerVisitorName: string | null;
  permission: number | null;
  createdAt: string | null;
  bookmarkedAt: string;
  isDeleted: boolean;
}

/**
 * 获取当前访客的所有收藏列表。
 */
export function fetchBookmarksApi(): Promise<Bookmark[]> {
  return api<Bookmark[]>("/api/bookmarks");
}

/**
 * 检查是否已收藏某文档。
 */
export function checkBookmarkApi(documentId: string): Promise<{ bookmarked: boolean }> {
  return api<{ bookmarked: boolean }>(`/api/bookmarks/${encodeURIComponent(documentId)}`);
}

/**
 * 添加收藏。
 */
export function addBookmarkApi(documentId: string): Promise<void> {
  return api<void>(`/api/bookmarks/${encodeURIComponent(documentId)}`, {
    method: "POST",
  });
}

/**
 * 取消收藏。
 */
export function removeBookmarkApi(documentId: string): Promise<void> {
  return api<void>(`/api/bookmarks/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
}

// ========== 我的文章 ==========

/** 我的文档条目 */
export interface MyDocument {
  documentId: string;
  domainId: string;
  relativePath: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  permission: number;
}

/**
 * 获取当前访客创建的所有文档。
 */
export function fetchMyDocumentsApi(): Promise<MyDocument[]> {
  return api<MyDocument[]>("/api/visitors/me/documents");
}

// ========== 评论 ==========

/** 文档评论条目 */
export interface CommentEntry {
  commentId: string;
  documentId: string;
  visitorId: string;
  visitorName: string;
  parentId: string | null;
  replyToVisitorId: string | null;
  replyToVisitorName: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
}

/**
 * 获取文档评论列表。
 */
export function fetchCommentsApi(documentId: string): Promise<{ comments: CommentEntry[]; total: number }> {
  return api<{ comments: CommentEntry[]; total: number }>(
    `/api/documents/${encodeURIComponent(documentId)}/comments`,
  );
}

/**
 * 发表评论。
 */
export function createCommentApi(documentId: string, input: {
  content: string;
  parentId: string | null;
  replyToVisitorId: string | null;
  replyToVisitorName: string | null;
}): Promise<CommentEntry> {
  return api<CommentEntry>(`/api/documents/${encodeURIComponent(documentId)}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * 删除评论。
 */
export function deleteCommentApi(documentId: string, commentId: string): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(
    `/api/documents/${encodeURIComponent(documentId)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE" },
  );
}
