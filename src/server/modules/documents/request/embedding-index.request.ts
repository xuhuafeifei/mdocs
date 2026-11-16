import { IsOptional, IsString } from "class-validator";

export class EmbeddingIndexRequest {
  @IsOptional()
  @IsString()
  domainId?: string;
}
