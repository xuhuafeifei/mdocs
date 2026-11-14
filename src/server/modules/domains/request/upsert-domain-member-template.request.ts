import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class UpsertDomainMemberTemplateRequest {
  @IsString()
  @MinLength(1)
  displayName!: string;

  /** 缺省视为 [] */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visitorIds?: string[];
}
