import { IsArray, IsIn, IsOptional, IsString } from "class-validator";
import {
  PIPELINE_INSTALL_MODES,
  type PipelineInstallMode,
  type PipelineOutput,
} from "../pipeline/types.js";

export class CreateCustomPipelineRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(PIPELINE_INSTALL_MODES)
  installMode?: PipelineInstallMode;

  @IsOptional()
  @IsArray()
  @IsIn(["mcp", "skill"], { each: true })
  outputs?: PipelineOutput[];
}
