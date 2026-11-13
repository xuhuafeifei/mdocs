import { IsIn, IsOptional } from "class-validator";
import type { PipelineJobAction } from "../pipeline-job.js";

export class GetPipelineJobRequest {
  @IsOptional()
  @IsIn(["install", "uninstall"])
  action?: PipelineJobAction;
}
