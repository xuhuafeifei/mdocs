import { IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class CreateFolderRequest {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  permission?: number;
}
