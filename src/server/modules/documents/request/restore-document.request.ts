import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class RestoreDocumentRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  auditId!: number;
}
