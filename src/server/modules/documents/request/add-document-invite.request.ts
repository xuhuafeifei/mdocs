import { IsString, MinLength } from "class-validator";

export class AddDocumentInviteRequest {
  @IsString()
  @MinLength(1)
  targetVisitorId!: string;

  @IsString()
  @MinLength(1)
  targetPermission!: string;
}
