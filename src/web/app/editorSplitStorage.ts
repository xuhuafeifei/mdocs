/** PC 中间上下分屏：本地比例 / 是否开启 / 下栏文档 id */

const OPEN_KEY = "mdocs.editorSplitOpen";
const RATIO_KEY = "mdocs.editorSplitRatio";
const SECONDARY_ID_KEY = "mdocs.editorSplitSecondaryId";

export function loadEditorSplitOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveEditorSplitOpen(open: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function loadEditorSplitRatio(): number {
  try {
    const raw = localStorage.getItem(RATIO_KEY);
    const n = raw ? Number(raw) : 0.5;
    if (!Number.isFinite(n)) return 0.5;
    return Math.min(0.75, Math.max(0.25, n));
  } catch {
    return 0.5;
  }
}

export function saveEditorSplitRatio(ratio: number): void {
  try {
    localStorage.setItem(RATIO_KEY, String(Math.min(0.75, Math.max(0.25, ratio))));
  } catch {
    /* ignore */
  }
}

export function loadEditorSplitSecondaryId(): string | null {
  try {
    const id = localStorage.getItem(SECONDARY_ID_KEY)?.trim();
    return id || null;
  } catch {
    return null;
  }
}

export function saveEditorSplitSecondaryId(id: string | null): void {
  try {
    if (!id) localStorage.removeItem(SECONDARY_ID_KEY);
    else localStorage.setItem(SECONDARY_ID_KEY, id);
  } catch {
    /* ignore */
  }
}
