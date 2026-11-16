import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString } from "class-validator";

export class SuggestDocumentMergeRequest {
  @IsString()
  localContent!: string;

  @IsOptional()
  @IsString()
  localBaseCommitId?: string;

  @IsOptional()
  @IsIn(["markdown", "plain", "lexical"])
  @Transform(({ value }) => value ?? ("markdown" as const))
  contentFormat: "markdown" | "plain" | "lexical" = "markdown";
}
