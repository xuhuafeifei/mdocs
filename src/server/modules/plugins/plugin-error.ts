/** 插件 HTTP 错误（Nest ExceptionFilter 识别 code + status） */
export class PluginError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PluginError";
    this.code = code;
    this.status = status;
  }
}

/** 将 catalog / job 抛出的 Error 映射为 PluginError */
export function toPluginError(err: unknown, fallbackStatus = 400): PluginError {
  if (err instanceof PluginError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (message === "pipeline not found" || message === "no default pipeline") {
    return new PluginError("NOT_FOUND", message, 404);
  }
  return new PluginError(
    fallbackStatus === 404 ? "NOT_FOUND" : "BAD_REQUEST",
    message,
    fallbackStatus,
  );
}
