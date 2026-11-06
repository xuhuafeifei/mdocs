import { describe, expect, it } from "vitest";
import { isCronDueAt } from "./cron.js";

describe("isCronDueAt", () => {
  it("fires on matching second", () => {
    // 2026-11-05T08:49:00.123Z → 应对 "0 49 8 * * *" 在 UTC（croner 默认本地时区，改用每秒）
    const at = Date.parse("2026-11-05T12:00:00.500Z");
    expect(isCronDueAt("* * * * * *", at)).toBe(true);
  });

  it("false on empty / invalid", () => {
    expect(isCronDueAt("", Date.now())).toBe(false);
    expect(isCronDueAt("not-a-cron", Date.now())).toBe(false);
  });
});
