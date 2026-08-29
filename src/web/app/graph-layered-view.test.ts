import { describe, expect, it } from "vitest";
import {
  buildContainsHierarchy,
  computeVisibleIds,
  isEffectivelyExpanded,
} from "./graph-layered-view";

describe("graph-layered-view", () => {
  const nodes = ["root", "a", "b", "c"];
  const edges = [
    { from: "root", to: "a" },
    { from: "root", to: "b" },
    { from: "a", to: "c" },
  ];

  it("roots are contains in-degree 0", () => {
    const h = buildContainsHierarchy(nodes, edges);
    expect(h.roots).toEqual(["root"]);
    expect(h.depthMap.get("c")).toBe(2);
  });

  it("depth 0 shows only roots", () => {
    const h = buildContainsHierarchy(nodes, edges);
    const empty = new Set<string>();
    const visible = computeVisibleIds(h.roots, h.childrenOf, (id) =>
      isEffectivelyExpanded(id, 0, h.depthMap, empty, empty),
    );
    expect([...visible].sort()).toEqual(["root"]);
  });

  it("depth 1 shows root children", () => {
    const h = buildContainsHierarchy(nodes, edges);
    const empty = new Set<string>();
    const visible = computeVisibleIds(h.roots, h.childrenOf, (id) =>
      isEffectivelyExpanded(id, 1, h.depthMap, empty, empty),
    );
    expect([...visible].sort()).toEqual(["a", "b", "root"]);
  });

  it("depth 2 shows grandchildren", () => {
    const h = buildContainsHierarchy(nodes, edges);
    const empty = new Set<string>();
    const visible = computeVisibleIds(h.roots, h.childrenOf, (id) =>
      isEffectivelyExpanded(id, 2, h.depthMap, empty, empty),
    );
    expect([...visible].sort()).toEqual(["a", "b", "c", "root"]);
  });

  it("collapsed overrides global depth", () => {
    const h = buildContainsHierarchy(nodes, edges);
    const empty = new Set<string>();
    const collapsed = new Set(["root"]);
    const visible = computeVisibleIds(h.roots, h.childrenOf, (id) =>
      isEffectivelyExpanded(id, 2, h.depthMap, empty, collapsed),
    );
    expect([...visible]).toEqual(["root"]);
  });
});
