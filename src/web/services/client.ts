const TOKEN_KEY = "mdocs.visitorToken";
const VISITOR_ID_KEY = "mdocs.visitorId";

export interface ApiError {
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredVisitorId(): string | null {
  return window.localStorage.getItem(VISITOR_ID_KEY);
}

export function storeIdentity(visitorId: string, token: string): void {
  window.localStorage.setItem(VISITOR_ID_KEY, visitorId);
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearIdentity(): void {
  window.localStorage.removeItem(VISITOR_ID_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  init: RequestInit & { requireAuth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getStoredToken();
  if (token) headers.set("x-visitor-token", token);

  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiRequestError(res.status, "BAD_RESPONSE", "response is not valid JSON");
  }
  if (!res.ok) {
    const err = (body as { error?: ApiError } | null)?.error;
    throw new ApiRequestError(res.status, err?.code ?? "UNKNOWN", err?.message ?? "request failed");
  }
  return (body as { data: T }).data;
}
