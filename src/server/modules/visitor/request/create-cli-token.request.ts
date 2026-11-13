import { IsOptional, IsString } from "class-validator";

export class CreateCliTokenRequest {
  @IsOptional()
  @IsString()
  name?: string;
}
