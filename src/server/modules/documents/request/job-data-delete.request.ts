import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsNumber, IsOptional } from "class-validator";

export class JobDataDeleteRequest {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  ids?: number[];

  @IsOptional()
  @IsBoolean()
  all?: boolean;
}
