/**
 * 图谱分层展开：按 contains 骨架裁剪可见子图（纯函数，无 React）。
 * 契约：.mdocs-docs/requirements/knowledge-graph/设计契约-layered-view.md
 */

export type GlobalDepth = 0 | 1 | 2;

export function isContainsEdge(type: string): boolean {
  return type === "contains";
}

export function isOtherRelationEdge(type: string): boolean {
  return type === "related_to" || type === "part_of" || type === "depends_on";
}

export function buildContainsHierarchy(
  nodeIds: string[],
  containsEdges: Array<{ from: string; to: string }>,
): {
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  roots: string[];
  depthMap: Map<string, number>;
} {
  const idSet = new Set(nodeIds);
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    childrenOf.set(id, []);
    parentsOf.set(id, []);
    inDegree.set(id, 0);
  }

  for (const e of containsEdges) {
    if (!idSet.has(e.from) || !idSet.has(e.to) || e.from === e.to) continue;
    childrenOf.get(e.from)!.push(e.to);
    parentsOf.get(e.to)!.push(e.from);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  let roots = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  if (roots.length === 0 && nodeIds.length > 0) {
    // 纯环：度数最高的一批作种子
    const degree = new Map<string, number>();
    for (const id of nodeIds) {
      degree.set(
        id,
        (childrenOf.get(id)?.length ?? 0) + (parentsOf.get(id)?.length ?? 0),
      );
    }
    const ranked = [...nodeIds].sort(
      (a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0),
    );
    const topDeg = degree.get(ranked[0]!) ?? 0;
    roots = ranked.filter((id) => (degree.get(id) ?? 0) === topDeg).slice(0, 12);
  }

  // 最短深度（多父取最小）
  const depthMap = new Map<string, number>();
  const queue: string[] = [];
  for (const r of roots) {
    depthMap.set(r, 0);
    queue.push(r);
  }
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const d = depthMap.get(cur) ?? 0;
    for (const next of childrenOf.get(cur) ?? []) {
      const nd = d + 1;
      if (!depthMap.has(next) || nd < (depthMap.get(next) ?? Infinity)) {
        depthMap.set(next, nd);
        queue.push(next);
      }
    }
  }
  for (const id of nodeIds) {
    if (!depthMap.has(id)) depthMap.set(id, 0);
  }

  return { childrenOf, parentsOf, roots, depthMap };
}

export function isEffectivelyExpanded(
  id: string,
  globalDepth: GlobalDepth,
  depthMap: Map<string, number>,
  extraExpandedIds: ReadonlySet<string>,
  collapsedIds: ReadonlySet<string>,
): boolean {
  if (collapsedIds.has(id)) return false;
  if ((depthMap.get(id) ?? 0) < globalDepth) return true;
  return extraExpandedIds.has(id);
}

export function computeVisibleIds(
  roots: string[],
  childrenOf: Map<string, string[]>,
  isExpanded: (id: string) => boolean,
): Set<string> {
  const visible = new Set<string>(roots);
  const queue = [...roots];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    if (!isExpanded(cur)) continue;
    for (const child of childrenOf.get(cur) ?? []) {
      if (visible.has(child)) continue;
      visible.add(child);
      queue.push(child);
    }
  }
  return visible;
}

/** 沿 contains 父链向上（含自身的父），用于详情里点子节点时揭示路径 */
export function containsAncestors(
  nodeId: string,
  parentsOf: Map<string, string[]>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [...(parentsOf.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const p of parentsOf.get(id) ?? []) stack.push(p);
  }
  return out;
}
