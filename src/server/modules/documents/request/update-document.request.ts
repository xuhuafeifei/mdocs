import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class PublishMergeRequest {
  @IsString()
  remoteCommitId!: string;

  @IsOptional()
  @IsString()
  localSnapshotContent?: string;

  @IsOptional()
  @IsBoolean()
  forceLocal?: boolean;
}

class PublishVersionRequest {
  @IsOptional()
  @IsString()
  localBaseCommitId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublishMergeRequest)
  merge?: PublishMergeRequest;
}

export class UpdateDocumentRequest {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsNumber()
  permission?: number;

  @IsOptional()
  @IsIn(["markdown", "lexical"])
  contentFormat?: "markdown" | "lexical";

  @IsOptional()
  @ValidateNested()
  @Type(() => PublishVersionRequest)
  version?: PublishVersionRequest;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsIn(["auto", "manual", "agent", "cli"])
  source?: "auto" | "manual" | "agent" | "cli";
}
