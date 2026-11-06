import { $getNodeByKey, createEditor } from "lexical";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __toCommonJS = (mod) => __hasOwnProp.call(mod, "module.exports") ? mod["module.exports"] : __copyProps(__defProp({}, "__esModule", { value: true }), mod);
//#endregion
//#region src/editor-kernel/utils.ts
function genServiceId(name) {
	return { __serviceId: name };
}
function createEmptyEditorState() {
	return createEditor().getEditorState();
}
function assert(cond, message) {
	if (cond) return;
	throw new Error(message);
}
function getNodeKeyFromDOMNode(dom, editor) {
	return dom[`__lexicalKey_${editor._key}`];
}
function $getNodeFromDOMNode(dom, editor, editorState) {
	const key = getNodeKeyFromDOMNode(dom, editor);
	if (key !== void 0) return $getNodeByKey(key, editorState);
	return null;
}
/**
* @param x - The element being tested
* @returns Returns true if x is a DOM Node, false otherwise.
*/
function isDOMNode(x) {
	return typeof x === "object" && x !== null && "nodeType" in x && typeof x.nodeType === "number";
}
/**
* @param x - The element being testing
* @returns Returns true if x is a document fragment, false otherwise.
*/
function isDocumentFragment(x) {
	return isDOMNode(x) && x.nodeType === 11;
}
function getParentElement(node) {
	const parentElement = node.assignedSlot || node.parentElement;
	return isDocumentFragment(parentElement) ? parentElement.host : parentElement;
}
function $getNearestNodeFromDOMNode$1(startingDOM, editor, editorState) {
	let dom = startingDOM;
	while (dom !== null) {
		const node = $getNodeFromDOMNode(dom, editor, editorState);
		if (node !== null) return node;
		dom = getParentElement(dom);
	}
	return null;
}
function getKernelFromEditor(editor) {
	return editor._createEditorArgs?.__kernel || editor._kernel;
}
function generateEditorId() {
	EditorId += 1;
	return `editor-${EditorId}`;
}
function registerEditorKernel(id, kernel) {
	EditorMap.set(id, kernel);
}
function unregisterEditorKernel(id) {
	EditorMap.delete(id);
}
function getKernelFromEditorConfig(config) {
	const id = config.theme[EDITOR_THEME_KEY];
	return EditorMap.get(id) || null;
}
/**
*
* @param nodeA
* @param nodeB
* @returns
*/
function compareNodeOrder(nodeA, nodeB) {
	if (nodeA === nodeB) return 0;
	const pathA = [];
	const pathB = [];
	let currentA = nodeA;
	let currentB = nodeB;
	while (currentA) {
		pathA.unshift(currentA);
		currentA = currentA.getParent();
	}
	while (currentB) {
		pathB.unshift(currentB);
		currentB = currentB.getParent();
	}
	const minLength = Math.min(pathA.length, pathB.length);
	for (let i = 0; i < minLength; i++) if (pathA[i] !== pathB[i]) {
		const siblings = pathA[i].getParent()?.getChildren() || [];
		return siblings.indexOf(pathA[i]) - siblings.indexOf(pathB[i]);
	}
	if (pathA.length !== pathB.length) return pathA.length - pathB.length;
	return 0;
}
function $closest(node, test) {
	let current = node;
	while (current) {
		if (test(current)) return current;
		current = current.getParent();
	}
	return null;
}
function $closestNodeType(node, type) {
	return $closest(node, (n) => Array.isArray(type) ? type.includes(n.getType()) : n.getType() === type);
}
function moment() {
	return new Promise((resolve) => {
		queueMicrotask(() => resolve(true));
	});
}
function cloneDecorators(editor) {
	const currentDecorators = editor._decorators;
	const pendingDecorators = Object.assign({}, currentDecorators);
	editor._pendingDecorators = pendingDecorators;
	return pendingDecorators;
}
function reconcileDecorator(activeEditor, key, decorator) {
	let pendingDecorators = activeEditor._pendingDecorators;
	const currentDecorators = activeEditor._decorators;
	if (pendingDecorators === null) {
		if (currentDecorators[key] === decorator) return;
		pendingDecorators = cloneDecorators(activeEditor);
	}
	pendingDecorators[key] = decorator;
}
var DOM_ELEMENT_TYPE, DOM_TEXT_TYPE, DOM_DOCUMENT_TYPE, DOM_DOCUMENT_FRAGMENT_TYPE, noop, EditorId, EDITOR_THEME_KEY, EditorMap;
var init_utils = __esmMin((() => {
	DOM_ELEMENT_TYPE = 1;
	DOM_TEXT_TYPE = 3;
	DOM_DOCUMENT_TYPE = 9;
	DOM_DOCUMENT_FRAGMENT_TYPE = 11;
	noop = () => {};
	EditorId = 0;
	EDITOR_THEME_KEY = "__editorId";
	EditorMap = /* @__PURE__ */ new Map();
}));
//#endregion
export { __toCommonJS as A, noop as C, __commonJSMin as D, unregisterEditorKernel as E, __esmMin as O, moment as S, registerEditorKernel as T, getNodeKeyFromDOMNode as _, DOM_DOCUMENT_FRAGMENT_TYPE as a, isDOMNode as b, DOM_TEXT_TYPE as c, compareNodeOrder as d, createEmptyEditorState as f, getKernelFromEditorConfig as g, getKernelFromEditor as h, $getNodeFromDOMNode as i, __toESM as j, __exportAll as k, EDITOR_THEME_KEY as l, generateEditorId as m, $closestNodeType as n, DOM_DOCUMENT_TYPE as o, genServiceId as p, $getNearestNodeFromDOMNode$1 as r, DOM_ELEMENT_TYPE as s, $closest as t, assert as u, getParentElement as v, reconcileDecorator as w, isDocumentFragment as x, init_utils as y };
