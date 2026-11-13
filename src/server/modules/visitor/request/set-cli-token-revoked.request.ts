import { IsBoolean } from "class-validator";

export class SetCliTokenRevokedRequest {
  @IsBoolean()
  revoked!: boolean;
}
