import { IsOptional, IsString } from "class-validator";

export class SyncStatusRequest {
  @IsOptional()
  @IsString()
  localBaseCommitId?: string;
}
