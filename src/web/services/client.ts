/**
 * API 客户端与身份管理
 * 封装了 localStorage 中的访客 Token/ID 存取，以及统一的 fetch 请求方法。
 * 所有后端 API 调用都应通过此模块的 `api()` 函数，以确保身份令牌自动注入。
 *
 * Demo Mode：通过构建参数 `VITE_DEMO_MODE=true` 开启，编译后固定生效。
 * Demo 模式下所有 API 请求走 Mock 实现（IndexedDB 存储），无需后端。
 */

import {
  mockFetchMe,
  mockFetchDomains,
  mockFetchTree,
  mockGetDocument,
  mockCreateDocument,
  mockUpdateDocument,
  mockDeleteDocument,
  mockRecoverVisitor,
  mockRegisterVisitor,
  mockCreateFolder,
  mockDeleteFolder,
  mockRemoveFolder,
  mockCheckBookmark,
  mockAddBookmark,
  mockRemoveBookmark,
  mockFetchBookmarks,
  mockFetchComments,
  mockCreateComment,
  mockDeleteComment,
  mockFetchVisitorsDirectory,
  mockGetDocumentInvites,
  mockAddDocumentInvite,
  mockRemoveDocumentInvite,
  mockFetchMyDocuments,
} from "./mockApi";

import { ApiRequestError } from "./api-request-error";

export { ApiRequestError };

// ---- localStorage 键名 ----
const VISITOR_ID_KEY = "mdocs.visitorId";

export interface ApiError {
  code: string;
  message: string;
}

/**
 * 检查当前是否为 Demo Mode。
 * 由构建参数 `VITE_DEMO_MODE=true` 控制，编译后固定不变。
 */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}

/**
 * 从 localStorage 读取当前访客的 ID。
 */
export function getStoredVisitorId(): string | null {
  return window.localStorage.getItem(VISITOR_ID_KEY);
}

/**
 * 将访客 ID 持久化到 localStorage。
 * Token 由后端通过 HttpOnly Cookie 管理，前端不存储。
 */
export function storeVisitorId(visitorId: string): void {
  window.localStorage.setItem(VISITOR_ID_KEY, visitorId);
}

/**
 * 清除本地保存的访客 ID（登出时调用）。
 */
export function clearVisitorId(): void {
  window.localStorage.removeItem(VISITOR_ID_KEY);
}

/**
 * Demo Mode API 路由映射
 * 根据请求路径分发到对应的 Mock API
 */
async function demoApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = init.method || "GET";
  const body = init.body ? JSON.parse(init.body as string) : null;

  // 访客注册
  if (path === "/api/visitors/register" && method === "POST") {
    return mockRegisterVisitor(body.visitorName) as unknown as T;
  }

  // 恢复码找回
  if (path === "/api/visitors/recover" && method === "POST") {
    return mockRecoverVisitor(body.recoveryCode) as unknown as T;
  }

  // 生成恢复码
  if (path === "/api/visitors/recovery-code" && method === "POST") {
    return { recoveryCode: "ABCD-EFGH-IJKL-MNOP" } as unknown as T;
  }

  // 获取当前访客信息
  if (path === "/api/visitors/me") {
    return { visitor: await mockFetchMe() } as unknown as T;
  }

  // 获取域列表
  if (path === "/api/domains") {
    return mockFetchDomains() as unknown as T;
  }

  // 获取文档树
  if (path.startsWith("/api/tree")) {
    const url = new URL(path, window.location.origin);
    const domainId = url.searchParams.get("domainId") || "default";
    return mockFetchTree(domainId) as unknown as T;
  }

  // 获取单个文档
  if (path.match(/^\/api\/documents\/[^/]+$/) && method === "GET") {
    const documentId = path.split("/").pop()!;
    return mockGetDocument(documentId) as unknown as T;
  }

  // 创建文档
  if (path === "/api/documents" && method === "POST") {
    return mockCreateDocument(body) as unknown as T;
  }

  // 更新文档
  if (path.match(/^\/api\/documents\/[^/]+$/) && method === "PUT") {
    const documentId = path.split("/").pop()!;
    return mockUpdateDocument(documentId, body) as unknown as T;
  }

  // 递归删除目录（与正式环境路径一致）
  if (path.match(/^\/api\/documents\/folder\/[^/]+$/) && method === "DELETE") {
    const folderDocumentId = path.split("/").pop()!;
    return mockRemoveFolder(folderDocumentId) as unknown as T;
  }

  // 删除文档
  if (path.match(/^\/api\/documents\/[^/]+$/) && method === "DELETE") {
    const documentId = path.split("/").pop()!;
    await mockDeleteDocument(documentId);
    return undefined as T;
  }

  // 创建文件夹
  if (path === "/api/folders" && method === "POST") {
    return mockCreateFolder(body) as unknown as T;
  }

  // 删除文件夹
  if (path.match(/^\/api\/folders\/[^/]+$/) && method === "DELETE") {
    const folderId = path.split("/").pop()!;
    await mockDeleteFolder(folderId);
    return undefined as T;
  }

  // 搜索（Demo 模式返回空结果）
  if (path === "/api/documents/search" && method === "POST") {
    return [] as unknown as T;
  }

  // ==== 设置页相关 API（返回空数据，让 UI 展示"无数据"状态） ====

  // 访客目录
  if (path === "/api/visitors" && method === "GET") {
    return { visitors: [await mockFetchMe()] } as unknown as T;
  }

  // 域成员
  if (path.match(/^\/api\/domains\/[^/]+\/members$/) && method === "GET") {
    return { members: [] } as unknown as T;
  }
  if (path.match(/^\/api\/domains\/[^/]+\/members$/) && method === "PUT") {
    return { memberCount: (body?.visitorIds as string[] | undefined)?.length ?? 0 } as unknown as T;
  }

  // 域操作（只返回成功，不做实际存储）
  if (path.match(/^\/api\/domains\/[^/]+\/permission$/) && method === "PUT") {
    return { success: true } as unknown as T;
  }
  if (path.match(/^\/api\/domains\/[^/]+$/) && method === "PUT") {
    return { success: true } as unknown as T;
  }
  if (path.match(/^\/api\/domains\/[^/]+$/) && method === "DELETE") {
    return undefined as T;
  }
  if (path === "/api/domains" && method === "POST") {
    return { domainId: `demo-domain-${Date.now()}`, domainName: body?.domainName ?? "", permission: body?.permission ?? "restricted" } as unknown as T;
  }

  // 成员模板
  if (path === "/api/domain-member-templates" && method === "GET") {
    return [] as unknown as T;
  }
  if (path === "/api/domain-member-templates" && method === "POST") {
    return { id: Date.now(), displayName: body?.displayName ?? "", visitorIds: body?.visitorIds ?? [] } as unknown as T;
  }
  if (path.match(/^\/api\/domain-member-templates\/\d+$/) && method === "PUT") {
    return { success: true } as unknown as T;
  }
  if (path.match(/^\/api\/domain-member-templates\/\d+$/) && method === "DELETE") {
    return undefined as T;
  }

  // CLI Token
  if (path === "/api/cli/tokens" && method === "GET") {
    return [] as unknown as T;
  }
  if (path === "/api/cli/tokens" && method === "POST") {
    return { tokenId: `demo-token-${Date.now()}`, token: "demo-token-placeholder", name: body?.name ?? "default", createdAt: new Date().toISOString() } as unknown as T;
  }
  if (path.match(/^\/api\/cli\/tokens\/[^/]+$/) && method === "DELETE") {
    return undefined as T;
  }

  // 访客目录
  if (path === "/api/visitors" && method === "GET") {
    return { visitors: await mockFetchVisitorsDirectory() } as unknown as T;
  }

  // 我的文档
  if (path === "/api/visitors/me/documents" && method === "GET") {
    return mockFetchMyDocuments() as unknown as T;
  }

  // ==== 书签 ====
  if (path === "/api/bookmarks" && method === "GET") {
    return mockFetchBookmarks() as unknown as T;
  }
  if (path.match(/^\/api\/bookmarks\/[^/]+$/) && method === "GET") {
    const documentId = path.split("/").pop()!;
    return mockCheckBookmark(documentId) as unknown as T;
  }
  if (path.match(/^\/api\/bookmarks\/[^/]+$/) && method === "POST") {
    const documentId = path.split("/").pop()!;
    await mockAddBookmark(documentId);
    return undefined as T;
  }
  if (path.match(/^\/api\/bookmarks\/[^/]+$/) && method === "DELETE") {
    const documentId = path.split("/").pop()!;
    await mockRemoveBookmark(documentId);
    return undefined as T;
  }

  // ==== 评论 ====
  if (path.match(/^\/api\/documents\/[^/]+\/comments$/) && method === "GET") {
    const documentId = path.split("/")[3]!;
    return mockFetchComments(documentId) as unknown as T;
  }
  if (path.match(/^\/api\/documents\/[^/]+\/comments$/) && method === "POST") {
    const documentId = path.split("/")[3]!;
    return mockCreateComment(documentId, body) as unknown as T;
  }
  if (path.match(/^\/api\/documents\/[^/]+\/comments\/[^/]+$/) && method === "DELETE") {
    const documentId = path.split("/")[3]!;
    const commentId = path.split("/").pop()!;
    return mockDeleteComment(documentId, commentId) as unknown as T;
  }

  // ==== 文档邀请 ====
  if (path.match(/^\/api\/documents\/[^/]+\/invites$/) && method === "GET") {
    const documentId = path.split("/")[3]!;
    return mockGetDocumentInvites(documentId) as unknown as T;
  }
  if (path.match(/^\/api\/documents\/[^/]+\/invites$/) && method === "POST") {
    const documentId = path.split("/")[3]!;
    await mockAddDocumentInvite(documentId, body?.targetVisitorId, body?.targetPermission);
    return undefined as T;
  }
  if (path.match(/^\/api\/documents\/[^/]+\/invites\/[^/]+$/) && method === "DELETE") {
    const documentId = path.split("/")[3]!;
    const targetVisitorId = path.split("/").pop()!;
    await mockRemoveDocumentInvite(documentId, targetVisitorId);
    return undefined as T;
  }

  // 其他 API 返回空或抛出友好错误
  console.warn(`[Demo Mode] API not mocked: ${method} ${path}`);
  throw new ApiRequestError(501, "DEMO_MODE", "此功能在 Demo 模式下暂不可用");
}

/**
 * 统一 API 请求封装。
 * 自动注入 Content-Type 和 x-visitor-token 请求头，统一处理 204/JSON 解析/错误转换。
 * Demo Mode 下自动使用 Mock API，不会发出网络请求。
 */
export async function api<T>(
  path: string,
  init: RequestInit & { requireAuth?: boolean } = {},
): Promise<T> {
  // Demo Mode 使用 Mock API，跳过网络请求
  if (isDemoMode()) {
    return demoApi<T>(path, init);
  }

  // 构建请求头
  const headers = new Headers(init.headers);
  // 如果有请求体且未设置 Content-Type，默认设为 application/json
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  // Token 由后端通过 HttpOnly Cookie 自动携带，无需手动注入请求头

  // 执行 fetch 请求
  const res = await fetch(path, { ...init, headers });
  // 204 No Content 直接返回 undefined
  if (res.status === 204) {
    return undefined as T;
  }
  // 读取响应文本
  const text = await res.text();
  let body: unknown;
  try {
    // 尝试解析为 JSON
    body = text ? JSON.parse(text) : null;
  } catch {
    // 解析失败说明后端返回了非 JSON 响应
    throw new ApiRequestError(res.status, "BAD_RESPONSE", "response is not valid JSON");
  }
  // 处理 HTTP 错误状态
  if (!res.ok) {
    const err = (body as { error?: ApiError } | null)?.error;
    throw new ApiRequestError(res.status, err?.code ?? "UNKNOWN", err?.message ?? "request failed");
  }
  // 返回响应中的 data 字段
  return (body as { data: T }).data;
}
