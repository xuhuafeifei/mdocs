import { IsIn, IsOptional } from "class-validator";

export class ListMemesRequest {
  @IsOptional()
  @IsIn(["system", "tenant"])
  scope?: "system" | "tenant";
}
