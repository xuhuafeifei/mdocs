import { IsString, MinLength } from "class-validator";

export class LinkToImgRequest {
  @IsString()
  @MinLength(1)
  url!: string;
}
