/**
 * mdocs Shiki facade — whitelisted languages, lazy per-lang chunks.
 * App code: `import { codeToHtml } from "@shiki"`.
 * Third-party `import from "shiki"` is redirected here via Vite alias (shiki-shim.ts).
 */
import {
  createBundledHighlighter,
  createCssVariablesTheme,
  createSingletonShorthands,
  getTokenStyleObject,
  normalizeTheme,
  stringifyTokenStyle,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { createOnigurumaEngine, loadWasm } from "shiki/engine/oniguruma";
import { bundledThemes, bundledThemesInfo } from "shiki/themes";

import type { DynamicImportLanguageRegistration } from "shiki/types";

import {
  bundledLanguages,
  bundledLanguagesBaseExport as bundledLanguagesBase,
  bundledLanguagesInfo,
  supportedLanguagesInfo,
} from "./supported-languages";

export {
  bundledThemes,
  bundledThemesInfo,
  bundledLanguages,
  bundledLanguagesInfo,
  bundledLanguagesBase,
  supportedLanguagesInfo,
  createCssVariablesTheme,
  normalizeTheme,
  getTokenStyleObject,
  stringifyTokenStyle,
  createJavaScriptRegexEngine,
  createOnigurumaEngine,
  loadWasm,
};

export const bundledLanguagesAlias = Object.fromEntries(
  bundledLanguagesInfo.flatMap((item) => item.aliases?.map((alias) => [alias, item.id]) ?? []),
);

const createHighlighter = createBundledHighlighter({
  langs: bundledLanguages as Record<string, DynamicImportLanguageRegistration>,
  themes: bundledThemes,
  engine: createJavaScriptRegexEngine,
});

export const {
  codeToHtml,
  codeToHast,
  codeToTokensBase,
  codeToTokens,
  codeToTokensWithThemes,
  getSingletonHighlighter,
  getLastGrammarState,
} = createSingletonShorthands(createHighlighter);

export { createHighlighter };
