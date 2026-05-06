/**
 * 国际化（i18n）上下文
 * 支持中英文切换，语言偏好持久化到 localStorage，并同步到 <html lang> 属性。
 * 默认根据浏览器语言自动检测。
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { TranslationKey } from "./types";
import { en } from "./locales/en";
import { zh } from "./locales/zh";

// ---- localStorage 键名 ----
const STORAGE_KEY = "mdocs.lang";

// ---- 语言字典 ----
const dictionaries = { en, zh };

export type Lang = "en" | "zh";

/**
 * 检测当前语言：优先取 localStorage 缓存，其次按浏览器语言自动识别，默认英文。
 */
function detectLang(): Lang {
  // 先尝试从 localStorage 读取用户之前的语言选择
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "zh" || stored === "en") return stored;
  // 如果没有缓存，根据浏览器语言判断
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  return "en";
}

export interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
}

// ---- 创建上下文 ----
const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  // 使用 detectLang 初始化语言状态
  const [lang, setLangState] = useState<Lang>(detectLang);

  /**
   * 同步 HTML lang 属性，便于屏幕阅读器和搜索引擎识别。
   */
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  /**
   * 切换语言并持久化到 localStorage。
   */
  const setLang = useCallback((next: Lang) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  /**
   * 翻译函数：按当前语言查找文本，并替换 {{变量}} 占位符。
   * 若键不存在则回退显示键名本身。
   */
  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string>) => {
      // 从当前语言字典中查找文本，找不到则回退显示键名
      let text = dictionaries[lang][key] ?? key;
      if (vars) {
        // 替换所有 {{变量名}} 为对应的值
        for (const [k, v] of Object.entries(vars)) {
          text = text.replaceAll(`{{${k}}}`, v);
        }
      }
      return text;
    },
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

/**
 * 在组件中获取国际化上下文，必须在 I18nProvider 内部使用。
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
