import { IsOptional, IsString, MaxLength } from "class-validator";

export class SyncSystemMemesRequest {
  @IsOptional()
  @IsString()
  @MaxLength(214)
  spec?: string;
}
