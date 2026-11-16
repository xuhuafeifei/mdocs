import { IsIn, IsString } from "class-validator";

export class ConvertDocumentRequest {
  @IsString()
  content!: string;

  @IsIn(["markdown", "lexical"])
  from!: "markdown" | "lexical";

  @IsIn(["markdown", "lexical"])
  to!: "markdown" | "lexical";
}
