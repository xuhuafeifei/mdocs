/**
 * server-settings 属 infra/config，不是业务 module。
 * return 业务结果；`{ data }` 由 WrapDataInterceptor 包。
 */
import { Controller, Get, Put } from "@nestjs/common";
import { ValidatedBody } from "../../nest/validation.js";
import { PutServerSettingsRequest } from "./put-server-settings.request.js";
import {
  getServerSettingsPublic,
  setMaxUploadBytes,
} from "./server-settings.js";

@Controller("api/server-settings")
export class ServerSettingsController {
  @Get()
  get() {
    return getServerSettingsPublic();
  }

  @Put()
  put(@ValidatedBody(PutServerSettingsRequest) body: PutServerSettingsRequest) {
    const maxUploadBytes = setMaxUploadBytes(body.maxUploadBytes);
    return { ...getServerSettingsPublic(), maxUploadBytes };
  }
}
