import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import crypto from "node:crypto";
import multer from "multer";
import path from "node:path";
import { Observable } from "rxjs";
import { getConfig } from "../../infra/config";
import { getMaxUploadBytes } from "../../infra/config/server-settings.js";
import { assetUploadError } from "./asset-upload-envelope.js";
import { isAllowedAssetUpload } from "./asset-headers.js";

/**
 * 每次请求按当前上传上限建 multer（对齐旧 Express 路由）。
 * 字段名 `file[]`（与前端 FormData 一致）。
 */
@Injectable()
export class NestAssetUploadInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const cfg = getConfig();
    const upload = multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, cfg.assetsDir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase() || ".bin";
          cb(null, `${crypto.randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: getMaxUploadBytes(), files: 24 },
      fileFilter: (_req, file, cb) => {
        if (!isAllowedAssetUpload(file.originalname, file.mimetype)) {
          cb(new Error("unsupported file type"));
          return;
        }
        cb(null, true);
      },
    });

    return new Observable((subscriber) => {
      upload.array("file[]", 20)(req, res, (err: unknown) => {
        if (err) {
          subscriber.error(
            new HttpException(
              assetUploadError(err instanceof Error ? err.message : "upload failed"),
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
