import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";
import { MAX_MAX_UPLOAD_BYTES, MIN_MAX_UPLOAD_BYTES } from "./server-settings.js";

/** PUT /api/server-settings */
export class PutServerSettingsRequest {
  @Type(() => Number)
  @IsInt()
  @Min(MIN_MAX_UPLOAD_BYTES)
  @Max(MAX_MAX_UPLOAD_BYTES)
  maxUploadBytes!: number;
}
