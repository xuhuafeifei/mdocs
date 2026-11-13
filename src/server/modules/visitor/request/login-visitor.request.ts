import { IsString, MinLength } from "class-validator";

export class LoginVisitorRequest {
  @IsString()
  @MinLength(1)
  visitorName!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
