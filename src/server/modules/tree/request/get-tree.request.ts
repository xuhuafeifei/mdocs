import { IsOptional, IsString } from "class-validator";

/** GET /api/tree 的 query —— Nest ValidationPipe 直接反序列化到这个类。 */
export class GetTreeRequest {
  @IsOptional()
  @IsString()
  domainId?: string;
}
