import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString } from "class-validator";

export class SuggestCommitMessageRequest {
  @IsString()
  content!: string;

  @IsOptional()
  @IsIn(["markdown", "lexical"])
  @Transform(({ value }) =>
    value === "markdown" ? ("markdown" as const) : ("lexical" as const),
  )
  contentFormat: "markdown" | "lexical" = "lexical";
}
