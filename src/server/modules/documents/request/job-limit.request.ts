import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class JobLimitRequest {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
