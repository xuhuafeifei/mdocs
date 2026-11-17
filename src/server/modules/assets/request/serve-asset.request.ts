import { IsOptional, IsString } from "class-validator";

export class ServeAssetRequest {
  @IsOptional()
  @IsString()
  name?: string;
}
