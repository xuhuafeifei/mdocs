/** 成功响应信封（线上协议；由 NestWrapDataInterceptor 统一包）。 */
export type NestApiOk<T> = { data: T };

/** 失败响应信封（由 NestApiExceptionFilter 统一写）。 */
export type NestApiErr = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
