import { IsOptional, IsString } from "class-validator";

/** multipart 字段：file + desc（必填在 application 校验）+ meme_name */
export class UploadMemeRequest {
  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsString()
  meme_name?: string;
}
