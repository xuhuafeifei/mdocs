import { IsIn, IsOptional, IsString } from "class-validator";
import { PageRequest } from "../../../shared/request/page.request.js";

/** GET /api/visitors/me/documents */
export class ListMyDocumentsRequest extends PageRequest {
  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsString()
  creatorVisitorId?: string;

  @IsOptional()
  @IsIn(["md", "html", "sheet"])
  fileType?: string;
}
