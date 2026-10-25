import { describe, expect, it } from "vitest";
import { computeSyncedScrollTop, scrollRatio } from "./version-compare-scroll.js";

type Metrics = { scrollTop: number; scrollHeight: number; clientHeight: number };

function metrics(scrollTop: number, scrollHeight: number, clientHeight: number): Metrics {
  return { scrollTop, scrollHeight, clientHeight };
}

describe("version-compare-scroll", () => {
  it("scrollRatio: 顶部 0 / 中间 0.5 / 底部 1", () => {
    expect(scrollRatio(metrics(0, 1000, 400))).toBe(0);
    expect(scrollRatio(metrics(300, 1000, 400))).toBe(0.5);
    expect(scrollRatio(metrics(600, 1000, 400))).toBe(1);
  });

  it("scrollRatio: 不可滚动 / 内容不足一屏 → 0", () => {
    expect(scrollRatio(metrics(0, 400, 400))).toBe(0);
    expect(scrollRatio(metrics(0, 200, 400))).toBe(0);
  });

  it("scrollRatio: scrollTop 越界时 clamp 到 [0,1]", () => {
    expect(scrollRatio(metrics(9999, 1000, 400))).toBe(1);
    expect(scrollRatio(metrics(-50, 1000, 400))).toBe(0);
    expect(scrollRatio(metrics(Number.NaN, 1000, 400))).toBe(0);
  });

  it("computeSyncedScrollTop: 10% → 10%（两栏高度不同也按比例）", () => {
    const source = metrics(100, 1400, 400); // max 1000 → 10%
    const target = metrics(0, 2000, 400); // max 1600
    expect(computeSyncedScrollTop(source, target)).toBe(160);
  });

  it("computeSyncedScrollTop: 底部对底部", () => {
    expect(computeSyncedScrollTop(metrics(600, 1000, 400), metrics(0, 3000, 500))).toBe(2500);
  });

  it("computeSyncedScrollTop: 目标不可滚动 → 0，不抛错", () => {
    expect(computeSyncedScrollTop(metrics(300, 1000, 400), metrics(0, 400, 400))).toBe(0);
  });

  it("computeSyncedScrollTop: 源不可滚动 → 目标停 0", () => {
    expect(computeSyncedScrollTop(metrics(0, 400, 400), metrics(0, 2000, 400))).toBe(0);
  });

  it("computeSyncedScrollTop: 取整避免亚像素抖动", () => {
    const source = metrics(1, 1000, 0); // max 1000 → ratio 0.001
    const target = metrics(0, 1001, 0); // max 1001 → 1.001
    expect(computeSyncedScrollTop(source, target)).toBe(1);
  });
});
