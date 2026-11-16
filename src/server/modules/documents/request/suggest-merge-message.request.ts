import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString } from "class-validator";

export class SuggestMergeMessageRequest {
  @IsString()
  localContent!: string;

  @IsString()
  remoteContent!: string;

  @IsString()
  mergedContent!: string;

  @IsOptional()
  @IsString()
  baseContent?: string;

  @IsOptional()
  @IsIn(["markdown", "plain", "lexical"])
  @Transform(({ value }) =>
    value === "markdown" || value === "plain" ? value : ("lexical" as const),
  )
  contentFormat: "markdown" | "plain" | "lexical" = "lexical";
}
