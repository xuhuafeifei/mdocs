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

export const codeToHtml: Runtime["codeToHtml"] = ((...args) =>
  loadRuntime().then((m) => m.codeToHtml(...args))) as Runtime["codeToHtml"];

export const codeToHast: Runtime["codeToHast"] = ((...args) =>
  loadRuntime().then((m) => m.codeToHast(...args))) as Runtime["codeToHast"];

export const codeToTokens: Runtime["codeToTokens"] = ((...args) =>
  loadRuntime().then((m) => m.codeToTokens(...args))) as Runtime["codeToTokens"];

export const codeToTokensBase: Runtime["codeToTokensBase"] = ((...args) =>
  loadRuntime().then((m) => m.codeToTokensBase(...args))) as Runtime["codeToTokensBase"];

export const codeToTokensWithThemes: Runtime["codeToTokensWithThemes"] = ((...args) =>
  loadRuntime().then((m) => m.codeToTokensWithThemes(...args))) as Runtime["codeToTokensWithThemes"];

export const getSingletonHighlighter: Runtime["getSingletonHighlighter"] = ((...args) =>
  loadRuntime().then((m) => m.getSingletonHighlighter(...args))) as Runtime["getSingletonHighlighter"];

export const getLastGrammarState: Runtime["getLastGrammarState"] = ((...args) =>
  loadRuntime().then((m) => m.getLastGrammarState(...args))) as Runtime["getLastGrammarState"];

export const createHighlighter: Runtime["createHighlighter"] = ((...args) =>
  loadRuntime().then((m) => m.createHighlighter(...args))) as Runtime["createHighlighter"];
