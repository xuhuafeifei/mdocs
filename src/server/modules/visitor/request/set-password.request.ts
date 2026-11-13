import { IsOptional, IsString } from "class-validator";

/** 缺省或空字符串表示清除密码 */
export class SetPasswordRequest {
  @IsOptional()
  @IsString()
  password?: string;
}
