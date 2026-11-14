import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateDomainRequest {
  @IsString()
  @MinLength(1)
  domainName!: string;

  @IsOptional()
  @IsIn(["public", "restricted", "private"])
  permission?: "public" | "restricted" | "private";
}
