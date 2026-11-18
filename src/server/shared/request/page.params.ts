/** repo / application 使用的已校验分页（无 optional）。 */
export type PageParams = {
  offset: number;
  limit: number;
};

export const DEFAULT_OFFSET = 0;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * 非 HTTP 入口（Agent 等）解析分页：缺省用默认值；出现非法值直接抛错，不钳位。
 * 与 PageRequest + ValidationPipe 规则对齐。
 */
export function resolvePageParams(input?: {
  offset?: number;
  limit?: number;
}): PageParams {
  const offset = input?.offset === undefined ? DEFAULT_OFFSET : input.offset;
  const limit = input?.limit === undefined ? DEFAULT_LIMIT : input.limit;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error(`invalid offset: ${String(input?.offset)}`);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`invalid limit: ${String(input?.limit)} (expected 1..${MAX_LIMIT})`);
  }
  return { offset, limit };
}
