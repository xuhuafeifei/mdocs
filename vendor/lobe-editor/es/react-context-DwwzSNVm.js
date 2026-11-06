import { u as assert, y as init_utils } from "./utils-DR6xvOCh.js";
import { createContext, use } from "react";
//#region src/editor-kernel/react/react-context.ts
init_utils();
const LexicalComposerContext = createContext(null);
function createLexicalComposerContext(parent, theme) {
	let parentContext = null;
	if (parent) parentContext = parent[1];
	function getTheme() {
		if (theme !== null) return theme;
		return parentContext !== null ? parentContext.getTheme() : null;
	}
	return { getTheme };
}
function useLexicalComposerContext() {
	const composerContext = use(LexicalComposerContext);
	if (!composerContext) assert(false, "LexicalComposerContext.useLexicalComposerContext: cannot find a LexicalComposerContext");
	return composerContext;
}
//#endregion
export { createLexicalComposerContext as n, useLexicalComposerContext as r, LexicalComposerContext as t };
