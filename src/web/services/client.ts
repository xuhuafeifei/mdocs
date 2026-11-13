/**
 * API 客户端与身份管理
 * 封装了 localStorage 中的访客 Token/ID 存取，以及统一的 fetch 请求方法。
 * 所有后端 API 调用都应通过此模块的 `api()` 函数，以确保身份令牌自动注入。
 */

import { ApiRequestError } from "./api-request-error";

export { ApiRequestError };

// ---- localStorage 键名 ----
const VISITOR_ID_KEY = "mdocs.visitorId";

export interface ApiError {
  code: string;
  message: string;
}

export const MDOCS_API_ERROR_EVENT = "mdocs-api-error";

function emitApiError(err: ApiRequestError): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MDOCS_API_ERROR_EVENT, {
      detail: {
        status: err.status,
        code: err.code,
        message: err.message,
      },
    }),
  );
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
 * 统一 API 请求封装。
 * 自动注入 Content-Type，统一处理 204/JSON 解析/错误转换。
 * Token 由后端通过 HttpOnly Cookie 自动携带。
 */
export async function api<T>(
  path: string,
  init: RequestInit & { requireAuth?: boolean; silent?: boolean } = {},
): Promise<T> {
  try {
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
      throw new ApiRequestError(
        res.status,
        err?.code ?? "UNKNOWN",
        err?.message ?? "request failed",
        (err as { details?: unknown } | undefined)?.details,
      );
    }
    // 返回响应中的 data 字段
    return (body as { data: T }).data;
  } catch (err) {
    if (err instanceof ApiRequestError && !init.silent) {
      emitApiError(err);
    }
    throw err;
  }
}
