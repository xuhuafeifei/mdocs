/**
 * 编辑工作台访客偏好（localStorage）：标签钉住、Lobe 工具栏、大纲默认。
 * 默认：标签钉住开、Lobe 关、大纲关。
 */

const TABS_PINNED_KEY = "mdocs.workbench.tabsPinned";
const LOBE_TOOLBAR_KEY = "mdocs.workbench.lobeToolbar";
const OUTLINE_KEY = "mdocs.workbench.outline";

function readBool(key: string, defaultValue: boolean): boolean {
  if (typeof localStorage === "undefined") return defaultValue;
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw === "1";
}

function writeBool(key: string, value: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, value ? "1" : "0");
}

/** 默认 true：标签栏常驻 */
export function loadTabsPinned(): boolean {
  return readBool(TABS_PINNED_KEY, true);
}

export function saveTabsPinned(pinned: boolean): void {
  writeBool(TABS_PINNED_KEY, pinned);
}

/** 默认 false：不显示 Lobe 格式工具栏 */
export function loadLobeToolbarVisible(): boolean {
  return readBool(LOBE_TOOLBAR_KEY, false);
}

export function saveLobeToolbarVisible(visible: boolean): void {
  writeBool(LOBE_TOOLBAR_KEY, visible);
}

/** 默认 false：大纲收起 */
export function loadOutlineVisible(): boolean {
  return readBool(OUTLINE_KEY, false);
}

export function saveOutlineVisible(visible: boolean): void {
  writeBool(OUTLINE_KEY, visible);
}
