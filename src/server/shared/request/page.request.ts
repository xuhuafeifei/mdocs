import { Transform } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";
import {
  DEFAULT_LIMIT,
  DEFAULT_OFFSET,
  MAX_LIMIT,
} from "./page.params.js";

/** 缺省填默认；已给出但非整数则原样留下，交给 @IsInt 拒绝。 */
function toIntOrDefault(defaultValue: number) {
  return ({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === "") return defaultValue;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return value;
    return n;
  };
}

/** 分页进参；ValidationPipe 校验后 offset/limit 必为合法 number。非法 → 400。 */
export class PageRequest {
  @Transform(toIntOrDefault(DEFAULT_OFFSET))
  @IsInt()
  @Min(0)
  offset: number = DEFAULT_OFFSET;

  @Transform(toIntOrDefault(DEFAULT_LIMIT))
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}

export type { PageParams } from "./page.params.js";
export { resolvePageParams } from "./page.params.js";
