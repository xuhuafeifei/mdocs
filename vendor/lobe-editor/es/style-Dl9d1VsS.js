import { h as getKernelFromEditor, y as init_utils } from "./utils-DR6xvOCh.js";
import { $applyNodeReplacement, DecoratorNode, ElementNode } from "lexical";
import { addClassNamesToElement } from "@lexical/utils";
import { jsx, jsxs } from "react/jsx-runtime";
import { Component, memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mermaid } from "@lobehub/ui";
import { createStaticStyles, cx } from "antd-style";
//#region src/plugins/common/react/MermaidWithErrorBoundary.tsx
/** Lazy-load mermaid so the ~3MB diagram chunk is not on first paint. */
let mermaidLoader = null;
function loadMermaid() {
	if (!mermaidLoader) mermaidLoader = import("mermaid").then((mod) => {
		const mermaid = mod.default;
		mermaid.initialize({
			securityLevel: "strict",
			startOnLoad: false
		});
		return mermaid;
	});
	return mermaidLoader;
}
var MermaidRenderErrorBoundary = class extends Component {
	constructor(props) {
		super(props);
		this.state = {
			error: null,
			hasError: false
		};
	}
	static getDerivedStateFromError(error) {
		return {
			error,
			hasError: true
		};
	}
	componentDidUpdate(prevProps) {
		if (prevProps.code !== this.props.code) this.setState({
			error: null,
			hasError: false
		});
	}
	render() {
		if (this.state.hasError && this.state.error) return this.props.fallback?.(this.state.error) ?? null;
		return this.props.children;
	}
};
const ErrorFallback = memo(({ error }) => {
	const errorMsg = error.message || "Mermaid 渲染失败，请检查语法";
	return /* @__PURE__ */ jsxs("div", {
		style: {
			background: "rgba(255, 77, 79, 0.08)",
			border: "1px solid rgba(255, 77, 79, 0.3)",
			borderRadius: 8,
			padding: 16,
			width: "100%"
		},
		children: [/* @__PURE__ */ jsx("div", {
			style: {
				color: "#ff4d4f",
				fontSize: 14,
				fontWeight: 500,
				marginBottom: 8
			},
			children: "⚠️ Mermaid 渲染失败"
		}), /* @__PURE__ */ jsx("div", {
			style: {
				color: "#ff7875",
				fontSize: 12,
				lineHeight: 1.6,
				whiteSpace: "pre-wrap",
				wordBreak: "break-all"
			},
			children: errorMsg
		})]
	});
});
const MIN_SCALE = .2;
const MAX_SCALE = 10;
const SCALE_STEP = .25;
const clampScale = (v) => Math.min(Math.max(MIN_SCALE, v), MAX_SCALE);
const SvgPreviewOverlay = ({ onClose, svg }) => {
	const [scale, setScale] = useState(1);
	const [offset, setOffset] = useState({
		x: 0,
		y: 0
	});
	const [dragging, setDragging] = useState(false);
	const lastPosRef = useRef({
		x: 0,
		y: 0
	});
	const hasDraggedRef = useRef(false);
	const backdropRef = useRef(null);
	const zoomIn = useCallback(() => setScale((s) => clampScale(s + SCALE_STEP)), []);
	const zoomOut = useCallback(() => setScale((s) => clampScale(s - SCALE_STEP)), []);
	const resetZoom = useCallback(() => {
		setScale(1);
		setOffset({
			x: 0,
			y: 0
		});
	}, []);
	useEffect(() => {
		const el = backdropRef.current;
		if (!el) return;
		const handler = (e) => {
			e.preventDefault();
			setScale((prev) => clampScale(prev * (e.deltaY > 0 ? .9 : 1.1)));
		};
		el.addEventListener("wheel", handler, { passive: false });
		return () => el.removeEventListener("wheel", handler);
	}, []);
	useEffect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, []);
	useEffect(() => {
		const handler = (e) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);
	const handlePointerDown = useCallback((e) => {
		e.preventDefault();
		e.currentTarget.setPointerCapture(e.pointerId);
		setDragging(true);
		hasDraggedRef.current = false;
		lastPosRef.current = {
			x: e.clientX,
			y: e.clientY
		};
	}, []);
	const handlePointerMove = useCallback((e) => {
		if (!dragging) return;
		const dx = e.clientX - lastPosRef.current.x;
		const dy = e.clientY - lastPosRef.current.y;
		if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasDraggedRef.current = true;
		lastPosRef.current = {
			x: e.clientX,
			y: e.clientY
		};
		setOffset((prev) => ({
			x: prev.x + dx,
			y: prev.y + dy
		}));
	}, [dragging]);
	const handlePointerUp = useCallback(() => {
		setDragging(false);
	}, []);
	const handleBackdropClick = useCallback(() => {
		if (hasDraggedRef.current) {
			hasDraggedRef.current = false;
			return;
		}
		onClose();
	}, [onClose]);
	const pct = `${Math.round(scale * 100)}%`;
	const btnBase = {
		alignItems: "center",
		background: "rgba(255,255,255,0.15)",
		border: "none",
		borderRadius: 4,
		color: "#fff",
		cursor: "pointer",
		display: "inline-flex",
		fontSize: 14,
		height: 32,
		justifyContent: "center",
		lineHeight: 1,
		minWidth: 32,
		padding: "0 8px"
	};
	return createPortal(/* @__PURE__ */ jsxs("div", {
		onClick: handleBackdropClick,
		ref: backdropRef,
		style: {
			alignItems: "center",
			background: "rgba(0, 0, 0, 0.65)",
			display: "flex",
			inset: 0,
			justifyContent: "center",
			position: "fixed",
			zIndex: 1080
		},
		children: [
			/* @__PURE__ */ jsx("button", {
				"aria-label": "Close preview",
				onClick: (e) => {
					e.stopPropagation();
					onClose();
				},
				style: {
					...btnBase,
					background: "rgba(255,255,255,0.12)",
					height: 40,
					minWidth: 40,
					position: "absolute",
					right: 16,
					top: 16,
					zIndex: 2
				},
				type: "button",
				children: /* @__PURE__ */ jsx("svg", {
					fill: "none",
					height: "18",
					stroke: "currentColor",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					strokeWidth: "2",
					viewBox: "0 0 24 24",
					width: "18",
					children: /* @__PURE__ */ jsx("path", { d: "M18 6 6 18M6 6l12 12" })
				})
			}),
			/* @__PURE__ */ jsx("div", {
				onClick: (e) => e.stopPropagation(),
				onPointerDown: handlePointerDown,
				onPointerMove: handlePointerMove,
				onPointerUp: handlePointerUp,
				style: {
					background: "#fff",
					borderRadius: 8,
					cursor: dragging ? "grabbing" : "grab",
					padding: 24,
					transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
					transformOrigin: "center center",
					userSelect: "none"
				},
				children: /* @__PURE__ */ jsx("div", {
					dangerouslySetInnerHTML: { __html: svg },
					style: { pointerEvents: "none" }
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				onClick: (e) => e.stopPropagation(),
				style: {
					alignItems: "center",
					background: "rgba(0, 0, 0, 0.55)",
					borderRadius: 8,
					bottom: 24,
					display: "flex",
					gap: 4,
					left: "50%",
					padding: "4px 8px",
					position: "absolute",
					transform: "translateX(-50%)",
					zIndex: 2
				},
				children: [
					/* @__PURE__ */ jsx("button", {
						"aria-label": "Zoom out",
						disabled: scale <= MIN_SCALE,
						onClick: zoomOut,
						style: {
							...btnBase,
							opacity: scale <= MIN_SCALE ? .4 : 1
						},
						type: "button",
						children: /* @__PURE__ */ jsx("svg", {
							fill: "none",
							height: "16",
							stroke: "currentColor",
							strokeLinecap: "round",
							strokeWidth: "2",
							viewBox: "0 0 24 24",
							width: "16",
							children: /* @__PURE__ */ jsx("path", { d: "M5 12h14" })
						})
					}),
					/* @__PURE__ */ jsx("button", {
						"aria-label": "Reset zoom",
						onClick: resetZoom,
						style: {
							...btnBase,
							fontFamily: "monospace",
							minWidth: 56,
							userSelect: "none"
						},
						type: "button",
						children: pct
					}),
					/* @__PURE__ */ jsx("button", {
						"aria-label": "Zoom in",
						disabled: scale >= MAX_SCALE,
						onClick: zoomIn,
						style: {
							...btnBase,
							opacity: scale >= MAX_SCALE ? .4 : 1
						},
						type: "button",
						children: /* @__PURE__ */ jsx("svg", {
							fill: "none",
							height: "16",
							stroke: "currentColor",
							strokeLinecap: "round",
							strokeWidth: "2",
							viewBox: "0 0 24 24",
							width: "16",
							children: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12h14" })
						})
					})
				]
			})
		]
	}), document.body);
};
/** Cross-mount cache: edit → publish remounts must not flash empty (layout jump). */
const mermaidSvgCache = /* @__PURE__ */ new Map();
/** Match edit-mode `.cm-mermaid-chart-area` so first paint without cache still keeps some height. */
const MERMAID_PLACEHOLDER_MIN_HEIGHT = 120;
/**
* 带完整错误处理的 Mermaid 包装组件
*
* 错误捕获层级：
* 1. 预解析检测：mermaid.parse() 异步检测语法错误（能捕获 parse 阶段的错误）
* 2. 渲染错误边界：Class ErrorBoundary 捕获 React 渲染期间的错误（能捕获 render 阶段的错误）
* 3. 代码变化时自动重置错误状态
*
* 布局稳定：
* - 同 code 的 SVG 缓存在模块级 Map，发布/只读重挂载可同步复用，避免高度塌陷跳动
* - 无缓存时用占位高度，不再 `return null`
*/
const MermaidWithErrorBoundary = memo(({ children, enableImagePreview = true, ...props }) => {
	const code = children.trim();
	const renderId = `mermaid-validate-${useId().replaceAll(":", "")}`;
	const [error, setError] = useState(null);
	const [svg, setSvg] = useState(() => code ? mermaidSvgCache.get(code) ?? "" : "");
	const [previewOpen, setPreviewOpen] = useState(false);
	useEffect(() => {
		let canceled = false;
		setError(null);
		if (!code) {
			setSvg("");
			return;
		}
		const cached = mermaidSvgCache.get(code);
		if (cached) {
			setSvg(cached);
			return;
		}
		setSvg("");
		loadMermaid().then(async (mermaid) => {
			await mermaid.parse(code);
			return mermaid.render(renderId, code);
		}).then(({ svg: nextSvg }) => {
			mermaidSvgCache.set(code, nextSvg);
			if (!canceled) setSvg(nextSvg);
		}, (error) => {
			if (!canceled) setError(error instanceof Error ? error : new Error(String(error)));
		});
		return () => {
			canceled = true;
		};
	}, [code, renderId]);
	const handlePreviewClick = useCallback((e) => {
		if (!enableImagePreview) return;
		e.stopPropagation();
		setPreviewOpen(true);
	}, [enableImagePreview]);
	const handlePreviewClose = useCallback(() => setPreviewOpen(false), []);
	if (!code) return null;
	if (error) return /* @__PURE__ */ jsx(ErrorFallback, { error });
	if (!svg) return /* @__PURE__ */ jsx("div", {
		"aria-busy": "true",
		"aria-label": "Mermaid rendering",
		style: {
			minHeight: MERMAID_PLACEHOLDER_MIN_HEIGHT,
			width: "100%"
		}
	});
	return /* @__PURE__ */ jsxs(MermaidRenderErrorBoundary, {
		code,
		fallback: (err) => /* @__PURE__ */ jsx(ErrorFallback, { error: err }),
		children: [/* @__PURE__ */ jsx(Mermaid, {
			...props,
			bodyRender: () => /* @__PURE__ */ jsx("div", {
				onClick: handlePreviewClick,
				style: {
					cursor: enableImagePreview ? "zoom-in" : void 0,
					overflow: "auto",
					padding: 16,
					width: "100%"
				},
				children: /* @__PURE__ */ jsx("div", {
					dangerouslySetInnerHTML: { __html: svg },
					style: { width: "100%" }
				})
			}),
			children: code
		}), previewOpen && /* @__PURE__ */ jsx(SvgPreviewOverlay, {
			onClose: handlePreviewClose,
			svg
		})]
	});
});
MermaidWithErrorBoundary.displayName = "MermaidWithErrorBoundary";
//#endregion
//#region src/plugins/hr/node/HorizontalRuleNode.ts
init_utils();
var HorizontalRuleNode = class HorizontalRuleNode extends DecoratorNode {
	static getType() {
		return "horizontalrule";
	}
	static clone(node) {
		return new HorizontalRuleNode(node.__key);
	}
	static importJSON(serializedNode) {
		return $createHorizontalRuleNode().updateFromJSON(serializedNode);
	}
	static importDOM() {
		return { hr: () => ({
			conversion: $convertHorizontalRuleElement,
			priority: 0
		}) };
	}
	exportDOM() {
		return { element: document.createElement("hr") };
	}
	createDOM(config) {
		const element = document.createElement("div");
		addClassNamesToElement(element, config.theme.hr);
		return element;
	}
	getTextContent() {
		return "\n";
	}
	isInline() {
		return false;
	}
	updateDOM() {
		return false;
	}
	decorate(editor) {
		const decorator = getKernelFromEditor(editor)?.getDecorator("horizontalrule");
		if (!decorator) return null;
		if (typeof decorator === "function") return decorator(this, editor);
		return {
			queryDOM: decorator.queryDOM,
			render: decorator.render(this, editor)
		};
	}
};
function $createHorizontalRuleNode() {
	return $applyNodeReplacement(new HorizontalRuleNode());
}
function $convertHorizontalRuleElement() {
	return { node: $createHorizontalRuleNode() };
}
function $isHorizontalRuleNode(node) {
	return node.getType() === HorizontalRuleNode.getType();
}
//#endregion
//#region src/plugins/auto-complete/node/placeholderNode.ts
var PlaceholderNode = class PlaceholderNode extends ElementNode {
	static getType() {
		return "PlaceholderInline";
	}
	static clone(node) {
		return new PlaceholderNode(node.__key);
	}
	static importJSON(serializedNode) {
		return $createPlaceholderNode().updateFromJSON(serializedNode);
	}
	createDOM(config) {
		const element = document.createElement("span");
		element.setAttribute("data-lexical-key", this.getKey());
		addClassNamesToElement(element, config.theme.placeholderInline);
		return element;
	}
	updateDOM(prevNode, dom, config) {
		if ((prevNode ? prevNode : null) !== this) addClassNamesToElement(dom, config.theme.placeholderInline);
		return false;
	}
	canBeEmpty() {
		return false;
	}
	isCardLike() {
		return true;
	}
	isInline() {
		return true;
	}
	canIndent() {
		return false;
	}
	canInsertTextBefore() {
		return true;
	}
	canInsertTextAfter() {
		return true;
	}
};
var PlaceholderBlockNode = class PlaceholderBlockNode extends ElementNode {
	static getType() {
		return "PlaceholderBlock";
	}
	static clone(node) {
		return new PlaceholderBlockNode(node.__key);
	}
	static importJSON(serializedNode) {
		return $createPlaceholderBlockNode().updateFromJSON(serializedNode);
	}
	createDOM(config) {
		const element = document.createElement("div");
		element.setAttribute("data-lexical-key", this.getKey());
		addClassNamesToElement(element, config.theme.placeholderBlock);
		return element;
	}
	updateDOM(prevNode, dom, config) {
		if ((prevNode ? prevNode : null) !== this) addClassNamesToElement(dom, config.theme.placeholderBlock);
		return false;
	}
	canBeEmpty() {
		return false;
	}
	isCardLike() {
		return true;
	}
	isInline() {
		return false;
	}
	canIndent() {
		return false;
	}
	canInsertTextBefore() {
		return false;
	}
	canInsertTextAfter() {
		return false;
	}
};
function $createPlaceholderNode() {
	return $applyNodeReplacement(new PlaceholderNode());
}
function $createPlaceholderBlockNode() {
	return $applyNodeReplacement(new PlaceholderBlockNode());
}
//#endregion
//#region src/renderer/diff/compute.ts
const CHAR_DIFF_MAX_MATRIX_CELLS = 5e4;
const DELETE_MARK_STYLE = "background-color: color-mix(in srgb, var(--ant-color-error) 18%, transparent); text-decoration: line-through;";
const INSERT_MARK_STYLE = "background-color: color-mix(in srgb, var(--ant-color-success) 18%, transparent);";
function getBaseNodeType(node) {
	if (!node) return null;
	const type = node.type;
	return typeof type === "string" ? type : null;
}
function getNormalizedBlockType(node) {
	if (!node) return null;
	const record = node;
	const type = getBaseNodeType(node);
	if (!type) return null;
	if (type === "heading") return `heading:${String(record.tag || "unknown")}`;
	if (type === "list") return `list:${String(record.listType || "bullet")}`;
	return type;
}
function createCell(block, sourceBlock = block) {
	if (!block) return null;
	const source = sourceBlock ?? block;
	return {
		baseBlockType: getBaseNodeType(source),
		block,
		blockType: getNormalizedBlockType(source),
		sourceBlock: source
	};
}
function getChildren(node) {
	const children = node.children;
	return Array.isArray(children) ? children : null;
}
/** Fields that often differ across editor JSON vs Markdown re-parse without visible change. */
const EPHEMERAL_KEYS = new Set([
	"version",
	"direction",
	"textFormat",
	"textStyle",
	"detail",
	"mode",
	"indent"
]);
/**
* Stable compare form: drop ephemeral Lexical metadata and empty styles so
* editor.toJSON() vs parseMarkdownToLexical() of the same prose can match.
*/
function canonicalizeForCompare(value) {
	if (Array.isArray(value)) return value.map((item) => canonicalizeForCompare(item));
	if (!value || typeof value !== "object") return value;
	const record = value;
	const next = {};
	for (const key of Object.keys(record).sort()) {
		if (EPHEMERAL_KEYS.has(key)) continue;
		const raw = record[key];
		if (key === "style" && (raw === "" || raw == null)) continue;
		if (key === "format" && (raw === "" || raw === 0 || raw == null)) continue;
		next[key] = canonicalizeForCompare(raw);
	}
	return next;
}
/** Visible plain text of a block (for Diff equality when JSON meta still drifts). */
function plainTextOf(node) {
	if (!node) return "";
	const record = node;
	if (typeof record.text === "string") return record.text;
	const children = getChildren(node);
	if (!children) return "";
	return children.map((c) => plainTextOf(c)).join("");
}
function isTextNode(node) {
	const record = node;
	return record.type === "text" && typeof record.text === "string";
}
function textMetaKey(node) {
	return JSON.stringify({
		format: node.format ?? 0,
		style: typeof node.style === "string" ? node.style : ""
	});
}
/** Merge adjacent text nodes that share the same marks (MD parse often splits differently). */
function coalesceAdjacentTextNodes(nodes) {
	const out = [];
	for (const node of nodes) {
		const last = out.at(-1);
		if (last && isTextNode(last) && isTextNode(node) && textMetaKey(last) === textMetaKey(node)) {
			out[out.length - 1] = {
				...last,
				text: last.text + node.text
			};
			continue;
		}
		const children = getChildren(node);
		if (children) out.push(cloneNodeWithChildren(node, coalesceAdjacentTextNodes(children)));
		else out.push(node);
	}
	return out;
}
function nodesEqual(a, b) {
	const left = coalesceAdjacentTextNodes([a])[0] ?? a;
	const right = coalesceAdjacentTextNodes([b])[0] ?? b;
	if (JSON.stringify(canonicalizeForCompare(left)) === JSON.stringify(canonicalizeForCompare(right))) return true;
	const leftType = getNormalizedBlockType(left);
	const rightType = getNormalizedBlockType(right);
	return Boolean(leftType && leftType === rightType && plainTextOf(left) === plainTextOf(right));
}
function appendStyle(baseStyle, extraStyle) {
	const normalizedBase = typeof baseStyle === "string" ? baseStyle.trim() : "";
	if (!normalizedBase) return extraStyle;
	return `${normalizedBase}${normalizedBase.endsWith(";") ? "" : ";"} ${extraStyle}`;
}
function cloneTextNode(node, text, markKind) {
	let { style } = node;
	if (markKind === "delete") style = appendStyle(style, DELETE_MARK_STYLE);
	else if (markKind === "insert") style = appendStyle(style, INSERT_MARK_STYLE);
	return {
		...node,
		style,
		text
	};
}
function cloneNodeWithChildren(node, children) {
	return {
		...node,
		children
	};
}
function decorateSubtree(node, kind) {
	if (isTextNode(node)) return cloneTextNode(node, node.text, kind);
	const children = getChildren(node);
	if (!children) return node;
	return cloneNodeWithChildren(node, children.map((child) => decorateSubtree(child, kind)));
}
function reverseText(value) {
	return Array.from(value).reverse().join("");
}
function mergeTextOps(ops) {
	const merged = [];
	for (const op of ops) {
		if (!op.text) continue;
		const last = merged.at(-1);
		if (last && last.kind === op.kind) {
			last.text += op.text;
			continue;
		}
		merged.push({ ...op });
	}
	return merged;
}
function diffMiddleChars(oldChars, newChars) {
	const m = oldChars.length;
	const n = newChars.length;
	if (m === 0 && n === 0) return [];
	if (m === 0) return [{
		kind: "insert",
		text: newChars.join("")
	}];
	if (n === 0) return [{
		kind: "delete",
		text: oldChars.join("")
	}];
	if (m * n > CHAR_DIFF_MAX_MATRIX_CELLS) return [{
		kind: "delete",
		text: oldChars.join("")
	}, {
		kind: "insert",
		text: newChars.join("")
	}];
	const dp = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }).fill(0));
	for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) if (oldChars[i - 1] === newChars[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
	else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
	const reversedOps = [];
	let i = m;
	let j = n;
	while (i > 0 && j > 0) {
		if (oldChars[i - 1] === newChars[j - 1]) {
			const last = reversedOps.at(-1);
			if (last && last.kind === "equal") last.text += oldChars[i - 1];
			else reversedOps.push({
				kind: "equal",
				text: oldChars[i - 1]
			});
			i--;
			j--;
			continue;
		}
		if (dp[i - 1][j] >= dp[i][j - 1]) {
			const last = reversedOps.at(-1);
			if (last && last.kind === "delete") last.text += oldChars[i - 1];
			else reversedOps.push({
				kind: "delete",
				text: oldChars[i - 1]
			});
			i--;
		} else {
			const last = reversedOps.at(-1);
			if (last && last.kind === "insert") last.text += newChars[j - 1];
			else reversedOps.push({
				kind: "insert",
				text: newChars[j - 1]
			});
			j--;
		}
	}
	while (i > 0) {
		const last = reversedOps.at(-1);
		if (last && last.kind === "delete") last.text += oldChars[i - 1];
		else reversedOps.push({
			kind: "delete",
			text: oldChars[i - 1]
		});
		i--;
	}
	while (j > 0) {
		const last = reversedOps.at(-1);
		if (last && last.kind === "insert") last.text += newChars[j - 1];
		else reversedOps.push({
			kind: "insert",
			text: newChars[j - 1]
		});
		j--;
	}
	return mergeTextOps(reversedOps.reverse().map((op) => ({
		kind: op.kind,
		text: reverseText(op.text)
	})));
}
function diffTextByChar(oldText, newText) {
	const oldChars = Array.from(oldText);
	const newChars = Array.from(newText);
	let prefix = 0;
	while (prefix < oldChars.length && prefix < newChars.length && oldChars[prefix] === newChars[prefix]) prefix++;
	let oldSuffix = oldChars.length - 1;
	let newSuffix = newChars.length - 1;
	while (oldSuffix >= prefix && newSuffix >= prefix && oldChars[oldSuffix] === newChars[newSuffix]) {
		oldSuffix--;
		newSuffix--;
	}
	const ops = [];
	if (prefix > 0) ops.push({
		kind: "equal",
		text: oldChars.slice(0, prefix).join("")
	});
	ops.push(...diffMiddleChars(oldChars.slice(prefix, oldSuffix + 1), newChars.slice(prefix, newSuffix + 1)));
	if (oldSuffix < oldChars.length - 1) ops.push({
		kind: "equal",
		text: oldChars.slice(oldSuffix + 1).join("")
	});
	return mergeTextOps(ops);
}
function splitTextNodeByCharDiff(oldNode, newNode) {
	const ops = diffTextByChar(oldNode.text, newNode.text);
	const oldNodes = [];
	const newNodes = [];
	let changed = false;
	for (const op of ops) {
		if (!op.text) continue;
		if (op.kind === "equal") {
			oldNodes.push(cloneTextNode(oldNode, op.text));
			newNodes.push(cloneTextNode(newNode, op.text));
			continue;
		}
		changed = true;
		if (op.kind === "delete") {
			oldNodes.push(cloneTextNode(oldNode, op.text, "delete"));
			continue;
		}
		newNodes.push(cloneTextNode(newNode, op.text, "insert"));
	}
	return {
		changed,
		newNodes: newNodes.length > 0 ? newNodes : [newNode],
		oldNodes: oldNodes.length > 0 ? oldNodes : [oldNode]
	};
}
function alignNodes(oldNodes, newNodes) {
	const m = oldNodes.length;
	const n = newNodes.length;
	const dp = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }).fill(0));
	for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
		const skip = Math.max(dp[i - 1][j], dp[i][j - 1]);
		const oldType = getNormalizedBlockType(oldNodes[i - 1]);
		const newType = getNormalizedBlockType(newNodes[j - 1]);
		if (oldType && oldType === newType) {
			const score = nodesEqual(oldNodes[i - 1], newNodes[j - 1]) ? 2 : 1;
			dp[i][j] = Math.max(skip, dp[i - 1][j - 1] + score);
		} else dp[i][j] = skip;
	}
	const ops = [];
	let i = m;
	let j = n;
	while (i > 0 && j > 0) {
		const oldType = getNormalizedBlockType(oldNodes[i - 1]);
		const newType = getNormalizedBlockType(newNodes[j - 1]);
		if (oldType && oldType === newType) {
			const exact = nodesEqual(oldNodes[i - 1], newNodes[j - 1]);
			const score = exact ? 2 : 1;
			if (dp[i][j] === dp[i - 1][j - 1] + score) {
				ops.push(exact ? {
					kind: "equal",
					node: oldNodes[i - 1]
				} : {
					kind: "modify",
					newNode: newNodes[j - 1],
					oldNode: oldNodes[i - 1]
				});
				i--;
				j--;
				continue;
			}
		}
		if (dp[i - 1][j] >= dp[i][j - 1]) {
			ops.push({
				kind: "delete",
				node: oldNodes[i - 1]
			});
			i--;
		} else {
			ops.push({
				kind: "insert",
				node: newNodes[j - 1]
			});
			j--;
		}
	}
	while (i > 0) ops.push({
		kind: "delete",
		node: oldNodes[--i]
	});
	while (j > 0) ops.push({
		kind: "insert",
		node: newNodes[--j]
	});
	return ops.reverse();
}
function diffChildrenInline(oldChildren, newChildren) {
	const ops = alignNodes(coalesceAdjacentTextNodes(oldChildren), coalesceAdjacentTextNodes(newChildren));
	const nextOldChildren = [];
	const nextNewChildren = [];
	let changed = false;
	for (const op of ops) switch (op.kind) {
		case "equal":
			nextOldChildren.push(op.node);
			nextNewChildren.push(op.node);
			break;
		case "delete":
			changed = true;
			nextOldChildren.push(decorateSubtree(op.node, "delete"));
			break;
		case "insert":
			changed = true;
			nextNewChildren.push(decorateSubtree(op.node, "insert"));
			break;
		case "modify": {
			changed = true;
			if (isTextNode(op.oldNode) && isTextNode(op.newNode)) {
				const textDiff = splitTextNodeByCharDiff(op.oldNode, op.newNode);
				nextOldChildren.push(...textDiff.oldNodes);
				nextNewChildren.push(...textDiff.newNodes);
				break;
			}
			const nested = diffNodeInline(op.oldNode, op.newNode);
			nextOldChildren.push(nested.oldNode);
			nextNewChildren.push(nested.newNode);
			break;
		}
	}
	return {
		changed,
		newChildren: nextNewChildren,
		oldChildren: nextOldChildren
	};
}
function diffNodeInline(oldNode, newNode) {
	if (nodesEqual(oldNode, newNode)) return {
		changed: false,
		newNode,
		oldNode
	};
	const oldChildren = getChildren(oldNode);
	const newChildren = getChildren(newNode);
	if (!oldChildren || !newChildren) return {
		changed: true,
		newNode,
		oldNode
	};
	const childDiff = diffChildrenInline(oldChildren, newChildren);
	if (!childDiff.changed) return {
		changed: false,
		newNode,
		oldNode
	};
	return {
		changed: true,
		newNode: cloneNodeWithChildren(newNode, childDiff.newChildren),
		oldNode: cloneNodeWithChildren(oldNode, childDiff.oldChildren)
	};
}
function getRootChildren(state) {
	return Array.isArray(state.root.children) ? [...state.root.children] : [];
}
function computeLexicalDiffRows(oldState, newState) {
	const ops = alignNodes(coalesceAdjacentTextNodes(getRootChildren(oldState)), coalesceAdjacentTextNodes(getRootChildren(newState)));
	const rows = [];
	let index = 0;
	while (index < ops.length) {
		const op = ops[index];
		if (op.kind === "equal") {
			rows.push({
				kind: "equal",
				newCell: createCell(op.node),
				oldCell: createCell(op.node)
			});
			index++;
			continue;
		}
		if (op.kind === "modify") {
			const diffed = diffNodeInline(op.oldNode, op.newNode);
			if (!diffed.changed) {
				rows.push({
					kind: "equal",
					newCell: createCell(op.oldNode),
					oldCell: createCell(op.oldNode)
				});
				index++;
				continue;
			}
			rows.push({
				kind: "modify",
				newCell: createCell(diffed.newNode, op.newNode),
				oldCell: createCell(diffed.oldNode, op.oldNode)
			});
			index++;
			continue;
		}
		const deletes = [];
		const inserts = [];
		while (index < ops.length && (ops[index].kind === "delete" || ops[index].kind === "insert")) {
			const current = ops[index];
			if (current.kind === "delete") deletes.push(current.node);
			else if (current.kind === "insert") inserts.push(current.node);
			index++;
		}
		const maxLength = Math.max(deletes.length, inserts.length);
		for (let pairIndex = 0; pairIndex < maxLength; pairIndex++) {
			const oldBlock = deletes[pairIndex] ?? null;
			const newBlock = inserts[pairIndex] ?? null;
			if (oldBlock && newBlock) {
				if (nodesEqual(oldBlock, newBlock)) {
					rows.push({
						kind: "equal",
						newCell: createCell(oldBlock),
						oldCell: createCell(oldBlock)
					});
					continue;
				}
				rows.push({
					kind: "modify",
					newCell: createCell(newBlock),
					oldCell: createCell(oldBlock)
				});
				continue;
			}
			if (oldBlock) {
				rows.push({
					kind: "delete",
					newCell: null,
					oldCell: createCell(oldBlock)
				});
				continue;
			}
			rows.push({
				kind: "insert",
				newCell: createCell(newBlock),
				oldCell: null
			});
		}
	}
	return rows;
}
//#endregion
//#region src/plugins/file/node/FileNode.ts
init_utils();
var FileNode = class FileNode extends DecoratorNode {
	static getType() {
		return "file";
	}
	static clone(node) {
		return new FileNode(node.__name, node.__fileUrl, node.__size, node.__status, node.__message, node.__key);
	}
	static importJSON(serializedNode) {
		return new FileNode(serializedNode.name, serializedNode.fileUrl, serializedNode.size, serializedNode.status, serializedNode.message);
	}
	static importDOM() {
		return { span: (node) => {
			if (node.classList.contains("file")) return {
				conversion: $convertFileElement,
				priority: 0
			};
			return null;
		} };
	}
	get name() {
		return this.__name;
	}
	get fileUrl() {
		return this.__fileUrl;
	}
	get size() {
		return this.__size;
	}
	get status() {
		return this.__status;
	}
	get message() {
		return this.__message;
	}
	constructor(name, fileUrl, size, status, message, key) {
		super(key);
		this.__name = name;
		this.__fileUrl = fileUrl;
		this.__size = size;
		this.__status = status || "pending";
		this.__message = message;
	}
	setUploaded(url) {
		const writable = this.getWritable();
		writable.__fileUrl = url;
		writable.__status = "uploaded";
		writable.__message = void 0;
	}
	setError(message) {
		const writable = this.getWritable();
		writable.__status = "error";
		writable.__message = message;
	}
	exportDOM() {
		return { element: document.createElement("span") };
	}
	createDOM(config) {
		const element = document.createElement("span");
		addClassNamesToElement(element, config.theme.file);
		return element;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			fileUrl: this.fileUrl,
			message: this.message,
			name: this.name,
			size: this.size,
			status: this.status
		};
	}
	updateFromJSON(serializedNode) {
		return super.updateFromJSON(serializedNode);
	}
	getTextContent() {
		return "\n";
	}
	updateDOM() {
		return false;
	}
	decorate(editor) {
		const decorator = getKernelFromEditor(editor)?.getDecorator("file");
		if (!decorator) return null;
		if (typeof decorator === "function") return decorator(this, editor);
		return {
			queryDOM: decorator.queryDOM,
			render: decorator.render(this, editor)
		};
	}
};
function $createFileNode(name = "unknown", fileUrl, size, status, message) {
	return $applyNodeReplacement(new FileNode(name, fileUrl, size, status, message));
}
function $convertFileElement() {
	return { node: $createFileNode() };
}
function $isFileNode(node) {
	return node.getType() === FileNode.getType();
}
//#endregion
//#region src/plugins/file/react/style.ts
const styles$4 = createStaticStyles(({ css, cssVar }) => ({ file: css`
    user-select: none;

    display: inline-block;

    margin-inline: 0.25em;
    padding-block: 0.2em;
    padding-inline: 0.4em;
    border: 1px solid var(--lobe-markdown-border-color);
    border-radius: 0.25em;

    font-family: ${cssVar.fontFamilyCode};
    font-size: 0.875em;
    line-height: 1;
    word-break: break-word;
    white-space: break-spaces;

    background: ${cssVar.colorFillSecondary};

    a {
      cursor: pointer;
      color: inherit;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    span {
      user-select: none;
    }

    &.selected {
      color: #000;
      background: ${cssVar.yellow};
    }
  ` }));
//#endregion
//#region src/plugins/image/node/basie-image-node.ts
var BaseImageNode = class BaseImageNode extends DecoratorNode {
	static clone(node) {
		return new BaseImageNode(node.__src, node.__altText, node.__maxWidth, node.__width, node.__height, node.__key);
	}
	static importJSON(serializedNode) {
		const { altText, height, width, maxWidth, src } = serializedNode;
		return new BaseImageNode(src, altText, maxWidth, width, height);
	}
	static getType() {
		return "image";
	}
	updateFromJSON(serializedNode) {
		return super.updateFromJSON(serializedNode);
	}
	exportDOM() {
		const element = document.createElement("img");
		element.setAttribute("src", this.__src);
		element.setAttribute("alt", this.__altText);
		element.setAttribute("width", this.__width.toString());
		element.setAttribute("height", this.__height.toString());
		return { element };
	}
	constructor(src, altText, maxWidth, width, height, key) {
		super(key);
		this.__src = src;
		this.__altText = altText;
		this.__maxWidth = maxWidth;
		this.__width = width || "inherit";
		this.__height = height || "inherit";
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			altText: this.getAltText(),
			height: this.__height === "inherit" ? 0 : this.__height,
			maxWidth: this.__maxWidth,
			src: this.getSrc(),
			width: this.__width === "inherit" ? 0 : this.__width
		};
	}
	setWidthAndHeight(width, height) {
		const writable = this.getWritable();
		writable.__width = width;
		writable.__height = height;
	}
	isInline() {
		return true;
	}
	createDOM(config) {
		const span = document.createElement("span");
		const className = config.theme.image;
		if (className !== void 0) span.className = className;
		return span;
	}
	updateDOM() {
		return false;
	}
	getSrc() {
		return this.__src;
	}
	getAltText() {
		return this.__altText;
	}
};
//#endregion
//#region src/plugins/image/node/block-image-node.tsx
var BlockImageNode = class BlockImageNode extends BaseImageNode {
	static {
		this._decorate = () => null;
	}
	static setDecorate(decorate) {
		BlockImageNode._decorate = decorate;
	}
	static getType() {
		return "block-image";
	}
	get isLoading() {
		return this.__loading;
	}
	get status() {
		return this.__status;
	}
	get message() {
		return this.__message;
	}
	get src() {
		return this.__src;
	}
	get altText() {
		return this.__altText;
	}
	get maxWidth() {
		return this.__maxWidth;
	}
	get width() {
		return this.__width;
	}
	get height() {
		return this.__height;
	}
	constructor(opt) {
		super(opt.src, opt.altText, opt.maxWidth, opt.width, opt.height, opt.key);
		this.__loading = true;
		this.__status = "uploaded";
		this.__message = null;
		this.__extra = null;
		this.__status = opt.status ?? "uploaded";
	}
	isInline() {
		return false;
	}
	setMaxWidth(maxWidth) {
		const writable = this.getWritable();
		writable.__maxWidth = maxWidth;
	}
	setWidth(width) {
		const writable = this.getWritable();
		writable.__width = width;
	}
	setStatus(status) {
		const writable = this.getWritable();
		writable.__status = status;
	}
	setUploaded(url) {
		const writable = this.getWritable();
		writable.__loading = false;
		writable.__src = url;
		writable.__status = "uploaded";
	}
	setError(message) {
		const writable = this.getWritable();
		writable.__loading = false;
		writable.__status = "error";
		writable.__message = message;
	}
	static clone(node) {
		return new BlockImageNode({
			altText: node.__altText,
			height: node.__height,
			key: node.__key,
			maxWidth: node.__maxWidth,
			src: node.__src,
			status: node.__status,
			width: node.__width
		});
	}
	static importJSON(serializedNode) {
		const { altText, height, width, maxWidth, src, status } = serializedNode;
		return $createBlockImageNode({
			altText,
			height,
			maxWidth,
			src,
			status,
			width
		}).updateFromJSON(serializedNode);
	}
	static importDOM() {
		return { img: () => ({
			conversion: $convertImageElement$1,
			priority: 0
		}) };
	}
	decorate() {
		return BlockImageNode._decorate(this);
	}
	createDOM(config) {
		const span = document.createElement("div");
		const className = config.theme.blockImage;
		if (className !== void 0) span.className = className;
		return span;
	}
};
function $createBlockImageNode({ altText, height, maxWidth = 4200, src, width, key, status }) {
	return $applyNodeReplacement(new BlockImageNode({
		altText,
		height,
		key,
		maxWidth,
		src,
		status,
		width
	}));
}
function $convertImageElement$1(domNode) {
	const img = domNode;
	if (img.src.startsWith("file:///")) return null;
	const { alt: altText, src, width, height } = img;
	return { node: $createBlockImageNode({
		altText,
		height,
		src,
		width
	}) };
}
function $isBlockImageNode(node) {
	return node.getType() === BlockImageNode.getType();
}
//#endregion
//#region src/plugins/image/node/image-node.tsx
var ImageNode = class ImageNode extends BaseImageNode {
	static {
		this._decorate = () => null;
	}
	static setDecorate(decorate) {
		ImageNode._decorate = decorate;
	}
	static getType() {
		return "image";
	}
	constructor(opt) {
		super(opt.src, opt.altText, opt.maxWidth, opt.width, opt.height, opt.key);
		this.__loading = true;
		this.__status = "uploaded";
		this.__message = null;
		this.__extra = null;
		this.__status = opt.status ?? "uploaded";
	}
	get isLoading() {
		return this.__loading;
	}
	get status() {
		return this.__status;
	}
	get message() {
		return this.__message;
	}
	get src() {
		return this.__src;
	}
	get altText() {
		return this.__altText;
	}
	get maxWidth() {
		return this.__maxWidth;
	}
	get width() {
		return this.__width;
	}
	get height() {
		return this.__height;
	}
	setMaxWidth(maxWidth) {
		const writable = this.getWritable();
		writable.__maxWidth = maxWidth;
	}
	setStatus(status) {
		const writable = this.getWritable();
		writable.__status = status;
	}
	setWidth(width) {
		const writable = this.getWritable();
		writable.__width = width;
	}
	setUploaded(url) {
		const writable = this.getWritable();
		writable.__loading = false;
		writable.__src = url;
		writable.__status = "uploaded";
	}
	setError(message) {
		const writable = this.getWritable();
		writable.__loading = false;
		writable.__status = "error";
		writable.__message = message;
	}
	static clone(node) {
		return new ImageNode({
			altText: node.__altText,
			height: node.__height,
			key: node.__key,
			maxWidth: node.__maxWidth,
			src: node.__src,
			status: node.__status,
			width: node.__width
		});
	}
	static importJSON(serializedNode) {
		const { altText, height, width, maxWidth, src, status } = serializedNode;
		return $createImageNode({
			altText,
			height,
			maxWidth,
			src,
			status,
			width
		}).updateFromJSON(serializedNode);
	}
	static importDOM() {
		return { img: () => ({
			conversion: $convertImageElement,
			priority: 0
		}) };
	}
	decorate() {
		return ImageNode._decorate(this);
	}
};
function $createImageNode({ altText, height, maxWidth = 500, src, width, key, status }) {
	return $applyNodeReplacement(new ImageNode({
		altText,
		height,
		key,
		maxWidth,
		src,
		status,
		width
	}));
}
function $convertImageElement(domNode) {
	const img = domNode;
	if (img.src.startsWith("file:///")) return null;
	const { alt: altText, src, width, height } = img;
	return { node: $createImageNode({
		altText,
		height,
		src,
		width
	}) };
}
function $isImageNode(node) {
	return node.getType() === ImageNode.getType();
}
//#endregion
//#region src/plugins/image/react/style.ts
const styles$3 = createStaticStyles(({ css, cssVar }) => ({
	image: css`
    cursor: default;
    user-select: none;
    position: relative;
    display: inline-block;

    &.selected {
      background-color: ${cssVar.colorPrimaryBg};
    }

    /* 防止图片撑破容器：限制最大宽度为 100% */
    img {
      max-width: 100% !important;
    }
  `,
	blockImage: css`
    cursor: default;
    user-select: none;

    position: relative;

    display: block;

    text-align: center;

    &.selected {
      background-color: ${cssVar.colorPrimaryBg};
    }

    /* 防止图片撑破容器：限制最大宽度为 100% */
    img {
      max-width: 100% !important;
    }
  `
}));
const imageBroken = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCA2NDAgNDAwIj48cGF0aCBmaWxsPSIjM0IzQjNCIiBkPSJNMCAwaDY0MHY0MDBIMHoiLz48cGF0aCBzdHJva2U9IiM2MjYyNjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIxNSIgZD0iTTM3Mi41IDEzMi41aC0xMDVjLTguMjg0IDAtMTUgNi43MTYtMTUgMTV2MTA1YzAgOC4yODQgNi43MTYgMTUgMTUgMTVoMTA1YzguMjg0IDAgMTUtNi43MTYgMTUtMTV2LTEwNWMwLTguMjg0LTYuNzE2LTE1LTE1LTE1eiIvPjxwYXRoIHN0cm9rZT0iIzYyNjI2MiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjE1IiBkPSJNMjk3LjUgMTkyLjVjOC4yODQgMCAxNS02LjcxNiAxNS0xNSAwLTguMjg0LTYuNzE2LTE1LTE1LTE1LTguMjg0IDAtMTUgNi43MTYtMTUgMTUgMCA4LjI4NCA2LjcxNiAxNSAxNSAxNXpNMzg3LjUgMjIyLjUwMmwtMjMuMTQ1LTIzLjE0NWExNS4wMDEgMTUuMDAxIDAgMDAtMjEuMjEgMEwyNzUgMjY3LjUwMiIvPjwvc3ZnPg==";
//#endregion
//#region src/plugins/list/react/style.ts
const styles$2 = createStaticStyles(({ css, cssVar }) => css`
    .editor_listUnordered&,
    .editor_listOrdered& {
      margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      margin-inline-start: 1em;
      padding-inline-start: 0;
      list-style-position: outside;

      > .editor_listUnordered,
      > ol {
        margin-block: 0;
      }

      > .editor_listItem {
        margin-inline-start: 1em;
      }
    }

    .editor_listOrdered& {
      list-style: auto;
    }

    .editor_listUnordered& {
      list-style-type: none;

      > .editor_listItem:not(:has(ul)):not([role='checkbox']) {
        &::before {
          content: '-';
          display: inline-block;
          margin-inline: -1em 0.5em;
          opacity: 0.5;
        }
      }
    }

    .editor_listItem {
      margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.33em);
      font-family: var(--listitem-marker-font-family);
      font-size: var(--listitem-marker-font-size);
      background-color: var(--listitem-marker-background-color);

      &::marker {
        font-family: var(--listitem-marker-font-family);
        font-size: var(--listitem-marker-font-size);
        color: var(--listitem-marker-color);
        background-color: var(--listitem-marker-background-color);
      }

      p {
        display: inline;
      }

      .editor_listUnordered,
      .editor_listOrdered {
        margin: 0;
      }
    }

    [role='checkbox'] {
      position: relative;
    }

    .editor_listItemChecked::before,
    .editor_listItemUnchecked::before {
      border: 1px solid ${cssVar.colorBorder};
      border-radius: 4px;
    }

    .editor_listItemChecked::before {
      background: ${cssVar.colorPrimary};
    }

    .editor_listItemChecked:not(:has(ul))::after {
      cursor: pointer;
      content: '';

      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 0.2em;
      transform: rotate(45deg) scale(1) translate(-50%, -50%);

      display: block;

      width: 0.3em;
      height: 0.6em;
      margin-inline: -1.35em 0.5em;
      border: 2px solid ${cssVar.colorTextLightSolid};
      border-block-start: 0;
      border-inline-start: 0;

      background-size: cover;

      transition: all 0.2s cubic-bezier(0.12, 0.4, 0.29, 1.46) 0.1s;
    }

    .editor_listItemUnchecked:not(:has(ul))::before,
    .editor_listItemChecked:not(:has(ul))::before {
      cursor: pointer;
      content: '';

      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 0;
      transform: translateY(-50%);

      display: inline-block;
      display: block;

      width: 1em;
      height: 1em;
      margin-inline: -1.4em 0.5em;

      background-size: cover;
    }

    .editor_listItemNested {
      list-style-type: none;
    }
  `);
//#endregion
//#region src/plugins/math/react/style.ts
const styles$1 = createStaticStyles(({ css, cssVar }) => {
	const latex = css`
    cursor: pointer;
    user-select: none;
    font-size: 1em;

    .katex-error {
      color: ${cssVar.colorError} !important;
    }

    .katex-html {
      overflow: auto hidden;
      padding: 3px;

      .base {
        margin-block: 0;
        margin-inline: auto;
      }

      .tag {
        position: relative !important;
        display: inline-block;
        padding-inline-start: 0.5rem;
      }
    }

    &.selected {
      color: #000;
      background: ${cssVar.yellow};
    }

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }

    &.editing {
      background: ${cssVar.colorFillTertiary};
    }

    &:has(.katex-error) {
      background: ${cssVar.colorErrorBg};
    }
  `;
	return {
		mathInline: cx(latex, css`
        display: inline-block;
        border-radius: calc(var(--lobe-markdown-border-radius) * 0.5px);
      `),
		mathBlock: cx(latex, css`
        overflow: auto hidden;
        display: block;
        border-radius: calc(var(--lobe-markdown-border-radius) * 1px);
        white-space: nowrap;
      `),
		mathEditor: css`
      width: 320px;
      background: ${cssVar.colorBgElevated};

      textarea {
        width: 100%;

        font-family: ${cssVar.fontFamilyCode};
        font-size: 13px;

        background: transparent !important;

        transition: none !important;
      }
    `,
		mathEditorFooter: css`
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
      background: ${cssVar.colorFillQuaternary};
    `,
		mathEditorAnchor: css`
      pointer-events: none;

      position: absolute;
      inset-block-start: -9999px;
      inset-inline-start: -9999px;

      width: 0;
      height: 0;
    `,
		mathEditorTextArea: css`
      margin-block: 4px;
    `,
		mathPlaceholder: css`
      padding-inline: 0.2em;
      font-style: italic;
    `
	};
});
//#endregion
//#region src/plugins/table/react/style.ts
const styles = createStaticStyles(({ css, cssVar }) => css`
    overflow-x: auto;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em)
      calc(var(--lobe-markdown-margin-multiple) * 0.5em + 16px);
    /* flex 布局下，min-width: auto 会让容器按内容无限撑开，导致 overflow-x: auto 失效
       设置 min-width: 0 是 CSS flex 布局经典 fix，让容器真正被父宽度约束 */
    min-width: 0;

    .editor_table {
      table-layout: fixed;
      border-spacing: 0;
      border-collapse: collapse;

      width: fit-content;

      text-align: start;
      text-indent: initial;
      text-wrap: pretty;
      word-break: auto-phrase;
      overflow-wrap: break-word;

      background: ${cssVar.colorFillQuaternary};

      > tr:first-of-type {
        background: ${cssVar.colorFillQuaternary};

        .editor_table_cell_header {
          font-weight: bold;
        }
      }
    }

    code {
      word-break: break-word;
    }

    .editor_table_cell_header {
      font-weight: normal;
    }

    .editor_table_cell {
      position: relative;

      overflow: auto;

      width: 75px;
      padding-block: 6px;
      padding-inline: 8px;
      border: 1px solid ${cssVar.colorFillSecondary};

      text-align: start;
      vertical-align: top;

      outline: none;
    }

    .editor_table_cell_selected {
      color: #000;
      background-color: ${cssVar.yellow};
      caret-color: transparent;
    }
  `);
//#endregion
export { MermaidWithErrorBoundary as S, PlaceholderBlockNode as _, styles$3 as a, $isHorizontalRuleNode as b, ImageNode as c, BlockImageNode as d, styles$4 as f, computeLexicalDiffRows as g, FileNode as h, imageBroken as i, $createBlockImageNode as l, $isFileNode as m, styles$1 as n, $createImageNode as o, $createFileNode as p, styles$2 as r, $isImageNode as s, styles as t, $isBlockImageNode as u, PlaceholderNode as v, HorizontalRuleNode as x, $createHorizontalRuleNode as y };
