/**
 * 编辑器实验性/可选功能开关（localStorage）。
 * 设置页「功能」栏目通过 {@link EDITOR_FEATURE_TOGGLES} 注册。
 */

import type { TranslationKey } from "../i18n/types";

const SELECT_ALL_SKIP_H1_KEY = "mdocs.features.selectAllSkipLeadingH1";

function readBool(key: string, defaultValue: boolean): boolean {
  if (typeof localStorage === "undefined") return defaultValue;
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw === "1" || raw === "true";
}

function writeBool(key: string, value: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, value ? "1" : "0");
}

/** 正文 Cmd/Ctrl+A 时若首块为 H1 则不选中该标题（默认开） */
export function loadSelectAllSkipLeadingH1(): boolean {
  return readBool(SELECT_ALL_SKIP_H1_KEY, true);
}

export function saveSelectAllSkipLeadingH1(enabled: boolean): void {
  writeBool(SELECT_ALL_SKIP_H1_KEY, enabled);
}

export type EditorFeatureToggleId = "selectAllSkipLeadingH1";

export type EditorFeatureToggleDef = {
  id: EditorFeatureToggleId;
  defaultEnabled: boolean;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  load: () => boolean;
  save: (enabled: boolean) => void;
};

/** 供设置页渲染的可注册功能列表 */
export const EDITOR_FEATURE_TOGGLES: EditorFeatureToggleDef[] = [
  {
    id: "selectAllSkipLeadingH1",
    defaultEnabled: true,
    titleKey: "featureSelectAllSkipLeadingH1",
    descKey: "featureSelectAllSkipLeadingH1Desc",
    load: loadSelectAllSkipLeadingH1,
    save: saveSelectAllSkipLeadingH1,
  },
];
