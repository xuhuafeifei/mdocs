import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import type { NestApiErr } from "./nest-api-ok.js";

type CodedHttpError = {
  code: string;
  message: string;
  status: number;
  details?: unknown;
};

/**
 * 统一错误体 `{ error: { code, message } }`，对齐现有 Express 路由约定。
 * 不 import 业务模块：识别带 code/status 的 Error（如 DocumentError）即可。
 */
@Catch()
export class NestApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (isCodedHttpError(exception)) {
      const body: NestApiErr = {
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details !== undefined ? { details: exception.details } : {}),
        },
      };
      res.status(exception.status).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      if (isNestApiErr(raw)) {
        res.status(status).json(raw);
        return;
      }
      const message = nestHttpMessage(raw, exception.message);
      res.status(status).json({
        error: { code: httpStatusCode(status), message },
      } satisfies NestApiErr);
      return;
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: "INTERNAL", message: "internal error" },
    } satisfies NestApiErr);
  }
}

function isCodedHttpError(e: unknown): e is CodedHttpError {
  if (!(e instanceof Error)) return false;
  const x = e as Error & { code?: unknown; status?: unknown; details?: unknown };
  return typeof x.code === "string" && typeof x.status === "number";
}

function isNestApiErr(raw: unknown): raw is NestApiErr {
  if (!raw || typeof raw !== "object") return false;
  const err = (raw as { error?: unknown }).error;
  return (
    !!err &&
    typeof err === "object" &&
    typeof (err as { code?: unknown }).code === "string" &&
    typeof (err as { message?: unknown }).message === "string"
  );
}

function nestHttpMessage(raw: unknown, fallback: string): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "message" in raw) {
    const m = (raw as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.map(String).join("; ");
  }
  return fallback;
}

function httpStatusCode(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  return "HTTP_ERROR";
}
