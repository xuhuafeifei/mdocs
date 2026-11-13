import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import multer from "multer";
import { Observable } from "rxjs";
import { getMaxUploadBytes } from "../../infra/config/server-settings.js";
import { MemeError } from "./meme-error.js";

/**
 * 每次请求按当前上传上限建 multer（对齐旧 Express 路由）。
 * 字段名固定为 file。
 */
@Injectable()
export class NestMemeUploadInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: getMaxUploadBytes(), files: 1 },
    });

    return new Observable((subscriber) => {
      upload.single("file")(req, res, (err: unknown) => {
        if (err) {
          subscriber.error(
            new MemeError(
              "MEME_ERROR",
              `上传失败：${err instanceof Error ? err.message : String(err)}`,
              400,
            ),
          );
          return;
        }
        next.handle().subscribe(subscriber);
      });
    });
  }
}
