import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateDocumentCommentRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  content!: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  replyToVisitorId?: string | null;

  @IsOptional()
  @IsString()
  replyToVisitorName?: string | null;
}
