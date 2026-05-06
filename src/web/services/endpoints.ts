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
import { api, ApiRequestError, getStoredToken } from "./client";
import type { DocumentDetail } from "../../shared/types/document";
import type {
  VisitorDirectoryEntry,
  VisitorMeResponse,
  VisitorPublic,
  VisitorRegisterResponse,
} from "../../shared/types/visitor";
import type { TreeNode } from "../../shared/types/tree";
import type { DomainSummary, DomainMemberListEntry } from "../../shared/types/domain";
import type { DomainMemberTemplate } from "../../shared/types/domainMemberTemplate";

/**
 * 访客注册：创建新访客并返回身份令牌。
 */
export function registerVisitorApi(visitorName: string): Promise<VisitorRegisterResponse> {
  return api<VisitorRegisterResponse>("/api/visitors/register", {
    method: "POST",
    body: JSON.stringify({ visitorName }),
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
  relativePath: string;
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
  input: { content: string; displayName?: string; permission?: number },
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "PUT",
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
 */
export async function uploadAssetApi(file: File, documentId: string): Promise<string> {
  // 构建 FormData，包含文件和文档 ID
  const formData = new FormData();
  formData.append("file[]", file);
  formData.append("documentId", documentId);

  // 手动构建请求头，只添加身份令牌，不添加 Content-Type
  //（浏览器会自动为 FormData 设置正确的 multipart/form-data）
  const headers = new Headers();
  const token = getStoredToken();
  if (token) headers.set("x-visitor-token", token);

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
 * 删除空目录。
 */
export function deleteFolderApi(folderId: string): Promise<void> {
  return api<void>(`/api/folders/${encodeURIComponent(folderId)}`, {
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
