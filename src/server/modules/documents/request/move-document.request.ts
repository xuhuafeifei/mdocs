import { IsString, ValidateIf } from "class-validator";

export class MoveDocumentRequest {
  @ValidateIf((_, v) => v !== null)
  @IsString()
  parentId!: string | null;
}
