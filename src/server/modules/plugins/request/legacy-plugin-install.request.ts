import { IsObject, IsOptional } from "class-validator";

export class LegacyPluginInstallRequest {
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}
