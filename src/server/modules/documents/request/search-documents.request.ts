import { Transform } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class SearchDocumentsRequest {
  @IsString()
  @MinLength(1)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  query!: string;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsNumber()
  topN?: number;

  @IsOptional()
  @IsIn(["auto", "keyword", "semantic"])
  @Transform(({ value }) =>
    value === "keyword" || value === "semantic" ? value : ("auto" as const),
  )
  mode: "auto" | "keyword" | "semantic" = "auto";
}
