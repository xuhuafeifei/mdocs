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
import type { TreeNode, FolderSubtreeNode } from "../../shared/types/tree";
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
export type ServerSettings = {
  maxUploadBytes: number;
  minUploadBytes: number;
  maxUploadBytesCap: number;
  defaultUploadBytes: number;
};

export function fetchServerSettingsApi(): Promise<ServerSettings> {
  return api<ServerSettings>("/api/server-settings");
}

export function updateServerSettingsApi(maxUploadBytes: number): Promise<ServerSettings> {
  return api<ServerSettings>("/api/server-settings", {
    method: "PUT",
    body: JSON.stringify({ maxUploadBytes }),
  });
}

export type McpServerConfig = {
  id: string;
  name: string;
  enabled: boolean;
  transport: "http" | "stdio";
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
};

export type McpServersPayload = {
  servers: McpServerConfig[];
};

export type McpToolSummary = {
  name: string;
  description?: string;
};

export function fetchMcpServersApi(): Promise<McpServersPayload> {
  return api<McpServersPayload>("/api/mcp-servers");
}

export function saveMcpServersApi(
  servers: McpServerConfig[],
): Promise<McpServersPayload> {
  return api<McpServersPayload>("/api/mcp-servers", {
    method: "PUT",
    body: JSON.stringify({ servers }),
  });
}

export function testMcpServerApi(
  id: string,
): Promise<{ ok: true; tools: McpToolSummary[] }> {
  return api<{ ok: true; tools: McpToolSummary[] }>(
    `/api/mcp-servers/${encodeURIComponent(id)}/test`,
    { method: "POST", body: "{}" },
  );
}

export type PluginInstallLog = {
  ts: string;
  event: string;
  level: "info" | "warn" | "error";
  data?: { line?: string; phase?: string };
};

export type PluginInstallJob = {
  pluginId: string;
  phase: "npm" | "init" | "start" | "health" | "saving" | "done" | "error";
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  logs?: PluginInstallLog[];
};

export type PluginListItem = {
  id: string;
  name: string;
  description: string;
  kind: "mcp";
  mcpServerId: string;
  installed: boolean;
  installedAt: string | null;
  runtimeRunning?: boolean;
  installJob?: PluginInstallJob | null;
  mcpServer: McpServerConfig | null;
  mcpTemplate: Omit<McpServerConfig, "id">;
};

export function fetchPluginsApi(): Promise<{ plugins: PluginListItem[] }> {
  return api<{ plugins: PluginListItem[] }>("/api/plugins");
}

export function installPluginApi(
  id: string,
  body?: { headers?: Record<string, string> },
): Promise<{ job: PluginInstallJob }> {
  return api<{ job: PluginInstallJob }>(
    `/api/plugins/${encodeURIComponent(id)}/install`,
    {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    },
  );
}

export function uninstallPluginApi(
  id: string,
): Promise<{ plugin: PluginListItem }> {
  return api<{ plugin: PluginListItem }>(
    `/api/plugins/${encodeURIComponent(id)}/uninstall`,
    { method: "POST", body: "{}" },
  );
}

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
 * 批量设置受限域的成员（覆盖式，含 read/write 角色）。
 */
export function putDomainMembersApi(
  domainId: string,
  members: Array<{ visitorId: string; role: "read" | "write" }>,
): Promise<{ memberCount: number }> {
  return api<{ memberCount: number }>(`/api/domains/${encodeURIComponent(domainId)}/members`, {
    method: "PUT",
    body: JSON.stringify({ members }),
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
 * 获取指定目录下的精简嵌套子树（type + id + title）。
 */
export function fetchFolderSubtreeApi(folderId: string): Promise<FolderSubtreeNode[]> {
  return api<FolderSubtreeNode[]>(
    `/api/documents/folder/${encodeURIComponent(folderId)}/tree`,
  );
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
  contentFormat?: "markdown" | "lexical";
  fileType?: string;
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
    message?: string;
    source?: "auto" | "manual" | "agent" | "cli";
  },
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** AI 根据相对最近非 auto 发布的 diff 建议 commit message。 */
export function suggestCommitMessageApi(
  documentId: string,
  input: { content: string; contentFormat?: "markdown" | "lexical" },
): Promise<{ message: string; baseCommitId: string | null }> {
  return api(`/api/documents/${encodeURIComponent(documentId)}/suggest-commit-message`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** AI 行级 merge：git 冲突 Markdown → 定稿 Markdown。 */
export function suggestMergeResolutionsApi(
  documentId: string,
  input: { conflictMarkdown: string },
): Promise<{ mergedMarkdown: string }> {
  return api(`/api/documents/${encodeURIComponent(documentId)}/suggest-merge-resolutions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** 合并发布说明：local / remote / merged → message。 */
export function suggestMergeMessageApi(
  documentId: string,
  input: {
    localContent: string;
    remoteContent: string;
    mergedContent: string;
    baseContent?: string;
    contentFormat?: "markdown" | "lexical" | "plain";
  },
): Promise<{ message: string }> {
  return api(`/api/documents/${encodeURIComponent(documentId)}/suggest-merge-message`, {
    method: "POST",
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
  return api(`/api/documents/${encodeURIComponent(documentId)}/sync-status${q}`, { silent: true });
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

/** 同域移动文档到目标文件夹；parentId=null 表示域根。仅 owner 成功。 */
export function moveDocumentApi(
  documentId: string,
  parentId: string | null,
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/api/documents/${encodeURIComponent(documentId)}/move`, {
    method: "POST",
    body: JSON.stringify({ parentId }),
  });
}

export type DocumentCommitSummary = {
  commitId: string;
  createdAt: string;
  authorVisitorId: string;
  authorVisitorName: string | null;
  contentHash: string;
  isHead: boolean;
  message: string;
  source: "auto" | "manual" | "agent" | "cli";
};

export type DocumentCommitDetail = DocumentCommitSummary & {
  content: string;
};

export function listDocumentCommitsApi(documentId: string): Promise<DocumentCommitSummary[]> {
  return api<DocumentCommitSummary[]>(
    `/api/documents/${encodeURIComponent(documentId)}/commits`,
  );
}

export function getDocumentCommitApi(
  documentId: string,
  commitId: string,
): Promise<DocumentCommitDetail> {
  return api<DocumentCommitDetail>(
    `/api/documents/${encodeURIComponent(documentId)}/commits/${encodeURIComponent(commitId)}`,
  );
}

/** 将历史版正文作为新 commit 发布。 */
export function restoreDocumentVersionApi(
  documentId: string,
  commitId: string,
): Promise<DocumentDetail> {
  return api<DocumentDetail>(
    `/api/documents/${encodeURIComponent(documentId)}/commits/${encodeURIComponent(commitId)}/restore`,
    { method: "POST", body: "{}" },
  );
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
  const vditor = body as { code?: number; msg?: string; data?: { succMap?: Record<string, string> } };
  if (!res.ok || vditor.code === 1) {
    const err = (body as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiRequestError(
      res.status,
      err?.code ?? "UPLOAD_FAILED",
      err?.message ?? vditor.msg ?? "upload failed",
    );
  }

  /**
   * 提取上传成功后的文件 URL 并返回。
   */
  const succMap = vditor.data?.succMap ?? {};
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

/** 停用或重新启用 CLI Token（软开关）。 */
export function setCliTokenRevokedApi(tokenId: string, revoked: boolean): Promise<void> {
  return api<void>(`/api/cli/tokens/${encodeURIComponent(tokenId)}`, {
    method: "PATCH",
    body: JSON.stringify({ revoked }),
  });
}

/**
 * 硬删除 CLI Token（不可恢复）。
 * @deprecated 旧名 revoke；语义已改为硬删。
 */
export function revokeCliTokenApi(tokenId: string): Promise<void> {
  return deleteCliTokenApi(tokenId);
}

/** 硬删除 CLI Token。 */
export function deleteCliTokenApi(tokenId: string): Promise<void> {
  return api<void>(`/api/cli/tokens/${encodeURIComponent(tokenId)}`, {
    method: "DELETE",
  });
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

export function listDeletedDocumentsApi(limit?: number): Promise<DeletedDocumentListItem[]> {
  const q = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : "";
  return api<DeletedDocumentListItem[]>(`/api/documents/deleted${q}`);
}

export function restoreDocumentApi(auditId: number): Promise<DocumentDetail> {
  return api<DocumentDetail>("/api/documents/restore", {
    method: "POST",
    body: JSON.stringify({ auditId }),
  });
}

/** 检索模式：auto = 混合（默认）；keyword = 仅关键词；semantic = 仅语义 */
export type SearchMode = "auto" | "keyword" | "semantic";

/** 搜索结果条目 */
export interface SearchResult {
  documentId: string;
  displayName: string;
  relativePath: string;
  domainId: string;
  snippet: string;
  bm25Score: number;
  ownerVisitorName: string;
  updatedAt: string;
  createdAt?: string;
  /** 命中来源明细（"凭什么定位到这篇"）：标题 / 正文 / 语义 */
  titleHit?: boolean;
  bodyHit?: boolean;
  semanticHit?: boolean;
}

/** 搜索响应（含语义模型可用性与查询分词，用于未就绪提示与命中高亮） */
export interface SearchResponse {
  results: SearchResult[];
  modelReady: boolean;
  /** 查询分词（与服务端 FTS MATCH 同一套 jieba），供前端高亮 */
  tokens?: string[];
}

/**
 * 全文检索文档。
 */
export function searchDocumentsApi(input: {
  query: string;
  mode?: SearchMode;
  domainId?: string;
  topN?: number;
}): Promise<SearchResponse> {
  return api<SearchResponse>("/api/documents/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** 语义索引管理列表行 */
export interface EmbeddingIndexRow {
  documentId: string;
  displayName: string;
  relativePath: string;
  domainId: string;
  domainName: string;
  chunkCount: number;
  embeddingUpdatedAt: string | null;
  documentUpdatedAt: string;
}

export function fetchEmbeddingIndexApi(input?: {
  domainId?: string;
}): Promise<{ modelReady: boolean; items: EmbeddingIndexRow[] }> {
  const qs = input?.domainId ? `?domainId=${encodeURIComponent(input.domainId)}` : "";
  return api<{ modelReady: boolean; items: EmbeddingIndexRow[] }>(`/api/documents/embedding-index${qs}`);
}

export function rebuildEmbeddingIndexApi(documentIds: string[]): Promise<{
  modelReady: boolean;
  ok: string[];
  skipped: string[];
  failed: Array<{ documentId: string; reason: string }>;
}> {
  return api("/api/documents/embedding-rebuild", {
    method: "POST",
    body: JSON.stringify({ documentIds }),
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
  fileType?: string;
  creatorVisitorId?: string;
  creatorName?: string;
}

/** 分页查询结果 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  groups?: { key: string; items: T[] }[];
}

export interface MyDocumentsQuery {
  offset?: number;
  limit?: number;
  domainId?: string;
  creatorVisitorId?: string;
  /** md | html | sheet；不传则不限类型 */
  fileType?: string;
  groupBy?: "domain" | "creator";
}

/**
 * 获取当前访客创建的所有文档，支持分页。
 * @param offset - 偏移量，默认 0
 * @param limit - 每页条数，默认 20，最大 100
 */
export function fetchMyDocumentsApi(query: MyDocumentsQuery = {}): Promise<PaginatedResult<MyDocument>> {
  const params = new URLSearchParams({
    offset: String(query.offset ?? 0),
    limit: String(query.limit ?? 20),
  });
  if (query.domainId) params.set("domainId", query.domainId);
  if (query.creatorVisitorId) params.set("creatorVisitorId", query.creatorVisitorId);
  if (query.fileType) params.set("fileType", query.fileType);
  if (query.groupBy) params.set("groupBy", query.groupBy);
  return api<PaginatedResult<MyDocument>>(`/api/visitors/me/documents?${params}`);
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

// ========== Agent model config ==========

export type AgentModelId = "deepseek-flash" | "deepseek-v4-pro";
export type AgentConfigKind = "deepseek" | "custom";
export type AgentApiType = "openai-completions" | "anthropic-messages";
export type AgentThinkingLevel = "off" | "low" | "high" | "max";

export interface AgentModelConfigPublic {
  id: string;
  kind: AgentConfigKind;
  providerId: string | null;
  name: string;
  modelId: string;
  baseUrl: string;
  apiType: AgentApiType;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  contextWindow: number;
  thinkingLevel: AgentThinkingLevel;
  /** 单轮后台运行超时（秒） */
  runTimeoutSeconds: number;
  isDefault: boolean;
}

export function fetchAgentConfigsApi(): Promise<AgentModelConfigPublic[]> {
  return api<AgentModelConfigPublic[]>("/api/agent/configs");
}

export function fetchAgentConfigApi(): Promise<AgentModelConfigPublic | null> {
  return api<AgentModelConfigPublic | null>("/api/agent/config");
}

export function saveAgentConfigApi(input: {
  id?: string;
  isDefault?: boolean;
  kind?: AgentConfigKind;
  modelId?: string;
  name?: string;
  apiKey?: string;
  contextWindow?: number;
  thinkingLevel?: AgentThinkingLevel;
  runTimeoutSeconds?: number;
  providerId?: string;
  baseUrl?: string;
  apiType?: AgentApiType;
}): Promise<AgentModelConfigPublic> {
  return api<AgentModelConfigPublic>("/api/agent/config", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function setDefaultAgentConfigApi(configId: string): Promise<AgentModelConfigPublic> {
  return api<AgentModelConfigPublic>(`/api/agent/config/${encodeURIComponent(configId)}/default`, {
    method: "POST",
  });
}

export function deleteAgentConfigApi(configId: string): Promise<{ ok: true }> {
  return api<{ ok: true }>(`/api/agent/config/${encodeURIComponent(configId)}`, {
    method: "DELETE",
  });
}

export interface AgentUserSkill {
  id: string;
  name: string;
  description: string;
  body: string;
  updatedAt: string;
}

export function fetchAgentUserSkillsApi(): Promise<AgentUserSkill[]> {
  return api<AgentUserSkill[]>("/api/agent/skills");
}

export function createAgentUserSkillApi(input: {
  name: string;
  description?: string;
  body: string;
}): Promise<AgentUserSkill> {
  return api<AgentUserSkill>("/api/agent/skills", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAgentUserSkillApi(
  id: string,
  input: { name: string; description?: string; body: string },
): Promise<AgentUserSkill> {
  return api<AgentUserSkill>(`/api/agent/skills/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAgentUserSkillApi(id: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/agent/skills/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export interface AgentStatus {
  enabled: boolean;
  skillsReady: boolean;
  model: string | null;
  configId?: string | null;
  reason?: string;
}

export type AgentStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "sources"; items: AgentSourceRef[] }
  | { type: "document_table"; title: string; rows: AgentDocumentTableRow[] }
  | {
      type: "document_card";
      documentId: string;
      title: string;
      path: string;
      preview: string;
    }
  | { type: "tool_notice"; toolName: string; text: string }
  | {
      type: "tool_call";
      toolCallId: string;
      toolName: string;
      label: string;
      status: "preparing" | "running" | "done" | "error";
      detail?: string;
      webResults?: {
        query: string;
        items: Array<{
          title: string;
          url: string;
          snippet: string;
          summary?: string;
          content?: string;
          siteName?: string | null;
          siteIcon?: string | null;
          date?: string | null;
        }>;
      };
    }
  | { type: "markdown_set"; markdown: string }
  | {
      type: "lexical_lines_set";
      documentId: string;
      mode: "patch_lines" | "replace_all";
      lines: Record<string, string>;
      markdown?: string;
    }
  | {
      type: "diff_slot_op";
      documentId: string;
      op: "update_slot" | "insert_after_slot" | "remove_slot" | "overwrite_all";
      slot?: number;
      markdown?: string;
    }
  | {
      type: "choice_card";
      requestId: string;
      title: string;
      options: string[];
      expiresAt: string;
    }
  | { type: "choice_expired"; requestId: string }
  | {
      type: "editor_draft_request";
      requestId: string;
      documentId: string;
      expiresAt: string;
    }
  | {
      type: "skill_form_card";
      requestId: string;
      mode: "create" | "update";
      title: string;
      currentName?: string;
      initialName: string;
      initialDescription: string;
      initialBody: string;
      expiresAt: string;
    }
  | { type: "skill_form_expired"; requestId: string }
  | {
      type: "open_coding";
      documentId: string;
      displayName: string;
    }
  | { type: "context_usage"; percent: number; used: number; limit: number }
  | { type: "context_compacting" }
  | { type: "context_compacted"; percent: number; used: number; limit: number }
  | { type: "tree_changed"; reason: string }
  /** AI 覆写文档成功，前端若打开该文档应拉取最新内容 */
  | {
      type: "document_overwritten";
      documentId: string;
      headCommitId: string;
    }
  | { type: "done" }
  | { type: "error"; message: string }
  | {
      type: "run_started";
      runId: string;
      sessionId: string;
      deadlineAt: string;
    };

export interface AgentSourceRef {
  id: string;
  name: string;
  url: string;
}

export interface AgentDocumentTableRow {
  documentId: string;
  title: string;
  summary: string;
}

export interface AgentContextUsage {
  percent: number;
  used: number;
  limit: number;
}

export function fetchAgentStatusApi(): Promise<AgentStatus> {
  return api<AgentStatus>("/api/agent/status");
}

export function fetchAgentContextUsageApi(): Promise<AgentContextUsage> {
  return api<AgentContextUsage>("/api/agent/context-usage");
}

export interface AgentSessionMessage {
  role: "user" | "assistant";
  content: string;
  skillNames?: string[];
  /** @deprecated */
  skillIds?: string[];
}

export type AgentRunStatus =
  | "running"
  | "waiting_user"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "interrupted";

export interface AgentRunPublic {
  runId: string;
  sessionId: string;
  status: AgentRunStatus;
  startedAt: string;
  deadlineAt: string;
  finishedAt?: string;
  lastSeq: number;
  abortReason?: string;
}

export interface AgentSessionResponse {
  sessionId: string;
  messages: AgentSessionMessage[];
  activeRun?: AgentRunPublic | null;
}

export interface AgentSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  domainId?: string | null;
  pinned?: boolean;
}

export interface AgentSessionListResponse {
  lastOpenedSessionId: string;
  sessions: AgentSessionSummary[];
}

export function fetchAgentSessionApi(
  mode: "normal" | "coding" = "normal",
  documentId?: string | null,
): Promise<AgentSessionResponse> {
  const params = new URLSearchParams();
  if (mode === "coding") {
    params.set("mode", "coding");
    if (documentId) params.set("documentId", documentId);
  }
  const q = params.toString();
  return api<AgentSessionResponse>(`/api/agent/session${q ? `?${q}` : ""}`);
}

export function fetchAgentSessionsApi(
  mode: "normal" | "coding" = "normal",
  documentId?: string | null,
): Promise<AgentSessionListResponse> {
  const params = new URLSearchParams();
  if (mode === "coding") {
    params.set("mode", "coding");
    if (documentId) params.set("documentId", documentId);
  }
  const q = params.toString();
  return api<AgentSessionListResponse>(`/api/agent/sessions${q ? `?${q}` : ""}`);
}

export function createAgentSessionApi(
  mode: "normal" | "coding" = "normal",
  documentId?: string | null,
  domainId?: string | null,
): Promise<AgentSessionResponse> {
  return api<AgentSessionResponse>("/api/agent/sessions", {
    method: "POST",
    body: JSON.stringify({
      mode,
      ...(mode === "coding" ? { documentId: documentId ?? null } : {}),
      ...(domainId ? { domainId } : {}),
    }),
  });
}

export function renameAgentSessionApi(
  sessionId: string,
  title: string,
  mode: "normal" | "coding" = "normal",
): Promise<AgentSessionSummary> {
  return api<AgentSessionSummary>("/api/agent/session/rename", {
    method: "POST",
    body: JSON.stringify({ sessionId, title, mode }),
  });
}

export function pinAgentSessionApi(
  sessionId: string,
  pinned: boolean,
  mode: "normal" | "coding" = "normal",
): Promise<AgentSessionSummary> {
  return api<AgentSessionSummary>("/api/agent/session/pin", {
    method: "POST",
    body: JSON.stringify({ sessionId, pinned, mode }),
  });
}

export function openAgentSessionApi(
  sessionId: string,
  mode: "normal" | "coding" = "normal",
  documentId?: string | null,
): Promise<AgentSessionResponse> {
  return api<AgentSessionResponse>("/api/agent/session/open", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      mode,
      ...(mode === "coding" ? { documentId: documentId ?? null } : {}),
    }),
  });
}

export type AgentSessionCompactResult = {
  compacted: boolean;
  reason?: "below_threshold" | "nothing_to_compact" | "llm_failed" | "missing_api_key";
  percent: number;
  used: number;
  limit: number;
  sessionId: string;
};

/** 主动压缩当前（或指定）session 上下文；不要求已到 85% */
export function compactAgentSessionApi(
  mode: "normal" | "coding" = "normal",
  opts?: { sessionId?: string; documentId?: string | null },
): Promise<AgentSessionCompactResult> {
  return api<AgentSessionCompactResult>("/api/agent/session/compact", {
    method: "POST",
    body: JSON.stringify({
      mode,
      ...(opts?.sessionId ? { sessionId: opts.sessionId } : {}),
      ...(mode === "coding" ? { documentId: opts?.documentId ?? null } : {}),
    }),
  });
}

/** 空白帮写写回成文后，把 coding session 绑到新 documentId */
export function bindCodingSessionDocumentApi(
  sessionId: string,
  documentId: string,
): Promise<{ sessionId: string; documentId: string }> {
  return api("/api/agent/session/bind-document", {
    method: "POST",
    body: JSON.stringify({ sessionId, documentId }),
  });
}

/** 解冻 ask_user_choice：choice 为用户点选或输入的内容字符串 */
export function submitAgentChoiceApi(
  requestId: string,
  choice: string,
): Promise<{ status: string; choice?: string }> {
  return api("/api/agent/choice", {
    method: "POST",
    body: JSON.stringify({ requestId, choice }),
  });
}

/** 前端静默回传 get_editor_draft（自动执行，无确认卡） */
export function submitAgentEditorDraftApi(
  body:
    | {
        requestId: string;
        status: "ok";
        documentId: string;
        content: string;
        contentFormat: "markdown" | "html" | "plain";
        source: "editor" | "indexeddb";
        localBaseCommitId?: string | null;
        displayName?: string;
      }
    | { requestId: string; status: "unavailable"; reason: string },
): Promise<{ status: string }> {
  return api("/api/agent/editor-draft", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** 前端倒计时结束：通知后端结束 pending（timeout） */
export function expireAgentChoiceApi(
  requestId: string,
): Promise<{ status: string }> {
  return api("/api/agent/choice", {
    method: "POST",
    body: JSON.stringify({ requestId, expire: true }),
  });
}

/** 用户主动取消选择卡 */
export function cancelAgentChoiceApi(
  requestId: string,
): Promise<{ status: string }> {
  return api("/api/agent/choice", {
    method: "POST",
    body: JSON.stringify({ requestId, cancel: true }),
  });
}

/** 解冻 create/update skill 表单 */
export function submitAgentSkillFormApi(
  requestId: string,
  fields: { name: string; description: string; body: string },
): Promise<{ status: string }> {
  return api("/api/agent/skill-form", {
    method: "POST",
    body: JSON.stringify({ requestId, ...fields }),
  });
}

/** 前端倒计时结束：通知后端结束 skill 表单 pending */
export function expireAgentSkillFormApi(
  requestId: string,
): Promise<{ status: string }> {
  return api("/api/agent/skill-form", {
    method: "POST",
    body: JSON.stringify({ requestId, expire: true }),
  });
}

/** 用户主动取消 skill 表单 */
export function cancelAgentSkillFormApi(
  requestId: string,
): Promise<{ status: string }> {
  return api("/api/agent/skill-form", {
    method: "POST",
    body: JSON.stringify({ requestId, cancel: true }),
  });
}

async function readAgentSseStream(
  res: Response,
  opts: {
    signal?: AbortSignal;
    onEvent: (event: AgentStreamEvent, seq?: number) => void;
  },
): Promise<void> {
  if (!res.body) throw new Error("empty response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      opts.onEvent(JSON.parse(payload) as AgentStreamEvent);
    } catch {
      /* skip malformed chunk */
    }
  };
  try {
    while (true) {
      if (opts.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) consumeLine(line);
    }
    if (buffer.trim()) consumeLine(buffer);
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
  }
}

export type AgentAttachmentUpload = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  status: string;
};

/** POST /api/agent/attachments — staging 上传 */
export async function uploadAgentAttachmentApi(
  sessionId: string,
  file: File,
): Promise<AgentAttachmentUpload> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sessionId", sessionId);
  const res = await fetch("/api/agent/attachments", {
    method: "POST",
    body: formData,
  });
  const body = (await res.json()) as {
    data?: AgentAttachmentUpload;
    error?: { message?: string };
  };
  if (!res.ok || !body.data) {
    throw new ApiRequestError(
      res.status,
      "UPLOAD_FAILED",
      body.error?.message ?? "upload failed",
    );
  }
  return body.data;
}

/** POST /api/agent/chat，解析 SSE；断开订阅不取消服务端 run */
export async function streamAgentChatApi(
  message: string,
  opts: {
    mode?: "normal" | "coding";
    /** 本轮引用的私人 skill 名称 */
    skillNames?: string[];
    /** @deprecated */
    skillIds?: string[];
    /** 本轮已上传的附件 id */
    assetIds?: string[];
    /** coding：帮写工作台当前稿 / 进场快照（放 body，不放 header） */
    documentId?: string | null;
    workingMarkdown?: string;
    baseMarkdown?: string;
    /** normal：当前 UI 域 / 打开文 / 图谱 */
    references?: {
      domainId?: string;
      documentId?: string;
      graphFileId?: string;
    };
    signal?: AbortSignal;
    onEvent: (event: AgentStreamEvent) => void;
  },
): Promise<void> {
  const body: Record<string, unknown> = {
    message,
    mode: opts.mode === "coding" ? "coding" : "normal",
  };
  if (opts.assetIds && opts.assetIds.length > 0) body.assetIds = opts.assetIds;
  const names =
    opts.skillNames && opts.skillNames.length > 0
      ? opts.skillNames
      : opts.skillIds && opts.skillIds.length > 0
        ? opts.skillIds
        : undefined;
  if (names) body.skillNames = names;
  if (opts.mode === "coding") {
    if (opts.documentId !== undefined) body.documentId = opts.documentId;
    if (typeof opts.workingMarkdown === "string") body.workingMarkdown = opts.workingMarkdown;
    if (typeof opts.baseMarkdown === "string") body.baseMarkdown = opts.baseMarkdown;
  } else if (opts.references) {
    body.references = opts.references;
  }
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    let messageText = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as {
        error?: { message?: string; code?: string };
      };
      if (errBody.error?.message) messageText = errBody.error.message;
      const code = errBody.error?.code;
      if (code === "RUN_ACTIVE" || code === "SESSION_COMPACTING") {
        const err = new Error(messageText) as Error & { code?: string };
        err.code = code;
        throw err;
      }
    } catch (e) {
      const code = e instanceof Error ? (e as Error & { code?: string }).code : undefined;
      if (code === "RUN_ACTIVE" || code === "SESSION_COMPACTING") throw e;
    }
    throw new Error(messageText);
  }

  await readAgentSseStream(res, opts);
}

/** 重连已有后台 run 的 SSE 流 */
export async function streamAgentRunApi(
  runId: string,
  opts: {
    afterSeq?: number;
    signal?: AbortSignal;
    onEvent: (event: AgentStreamEvent) => void;
  },
): Promise<void> {
  const params = new URLSearchParams();
  if (opts.afterSeq != null && opts.afterSeq > 0) {
    params.set("afterSeq", String(opts.afterSeq));
  }
  const q = params.toString();
  const res = await fetch(
    `/api/agent/runs/${encodeURIComponent(runId)}/stream${q ? `?${q}` : ""}`,
    { signal: opts.signal },
  );
  if (!res.ok) {
    let messageText = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      if (errBody.error?.message) messageText = errBody.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(messageText);
  }
  await readAgentSseStream(res, opts);
}

export function cancelAgentRunApi(runId: string): Promise<AgentRunPublic> {
  return api<AgentRunPublic>(`/api/agent/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// ========== 知识图谱 ==========

export interface GraphNode {
  id: string;
  type: "doc" | "concept";
  label: string;
  definition?: string;
  description: string;
  confidence: number;
  sources?: Array<{
    type: "doc";
    documentId: string;
    title?: string;
    heading?: string;
  }>;
}

export type GraphEdgeType =
  | "contains"
  | "related_to"
  | "part_of"
  | "depends_on";

export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType | string;
  confidence: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** 读取指定目录的图谱缓存 */
export function getGraphApi(folderId: string): Promise<GraphData | null> {
  return api<GraphData | null>(`/api/graph/${folderId}`, { method: "GET" });
}

/** 触发指定目录的图谱构建（异步入队） */
export function analyzeGraphApi(folderId: string): Promise<GraphTaskEnqueueResult> {
  return api<GraphTaskEnqueueResult>(`/api/graph/${folderId}/analyze`, { method: "POST" });
}

/** 读取域级图谱缓存 */
export function getDomainGraphApi(domainId: string): Promise<GraphData | null> {
  return api<GraphData | null>(`/api/graph/domain/${domainId}`, { method: "GET" });
}

/** 触发域级图谱构建（异步入队） */
export function analyzeDomainGraphApi(domainId: string): Promise<GraphTaskEnqueueResult> {
  return api<GraphTaskEnqueueResult>(`/api/graph/domain/${domainId}/analyze`, { method: "POST" });
}

/** 查询任务状态 */
export function getGraphTaskApi(taskId: string): Promise<GraphTaskStatus> {
  return api<GraphTaskStatus>(`/api/graph/tasks/${encodeURIComponent(taskId)}`, {
    method: "GET",
  });
}

/* ── 类型 ── */

export interface GraphTaskEnqueueResult {
  taskId: string;
  status: "pending" | "running" | "completed" | "failed";
  position: number;
  deduped: boolean;
}

export type GraphTaskStatusEnum =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "stale"
  | "not_found";

export interface GraphTaskLogEntry {
  ts: string;
  event: string;
  level: "info" | "warn" | "error";
  data?: any;
}

export interface GraphTaskStatus {
  id: string;
  type: string;
  status: GraphTaskStatusEnum;
  position: number;
  progress?: { current: number; total: number };
  logs: GraphTaskLogEntry[];
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}
