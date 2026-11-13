/**
 * server-settings 属 infra/config，不是业务 module。
 * return 业务结果；`{ data }` 由 NestWrapDataInterceptor 包。
 */
import { BadRequestException, Body, Controller, Get, Put } from "@nestjs/common";
import {
  getServerSettingsPublic,
  MAX_MAX_UPLOAD_BYTES,
  MIN_MAX_UPLOAD_BYTES,
  setMaxUploadBytes,
} from "./server-settings.js";

@Controller("api/server-settings")
export class ServerSettingsController {
  @Get()
  get() {
    return getServerSettingsPublic();
  }

  @Put()
  put(@Body() body: { maxUploadBytes?: unknown }) {
    const raw = body?.maxUploadBytes;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      throw new BadRequestException("maxUploadBytes must be a positive number (bytes)");
    }
    if (n < MIN_MAX_UPLOAD_BYTES || n > MAX_MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `maxUploadBytes must be between ${MIN_MAX_UPLOAD_BYTES} and ${MAX_MAX_UPLOAD_BYTES}`,
      );
    }
    const maxUploadBytes = setMaxUploadBytes(n);
    return { ...getServerSettingsPublic(), maxUploadBytes };
  }
}
