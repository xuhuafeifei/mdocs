import { IsString, MinLength } from "class-validator";

export class RenameDomainRequest {
  @IsString()
  @MinLength(1)
  domainName!: string;
}
