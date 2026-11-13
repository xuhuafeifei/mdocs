import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListMyDocumentsRequest {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsString()
  creatorVisitorId?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsIn(["domain", "creator"])
  groupBy?: "domain" | "creator";
}
