import { IsString } from "class-validator";

export class MergeContextRequest {
  @IsString()
  localBaseCommitId!: string;

  @IsString()
  remoteCommitId!: string;
}
