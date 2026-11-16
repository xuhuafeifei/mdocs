import { IsArray, IsString } from "class-validator";

export class EmbeddingRebuildRequest {
  @IsArray()
  @IsString({ each: true })
  documentIds!: string[];
}
