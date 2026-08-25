/**
 * 图谱工具函数：id 生成、slug 归一化等纯逻辑。
 */

/**
 * 将 label 归一化为 slug。
 * - 去首尾空格
 * - 转小写（只转英文字母）
 * - 中文/英文/数字保留
 * - 其他字符替换为 -，连续 - 合并
 */
export function slugify(label: string): string {
  return label
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** 生成节点 id（末尾带 4 位随机数，保证唯一） */
export function makeNodeId(type: 'doc' | 'concept', label: string): string {
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${type}:${slugify(label)}-${rand}`;
}

/** 增量判断：当前 commit 与缓存的 commit 不同就需要重建 */
export function needRebuild(currentCommitId: string, cachedCommitId?: string): boolean {
  if (!cachedCommitId) return true;
  return currentCommitId !== cachedCommitId;
}

/**
 * 找出所有「入度为 0」的节点（没有被任何边指向的节点）。
 *
 * 用于自底向上构建时：每层只把顶层节点（入度为 0）喂给 AI 归纳 concept / 生成 contains，
 * 下层已经有父节点的节点不参与本层归纳，避免重复处理。
 */
export function findRootNodes<T extends { id: string }>(
  nodes: T[],
  edges: Array<{ to: string }>,
): T[] {
  const nonRootIds = new Set(edges.map((e) => e.to));
  return nodes.filter((n) => !nonRootIds.has(n.id));
}

