import { IsString, MinLength } from "class-validator";

export class PutPipelineYamlRequest {
  @IsString()
  @MinLength(1)
  yaml!: string;
}
