import { IsOptional, IsString, MinLength } from "class-validator";

export class RegisterVisitorRequest {
  @IsString()
  @MinLength(1)
  visitorName!: string;

  @IsOptional()
  @IsString()
  password?: string;
}
