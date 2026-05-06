/**
 * API 客户端与身份管理
 * 封装了 localStorage 中的访客 Token/ID 存取，以及统一的 fetch 请求方法。
 * 所有后端 API 调用都应通过此模块的 `api()` 函数，以确保身份令牌自动注入。
 */

// ---- localStorage 键名 ----
const TOKEN_KEY = "mdocs.visitorToken";
const VISITOR_ID_KEY = "mdocs.visitorId";

export interface ApiError {
  code: string;
  message: string;
}

/**
 * 统一 API 请求错误类。
 * 包含 HTTP 状态码、错误码和错误消息，便于上层根据状态码做不同处理。
 */
export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * 从 localStorage 读取当前访客的认证令牌。
 */
export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

/**
 * 从 localStorage 读取当前访客的 ID。
 */
export function getStoredVisitorId(): string | null {
  return window.localStorage.getItem(VISITOR_ID_KEY);
}

/**
 * 将访客身份（ID + Token）持久化到 localStorage。
 */
export function storeIdentity(visitorId: string, token: string): void {
  window.localStorage.setItem(VISITOR_ID_KEY, visitorId);
  window.localStorage.setItem(TOKEN_KEY, token);
}

/**
 * 清除本地保存的访客身份（登出或 Token 失效时调用）。
 */
export function clearIdentity(): void {
  window.localStorage.removeItem(VISITOR_ID_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * 统一 API 请求封装。
 * 自动注入 Content-Type 和 x-visitor-token 请求头，统一处理 204/JSON 解析/错误转换。
 */
export async function api<T>(
  path: string,
  init: RequestInit & { requireAuth?: boolean } = {},
): Promise<T> {
  // 构建请求头
  const headers = new Headers(init.headers);
  // 如果有请求体且未设置 Content-Type，默认设为 application/json
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  // 从 localStorage 读取 Token 并注入请求头
  const token = getStoredToken();
  if (token) headers.set("x-visitor-token", token);

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
