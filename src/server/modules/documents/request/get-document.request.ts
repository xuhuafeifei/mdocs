import { Transform } from "class-transformer";
import { IsIn, IsOptional } from "class-validator";

export class GetDocumentRequest {
  @IsOptional()
  @IsIn(["json", "text"])
  @Transform(({ value }) => (value === "text" ? "text" : "json"))
  format: "json" | "text" = "json";
}
