/**
 * PC「最近打开」标签：上/下栏各自稳定顺序列表 + 布局模式（固定 / 覆盖）。
 * 新文档追加到对应栏末尾；再次打开只更新元数据，不改变相对顺序。
 * 同一 documentId 不会同时出现在上下两栏。
 */
export type RecentDocTab = {
  documentId: string;
  displayName: string;
  domainId: string;
  /** md | html | sheet；缺省按 md */
  fileType: string;
};

export type RecentTabsPane = "primary" | "secondary";

export type RecentDocTabsByPane = {
  primary: RecentDocTab[];
  secondary: RecentDocTab[];
};

const LIST_KEY_V1 = "mdocs.recentTabs.v1";
const LIST_KEY = "mdocs.recentTabs.v2";
const MAX = 12;

function normalizeFileType(raw: unknown): string {
  if (raw === "html" || raw === "sheet" || raw === "md") return raw;
  return "md";
}

function parseTabList(raw: unknown): RecentDocTab[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentDocTab[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (
      typeof o.documentId !== "string" ||
      !o.documentId.trim() ||
      typeof o.displayName !== "string" ||
      typeof o.domainId !== "string"
    ) {
      continue;
    }
    out.push({
      documentId: o.documentId.trim(),
      displayName: o.displayName,
      domainId: o.domainId,
      fileType: normalizeFileType(o.fileType),
    });
  }
  return out.slice(0, MAX);
}

function emptyByPane(): RecentDocTabsByPane {
  return { primary: [], secondary: [] };
}

export function loadRecentDocTabsByPane(): RecentDocTabsByPane {
  if (typeof localStorage === "undefined") return emptyByPane();
  const v2 = localStorage.getItem(LIST_KEY);
  if (v2) {
    try {
      const parsed = JSON.parse(v2) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const o = parsed as Record<string, unknown>;
        return {
          primary: parseTabList(o.primary),
          secondary: parseTabList(o.secondary),
        };
      }
    } catch {
      /* fall through */
    }
  }
  // 迁移 v1 扁平列表 → primary
  const v1 = localStorage.getItem(LIST_KEY_V1);
  if (v1) {
    const primary = parseTabList(JSON.parse(v1) as unknown);
    const next = { primary, secondary: [] as RecentDocTab[] };
    saveRecentDocTabsByPane(next);
    return next;
  }
  return emptyByPane();
}

export function saveRecentDocTabsByPane(state: RecentDocTabsByPane): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    LIST_KEY,
    JSON.stringify({
      primary: state.primary.slice(0, MAX),
      secondary: state.secondary.slice(0, MAX),
    }),
  );
}

function touchInList(list: RecentDocTab[], tab: RecentDocTab): RecentDocTab[] {
  const normalized = { ...tab, fileType: normalizeFileType(tab.fileType) };
  const idx = list.findIndex((t) => t.documentId === normalized.documentId);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = {
      documentId: list[idx]!.documentId,
      displayName: normalized.displayName,
      domainId: normalized.domainId,
      fileType: normalized.fileType,
    };
    return next;
  }
  const next = [...list, normalized];
  while (next.length > MAX) next.shift();
  return next;
}

/** 打开成功：写入目标栏；并从另一栏移除同 id */
export function touchRecentDocTab(
  pane: RecentTabsPane,
  tab: RecentDocTab,
): RecentDocTabsByPane {
  const prev = loadRecentDocTabsByPane();
  const other: RecentTabsPane = pane === "primary" ? "secondary" : "primary";
  const next: RecentDocTabsByPane = {
    primary: pane === "primary" ? touchInList(prev.primary, tab) : prev.primary.filter((t) => t.documentId !== tab.documentId),
    secondary:
      pane === "secondary"
        ? touchInList(prev.secondary, tab)
        : prev.secondary.filter((t) => t.documentId !== tab.documentId),
  };
  // 上面分支已正确；再保险：other 栏必无此 id
  next[other] = next[other].filter((t) => t.documentId !== tab.documentId);
  saveRecentDocTabsByPane(next);
  return next;
}

export function removeRecentDocTab(
  pane: RecentTabsPane,
  documentId: string,
): RecentDocTabsByPane {
  const prev = loadRecentDocTabsByPane();
  const next: RecentDocTabsByPane = {
    primary: pane === "primary" ? prev.primary.filter((t) => t.documentId !== documentId) : prev.primary,
    secondary:
      pane === "secondary" ? prev.secondary.filter((t) => t.documentId !== documentId) : prev.secondary,
  };
  saveRecentDocTabsByPane(next);
  return next;
}

/** 下栏升格：secondary 列表并入 primary（并清空 secondary） */
export function promoteSecondaryTabsToPrimary(): RecentDocTabsByPane {
  const prev = loadRecentDocTabsByPane();
  const ids = new Set(prev.secondary.map((t) => t.documentId));
  const merged = [
    ...prev.secondary,
    ...prev.primary.filter((t) => !ids.has(t.documentId)),
  ].slice(0, MAX);
  const next = { primary: merged, secondary: [] as RecentDocTab[] };
  saveRecentDocTabsByPane(next);
  return next;
}

export function clearSecondaryRecentDocTabs(): RecentDocTabsByPane {
  const prev = loadRecentDocTabsByPane();
  const next = { primary: prev.primary, secondary: [] as RecentDocTab[] };
  saveRecentDocTabsByPane(next);
  return next;
}
