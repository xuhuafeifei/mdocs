import { afterEach, describe, expect, it } from "vitest";

import {
  DOC_SCROLL_CACHE_MAX,
  clearDocScrollCache,
  docScrollCacheKeys,
  docScrollCacheSize,
  getDocScroll,
  setDocScroll,
} from "./docScrollCache";

afterEach(() => {
  clearDocScrollCache();
});

describe("docScrollCache", () => {
  it("读写滚动位置", () => {
    setDocScroll("a", 120, 8);
    expect(getDocScroll("a")).toEqual({ scrollTop: 120, scrollLeft: 8 });
  });

  it("回到顶部则删除条目", () => {
    setDocScroll("a", 40);
    setDocScroll("a", 0, 0);
    expect(getDocScroll("a")).toBeNull();
    expect(docScrollCacheSize()).toBe(0);
  });

  it("超过上限时按 LRU 淘汰", () => {
    for (let i = 0; i < DOC_SCROLL_CACHE_MAX; i++) {
      setDocScroll(`d${i}`, i + 1);
    }
    expect(docScrollCacheSize()).toBe(DOC_SCROLL_CACHE_MAX);

    // 访问最旧的 d0，使其变为最近
    expect(getDocScroll("d0")?.scrollTop).toBe(1);

    setDocScroll("new", 99);
    expect(docScrollCacheSize()).toBe(DOC_SCROLL_CACHE_MAX);
    expect(getDocScroll("d1")).toBeNull(); // d1 未再访问，应被淘汰
    expect(getDocScroll("d0")?.scrollTop).toBe(1);
    expect(getDocScroll("new")?.scrollTop).toBe(99);
    expect(docScrollCacheKeys()[docScrollCacheKeys().length - 1]).toBe("new");
  });
});
