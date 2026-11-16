import { Transform } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import { FILE_TYPE } from "../../../../shared/file-types.js";

export class CreateDocumentRequest {
  @IsString()
  fileName!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsNumber()
  permission?: number;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsIn(["markdown", "lexical"])
  @Transform(({ value }) => (value === "markdown" ? "markdown" : undefined))
  contentFormat?: "markdown";

  @IsOptional()
  @IsIn([FILE_TYPE.DOCUMENT, FILE_TYPE.HTML, FILE_TYPE.SHEET, FILE_TYPE.JOB])
  @Transform(({ value }) => value ?? FILE_TYPE.DOCUMENT)
  fileType: string = FILE_TYPE.DOCUMENT;
}
