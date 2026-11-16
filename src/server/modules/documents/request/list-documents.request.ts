import { IsOptional, IsString } from "class-validator";

export class ListDocumentsRequest {
  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsString()
  domainName?: string;
}
