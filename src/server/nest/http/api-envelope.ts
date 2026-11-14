/** 成功响应信封（线上协议；由 WrapDataInterceptor 统一包）。 */
export type ApiOk<T> = { data: T };

/** 失败响应信封（由 ApiExceptionFilter 统一写）。 */
export type ApiErr = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
