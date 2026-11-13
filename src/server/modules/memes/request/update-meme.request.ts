import { IsOptional, IsString } from "class-validator";

export class UpdateMemeRequest {
  @IsOptional()
  @IsString()
  desc?: string;
}
