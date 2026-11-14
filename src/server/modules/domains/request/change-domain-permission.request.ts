import { IsString } from "class-validator";

export class ChangeDomainPermissionRequest {
  @IsString()
  permission!: string;
}
