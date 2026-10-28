/**
 * Vite alias target for bare `import from "shiki"` (e.g. @lobehub/ui Highlighter).
 * Keep this module light: metadata + lazy runtime. Eagerly re-exporting `./index`
 * pulls every theme/lang into the @lobehub/ui optimizeDeps chunk (~16MB) and
 * freezes the first paint on "加载中...".
 */
export { bundledThemes, bundledThemesInfo } from "shiki/themes";
export {
  createCssVariablesTheme,
  normalizeTheme,
  getTokenStyleObject,
  stringifyTokenStyle,
} from "shiki/core";
export { createJavaScriptRegexEngine } from "shiki/engine/javascript";
export { createOnigurumaEngine, loadWasm } from "shiki/engine/oniguruma";
import {
  bundledLanguages,
  bundledLanguagesBaseExport as bundledLanguagesBase,
  bundledLanguagesInfo,
  supportedLanguagesInfo,
} from "./supported-languages";

export {
  bundledLanguages,
  bundledLanguagesBase,
  bundledLanguagesInfo,
  supportedLanguagesInfo,
};

export const bundledLanguagesAlias = Object.fromEntries(
  bundledLanguagesInfo.flatMap((item) => item.aliases?.map((alias) => [alias, item.id]) ?? []),
);

type Runtime = typeof import("./index");

let runtimePromise: Promise<Runtime> | null = null;

function loadRuntime(): Promise<Runtime> {
  if (!runtimePromise) runtimePromise = import("./index");
  return runtimePromise;
}

// lobehub only needs these via dynamic `import("shiki")`; keep typings loose.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const codeToHtml = ((...args: any[]) =>
  loadRuntime().then((m) => (m.codeToHtml as any)(...args))) as any;
export const codeToHast = ((...args: any[]) =>
  loadRuntime().then((m) => (m.codeToHast as any)(...args))) as any;
export const codeToTokens = ((...args: any[]) =>
  loadRuntime().then((m) => (m.codeToTokens as any)(...args))) as any;
export const codeToTokensBase = ((...args: any[]) =>
  loadRuntime().then((m) => (m.codeToTokensBase as any)(...args))) as any;
export const codeToTokensWithThemes = ((...args: any[]) =>
  loadRuntime().then((m) => (m.codeToTokensWithThemes as any)(...args))) as any;
export const getSingletonHighlighter = ((...args: any[]) =>
  loadRuntime().then((m) => (m.getSingletonHighlighter as any)(...args))) as any;
export const getLastGrammarState = ((...args: any[]) =>
  loadRuntime().then((m) => (m.getLastGrammarState as any)(...args))) as any;
export const createHighlighter = ((...args: any[]) =>
  loadRuntime().then((m) => (m.createHighlighter as any)(...args))) as any;
/* eslint-enable @typescript-eslint/no-explicit-any */
