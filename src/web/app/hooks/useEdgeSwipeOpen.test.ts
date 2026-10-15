import { describe, expect, it } from "vitest";
import {
  findHorizontalScrollParent,
  hScrollCanAbsorb,
  mobileNavPanelWidthPx,
} from "./useEdgeSwipeOpen";

describe("mobileNavPanelWidthPx", () => {
  it("不超过 300，约为屏宽 86%", () => {
    const w = mobileNavPanelWidthPx();
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(300);
  });
});

describe("findHorizontalScrollParent", () => {
  it("找到 overflow-x 可滚且内容更宽的祖先", () => {
    const outer = document.createElement("div");
    const scroller = document.createElement("div");
    Object.defineProperty(scroller, "scrollWidth", { value: 400 });
    Object.defineProperty(scroller, "clientWidth", { value: 200 });
    scroller.style.overflowX = "auto";
    const inner = document.createElement("span");
    scroller.appendChild(inner);
    outer.appendChild(scroller);
    document.body.appendChild(outer);
    expect(findHorizontalScrollParent(inner)).toBe(scroller);
    outer.remove();
  });

  it("无可滚祖先时返回 null", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(findHorizontalScrollParent(el)).toBeNull();
    el.remove();
  });
});

describe("hScrollCanAbsorb", () => {
  it("右滑仅在 scrollLeft>0 时交给表格", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollWidth", { value: 400 });
    Object.defineProperty(el, "clientWidth", { value: 200 });
    let left = 0;
    Object.defineProperty(el, "scrollLeft", {
      get: () => left,
      set: (v: number) => {
        left = v;
      },
      configurable: true,
    });
    expect(hScrollCanAbsorb(el, 20)).toBe(false);
    left = 50;
    expect(hScrollCanAbsorb(el, 20)).toBe(true);
  });

  it("左滑在未滚到尽头时交给表格", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollWidth", { value: 400 });
    Object.defineProperty(el, "clientWidth", { value: 200 });
    let left = 0;
    Object.defineProperty(el, "scrollLeft", {
      get: () => left,
      set: (v: number) => {
        left = v;
      },
      configurable: true,
    });
    expect(hScrollCanAbsorb(el, -20)).toBe(true);
    left = 200;
    expect(hScrollCanAbsorb(el, -20)).toBe(false);
  });
});
