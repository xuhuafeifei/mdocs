import { IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class JobTableSchemaRequest {
  @IsOptional()
  @IsString()
  x?: string;

  @IsOptional()
  @IsString()
  y?: string;
}

export class JobConfigPutRequest {
  @IsOptional()
  @IsString()
  cron?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  jobType?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => JobTableSchemaRequest)
  @IsObject()
  tableSchema?: JobTableSchemaRequest;
}
