import { IsString, MinLength } from "class-validator";

export class RecoverVisitorRequest {
  @IsString()
  @MinLength(1)
  recoveryCode!: string;
}
