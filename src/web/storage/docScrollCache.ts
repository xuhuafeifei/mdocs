/**
 * 文档滚动位置：进程内 LRU，最多 10 篇。
 * 不写 localStorage / IndexedDB，刷新或 App 重启即丢。
 */

export const DOC_SCROLL_CACHE_MAX = 10;

export interface DocScrollPosition {
  scrollTop: number;
  scrollLeft: number;
}

/** Map 插入序 = LRU：读/写时挪到末尾，超限删最旧。 */
const cache = new Map<string, DocScrollPosition>();

export function getDocScroll(documentId: string): DocScrollPosition | null {
  const id = documentId.trim();
  if (!id) return null;
  const hit = cache.get(id);
  if (!hit) return null;
  cache.delete(id);
  cache.set(id, hit);
  return { ...hit };
}

export function setDocScroll(
  documentId: string,
  scrollTop: number,
  scrollLeft = 0,
): void {
  const id = documentId.trim();
  if (!id) return;
  const top = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const left = Number.isFinite(scrollLeft) ? Math.max(0, scrollLeft) : 0;
  if (top === 0 && left === 0) {
    cache.delete(id);
    return;
  }
  cache.delete(id);
  cache.set(id, { scrollTop: top, scrollLeft: left });
  while (cache.size > DOC_SCROLL_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** 仅测试 / 调试用 */
export function clearDocScrollCache(): void {
  cache.clear();
}

/** 仅测试用 */
export function docScrollCacheSize(): number {
  return cache.size;
}

/** 仅测试用：从旧到新的 documentId */
export function docScrollCacheKeys(): string[] {
  return [...cache.keys()];
}
