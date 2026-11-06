import { r as useLexicalComposerContext } from "./react-context-DwwzSNVm.js";
import { useCallback, useSyncExternalStore } from "react";
//#region src/react/hooks/useEditorLocale/index.ts
let localeVersion = 0;
const listeners = /* @__PURE__ */ new Set();
function subscribeToLocale(callback) {
	listeners.add(callback);
	return () => {
		listeners.delete(callback);
	};
}
function getLocaleVersion() {
	return localeVersion;
}
function notifyLocaleChange() {
	localeVersion++;
	listeners.forEach((fn) => fn());
}
/**
* React hook for editor locale access.
*
* Usage inside editor tree:
* ```tsx
* const { t, setLocale } = useEditorLocale();
* setLocale(zhCN);
* ```
*
* Usage with explicit editor instance (outside editor context):
* ```tsx
* const { t, setLocale } = useEditorLocale(editor);
* ```
*/
function useEditorLocale(editor) {
	let ctxEditor = null;
	try {
		const [composerEditor] = useLexicalComposerContext();
		ctxEditor = composerEditor;
	} catch {}
	const targetEditor = editor || ctxEditor;
	if (!targetEditor) throw new Error("[useEditorLocale] No editor found. Pass an editor instance or use this hook inside an <Editor> tree.");
	useSyncExternalStore(subscribeToLocale, getLocaleVersion, getLocaleVersion);
	return {
		setLocale: useCallback((locale) => {
			targetEditor.setLocale(locale);
			notifyLocaleChange();
		}, [targetEditor]),
		t: useCallback((key, params) => {
			return targetEditor.t(key, params);
		}, [targetEditor])
	};
}
//#endregion
export { useEditorLocale as t };
