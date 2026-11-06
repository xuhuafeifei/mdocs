import { H as CursorNode, L as CodeMirrorNode, N as styles, T as findSupportedLanguageInfo, _ as AutoLinkNode, c as MathBlockNode, f as LinkHighlightNode, i as MentionNode, j as CodeNode, l as MathInlineNode, t as styles$1, x as LinkNode } from "./style-B85viVq4.js";
import { S as MermaidWithErrorBoundary, _ as PlaceholderBlockNode, a as styles$5, c as ImageNode, d as BlockImageNode, f as styles$6, g as computeLexicalDiffRows, h as FileNode, n as styles$4, r as styles$2, t as styles$3, v as PlaceholderNode, x as HorizontalRuleNode } from "./style-BUXXDG2e.js";
import { createHeadlessEditor } from "@lexical/headless";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $getRoot, $isElementNode, $isTextNode } from "lexical";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { jsx, jsxs } from "react/jsx-runtime";
import { createElement, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import { ListItemNode, ListNode } from "@lexical/list";
import { Highlighter } from "@lobehub/ui";
import { createStaticStyles, cx } from "antd-style";
import { createHighlighterCoreSync, isSpecialLang } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import { Image } from "antd";
//#region src/renderer/engine/shiki.ts
let _highlighter = null;
function getHighlighter() {
	if (!_highlighter) _highlighter = createHighlighterCoreSync({
		engine: createJavaScriptRegexEngine(),
		langs: [],
		themes: []
	});
	return _highlighter;
}
function isLanguageLoaded(language) {
	if (isSpecialLang(language)) return true;
	return getHighlighter().getLoadedLanguages().includes(language);
}
async function loadLanguage(language) {
	if (isLanguageLoaded(language)) return;
	const info = findSupportedLanguageInfo(language);
	if (info) await getHighlighter().loadLanguage(info.import());
}
//#endregion
//#region src/renderer/style.ts
const tableHeaderFix = createStaticStyles(({ css, cssVar }) => css`
    .editor_table > tbody > tr:first-of-type {
      background: ${cssVar.colorFillQuaternary};

      .editor_table_cell_header {
        font-weight: bold;
      }
    }
  `);
function getRendererClassName(className) {
	return cx(styles.root, styles.variant, className);
}
function getListClassName(listType) {
	return cx(listType === "number" ? "editor_listOrdered" : "editor_listUnordered", styles$2);
}
function getTableWrapperClassName() {
	return cx("editor_table_scrollable_wrapper", styles$3, tableHeaderFix);
}
function getMathInlineClassName() {
	return styles$4.mathInline;
}
function getMathBlockClassName() {
	return styles$4.mathBlock;
}
function getImageClassName() {
	return styles$5.image;
}
function getBlockImageClassName() {
	return styles$5.blockImage;
}
function getMentionClassName() {
	return cx("editor_mention", styles$1.mention);
}
function getCSSVariables(variant) {
	const isChat = variant === "chat";
	return {
		"--common-font-size": `${isChat ? 14 : 16}px`,
		"--common-header-multiple": String(isChat ? .25 : .6),
		"--common-line-height": String(isChat ? 1.4 : 1.6),
		"--common-margin-multiple": String(isChat ? 1 : 2)
	};
}
//#endregion
//#region src/renderer/engine/utils.ts
function parseCSSText(cssText) {
	const style = {};
	for (const part of cssText.split(";")) {
		const colonIndex = part.indexOf(":");
		if (colonIndex === -1) continue;
		const prop = part.slice(0, colonIndex).trim();
		const value = part.slice(colonIndex + 1).trim();
		if (!prop || !value) continue;
		const camelProp = prop.replaceAll(/-([a-z])/g, (_, c) => c.toUpperCase());
		style[camelProp] = value;
	}
	return style;
}
//#endregion
//#region src/renderer/engine/render-builtin-node.tsx
const SAFE_URL_PROTOCOLS = new Set([
	"http:",
	"https:",
	"mailto:",
	"sms:",
	"tel:"
]);
function sanitizeUrl(url) {
	try {
		const parsed = new URL(url);
		if (!SAFE_URL_PROTOCOLS.has(parsed.protocol)) return "about:blank";
	} catch {
		return url;
	}
	return url;
}
function formatLinkHighlightUrl(url) {
	if (/^[a-z][\d+.a-z-]*:/i.test(url)) return url;
	if (/^[#./]/.test(url)) return url;
	if (url.includes("@") && !url.startsWith("mailto:")) return `mailto:${url}`;
	if (/^\+?[\d\s()-]{5,}$/.test(url)) return `tel:${url}`;
	if (url.startsWith("www.")) return `https://${url}`;
	if (!url.includes("://")) return `https://${url}`;
	return url;
}
function textToSlug(text) {
	return text.toLowerCase().trim().replaceAll(/[^\s\w\u3000-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF-]/g, "").replaceAll(/[\s_]+/g, "-").replaceAll(/^-+|-+$/g, "");
}
const DIFF_ROOT_STYLE = { position: "relative" };
const DIFF_LIST_ITEM_ROOT_STYLE = {
	display: "inline-block",
	minWidth: "100%",
	position: "relative"
};
const DIFF_DELETED_STYLE = {
	color: "var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.45))",
	textDecoration: "line-through"
};
function renderDiffNode(node, key, children) {
	const diffType = typeof node.diffType === "string" ? node.diffType : "unchanged";
	const renderedChildren = children ?? [];
	const sharedContentStyle = {
		marginBlockStart: "calc(var(--lobe-markdown-margin-multiple, 1) * 0.5em)",
		paddingInlineEnd: 4
	};
	const borderColor = diffType === "add" || diffType === "listItemAdd" ? "var(--ant-color-success, #52c41a)" : diffType === "remove" || diffType === "listItemRemove" ? "var(--ant-color-error, #ff4d4f)" : "var(--ant-color-warning, #faad14)";
	const contentStyle = diffType === "unchanged" ? sharedContentStyle : {
		...sharedContentStyle,
		borderInlineEnd: `3px solid ${borderColor}`
	};
	const rootStyle = diffType === "listItemAdd" || diffType === "listItemModify" || diffType === "listItemRemove" ? DIFF_LIST_ITEM_ROOT_STYLE : DIFF_ROOT_STYLE;
	const wrapChild = (child, childKey, style) => {
		if (child === void 0 || child === null) return null;
		return /* @__PURE__ */ jsx("div", {
			style,
			children: child
		}, childKey);
	};
	let content;
	switch (diffType) {
		case "add":
		case "listItemAdd":
			content = wrapChild(renderedChildren[0], `${key}-add`);
			break;
		case "remove":
		case "listItemRemove":
			content = wrapChild(renderedChildren[0], `${key}-remove`, DIFF_DELETED_STYLE);
			break;
		case "modify":
		case "listItemModify":
			content = [wrapChild(renderedChildren[0], `${key}-old`, DIFF_DELETED_STYLE), wrapChild(renderedChildren[1], `${key}-new`)];
			break;
		default:
			content = renderedChildren;
			break;
	}
	return /* @__PURE__ */ jsx("div", {
		className: "ne-diff",
		"data-diff-type": diffType,
		style: rootStyle,
		children: /* @__PURE__ */ jsx("div", {
			className: "content",
			style: contentStyle,
			children: content
		})
	}, key);
}
function renderBuiltinNode(node, key, children, headingSlugs, textContent) {
	switch (node.type) {
		case "root": return children;
		case "paragraph": return /* @__PURE__ */ jsx("p", {
			style: node.format ? { textAlign: node.format } : void 0,
			children
		}, key);
		case "heading": {
			const tag = node.tag;
			const baseSlug = textToSlug(textContent || "");
			let slug = baseSlug;
			if (baseSlug) {
				const count = headingSlugs.get(baseSlug);
				if (count !== void 0) {
					slug = `${baseSlug}-${count}`;
					headingSlugs.set(baseSlug, count + 1);
				} else headingSlugs.set(baseSlug, 1);
			}
			return createElement(tag, {
				id: slug || void 0,
				key
			}, children);
		}
		case "quote": return /* @__PURE__ */ jsx("blockquote", {
			className: "editor_quote",
			children
		}, key);
		case "list": return /* @__PURE__ */ jsx(node.listType === "number" ? "ol" : "ul", {
			className: getListClassName(node.listType),
			start: node.start !== 1 ? node.start : void 0,
			children
		}, key);
		case "listitem": {
			const isChecklist = node.checked !== void 0;
			const hasNestedList = node.children?.some((c) => c.type === "list");
			const value = typeof node.value === "number" && node.value > 1 ? node.value : void 0;
			let cls = "editor_listItem";
			if (hasNestedList) cls = "editor_listItemNested";
			else if (isChecklist) cls = node.checked ? "editor_listItem editor_listItemChecked" : "editor_listItem editor_listItemUnchecked";
			return /* @__PURE__ */ jsx("li", {
				className: cls,
				role: isChecklist ? "checkbox" : void 0,
				value,
				children
			}, key);
		}
		case "link":
		case "autolink": return /* @__PURE__ */ jsx("a", {
			href: sanitizeUrl(node.url),
			rel: node.rel || "noopener noreferrer",
			target: node.target || void 0,
			children
		}, key);
		case "linkHighlight": return /* @__PURE__ */ jsx("a", {
			href: textContent ? sanitizeUrl(formatLinkHighlightUrl(textContent)) : void 0,
			rel: "noopener noreferrer",
			target: "_blank",
			children
		}, key);
		case "table": return /* @__PURE__ */ jsx("div", {
			className: getTableWrapperClassName(),
			children: /* @__PURE__ */ jsx("table", {
				className: "editor_table",
				children: /* @__PURE__ */ jsx("tbody", { children })
			})
		}, key);
		case "tablerow": return /* @__PURE__ */ jsx("tr", { children }, key);
		case "tablecell": {
			const isHeader = !!node.headerState;
			const CellTag = isHeader ? "th" : "td";
			const cls = isHeader ? "editor_table_cell editor_table_cell_header" : "editor_table_cell";
			const cellStyle = {};
			if (node.width) cellStyle.width = `${node.width}px`;
			if (node.backgroundColor) cellStyle.backgroundColor = node.backgroundColor;
			if (node.verticalAlign) cellStyle.verticalAlign = node.verticalAlign;
			return /* @__PURE__ */ jsx(CellTag, {
				className: cls,
				colSpan: node.colSpan > 1 ? node.colSpan : void 0,
				rowSpan: node.rowSpan > 1 ? node.rowSpan : void 0,
				style: Object.keys(cellStyle).length > 0 ? cellStyle : void 0,
				children
			}, key);
		}
		case "linebreak": return /* @__PURE__ */ jsx("br", {}, key);
		case "tab": return /* @__PURE__ */ jsx("span", { children: "	" }, key);
		case "codeInline": return /* @__PURE__ */ jsx("code", {
			className: "editor_code",
			children
		}, key);
		case "code-highlight":
			if (node.style) return /* @__PURE__ */ jsx("span", {
				style: parseCSSText(node.style),
				children: node.text
			}, key);
			return /* @__PURE__ */ jsx("span", { children: node.text }, key);
		case "diff": return renderDiffNode(node, key, children);
		case "cursor": return null;
		default:
			console.warn(`[LexicalRenderer] Unknown node type: "${node.type}"`);
			return children ?? null;
	}
}
//#endregion
//#region src/renderer/engine/render-text-node.tsx
const FORMAT_TAGS = [
	[1, "strong"],
	[2, "em"],
	[4, "s"],
	[8, "u"],
	[16, "code"],
	[32, "sub"],
	[64, "sup"],
	[128, "mark"]
];
function shouldPreserveWhitespace(text) {
	return /[\t\n]| {2,}|^ | $/.test(text);
}
function renderTextNode(node, key) {
	const style = node.style ? parseCSSText(node.style) : void 0;
	const preserveWhitespace = shouldPreserveWhitespace(node.text);
	let element = node.text;
	const format = node.format || 0;
	for (const [flag, tag] of FORMAT_TAGS) if (format & flag) element = createElement(tag, { key: `${key}-${flag}` }, element);
	if (style || preserveWhitespace) element = createElement("span", {
		key,
		style: {
			...style,
			...preserveWhitespace ? { whiteSpace: "break-spaces" } : void 0
		}
	}, element);
	return element;
}
//#endregion
//#region src/renderer/engine/render-tree.ts
function isHeadlessRenderableNode(node) {
	return typeof node.renderHeadless === "function";
}
function renderNode(node, registry, headingSlugs, overrides, key, renderContext) {
	const type = node.getType();
	if (type === "cursor") return null;
	if ($isTextNode(node)) return renderTextNode(node.exportJSON(), key);
	const serialized = node.exportJSON();
	let children = null;
	if ($isElementNode(node)) {
		const childNodes = node.getChildren();
		if (childNodes.length > 0) children = childNodes.map((child, i) => renderNode(child, registry, headingSlugs, overrides, `${key}-${i}`, renderContext));
	}
	const textContent = node.getTextContent ? node.getTextContent() : void 0;
	const override = overrides?.[type];
	if (override) return override(serialized, key, children);
	if (isHeadlessRenderableNode(node)) {
		const context = {
			children,
			extra: renderContext?.extra,
			key,
			variant: renderContext?.variant
		};
		return node.renderHeadless(context);
	}
	const renderer = registry.get(type);
	if (renderer) return renderer(serialized, key, children);
	return renderBuiltinNode(serialized, key, children, headingSlugs, textContent);
}
//#endregion
//#region src/renderer/nodes/index.ts
const rendererNodes = [
	HeadingNode,
	QuoteNode,
	ListNode,
	ListItemNode,
	TableNode,
	TableRowNode,
	TableCellNode,
	ImageNode,
	BlockImageNode,
	MathInlineNode,
	MathBlockNode,
	CodeMirrorNode,
	HorizontalRuleNode,
	MentionNode,
	FileNode,
	CodeNode,
	LinkNode,
	AutoLinkNode,
	CursorNode,
	LinkHighlightNode,
	PlaceholderNode,
	PlaceholderBlockNode
];
//#endregion
//#region src/renderer/renderers/MermaidPreviewBlock.tsx
function isLikelyInteractiveTarget(target) {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(target.closest?.("button, a[href], [role=\"button\"], input, textarea, select"));
}
/**
* Preview-only Mermaid block: renders the diagram by default; clicking the chart area
* shows the source above; clicking outside the block hides the source again.
*/
const MermaidPreviewBlock = memo(function MermaidPreviewBlock({ blockKey, code }) {
	const trimmed = (code ?? "").trim();
	const [sourceVisible, setSourceVisible] = useState(false);
	const rootRef = useRef(null);
	const openSource = useCallback((e) => {
		if (e && isLikelyInteractiveTarget(e.target)) return;
		setSourceVisible(true);
	}, []);
	useEffect(() => {
		if (!sourceVisible) return;
		const onDocPointerDown = (event) => {
			if (!rootRef.current?.contains(event.target)) setSourceVisible(false);
		};
		document.addEventListener("mousedown", onDocPointerDown, true);
		return () => document.removeEventListener("mousedown", onDocPointerDown, true);
	}, [sourceVisible]);
	return /* @__PURE__ */ jsxs("div", {
		"data-code-type": "mermaid",
		ref: rootRef,
		style: { width: "100%" },
		children: [sourceVisible && /* @__PURE__ */ jsx("div", {
			style: {
				marginBlockEnd: 8,
				width: "100%"
			},
			children: /* @__PURE__ */ jsx(Highlighter, {
				defaultExpand: true,
				language: "mermaid",
				variant: "filled",
				children: trimmed
			})
		}), /* @__PURE__ */ jsx("div", {
			"aria-expanded": sourceVisible,
			"aria-label": sourceVisible ? "Mermaid 图表（已展开源码）" : "Mermaid 图表，点击或按 Enter 在上方查看源码",
			onClick: (e) => openSource(e),
			onKeyDown: (e) => {
				if (!sourceVisible && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					setSourceVisible(true);
				}
			},
			role: "group",
			style: {
				cursor: sourceVisible ? "default" : "pointer",
				outline: "none",
				width: "100%"
			},
			tabIndex: 0,
			children: /* @__PURE__ */ jsx("div", {
				style: {
					maxHeight: "min(480px, 55vh)",
					overflowX: "auto",
					overflowY: "auto",
					width: "100%"
				},
				children: /* @__PURE__ */ jsx(MermaidWithErrorBoundary, {
					animated: false,
					copyable: true,
					fullFeatured: false,
					showLanguage: true,
					style: {
						height: "auto",
						maxWidth: "100%",
						width: "100%"
					},
					theme: "lobe-theme",
					variant: "filled",
					children: trimmed
				}, blockKey ?? trimmed.slice(0, 32))
			})
		})]
	});
});
MermaidPreviewBlock.displayName = "MermaidPreviewBlock";
//#endregion
//#region src/renderer/renderers/mermaid.tsx
function renderMermaidBlock(node, key) {
	return /* @__PURE__ */ jsx(MermaidPreviewBlock, {
		blockKey: key,
		code: node.code || ""
	}, key);
}
//#endregion
//#region src/renderer/renderers/codeblock.tsx
function CodeBlockRenderer({ node }) {
	const language = node.language || "";
	const code = node.code || "";
	return /* @__PURE__ */ jsx(Highlighter, {
		defaultExpand: true,
		language: language || "text",
		variant: "filled",
		children: code
	});
}
function renderCodeBlock(node, key) {
	if ((node.language || "").toLowerCase() === "mermaid") return renderMermaidBlock(node, key);
	return /* @__PURE__ */ jsx(CodeBlockRenderer, { node }, key);
}
//#endregion
//#region src/renderer/renderers/file.tsx
function renderFile(node, key) {
	const { name, fileUrl, status, message } = node;
	const cls = styles$6.file;
	if (status === "error") return /* @__PURE__ */ jsxs("span", {
		className: cls,
		"data-file-status": "error",
		children: [
			name,
			": ",
			message || "Upload failed"
		]
	}, key);
	if (status === "pending" || !fileUrl) return /* @__PURE__ */ jsx("span", {
		className: cls,
		"data-file-status": "pending",
		children: name
	}, key);
	return /* @__PURE__ */ jsx("a", {
		className: cls,
		download: name,
		href: fileUrl,
		children: name
	}, key);
}
//#endregion
//#region src/renderer/renderers/horizontalrule.tsx
const useStyles = createStaticStyles(({ css, cssVar }) => css`
    display: flex;
    align-items: center;

    width: 100%;
    height: calc(var(--lobe-markdown-margin-multiple) * 1em);
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 1em);

    hr {
      width: 100%;
      border-color: ${cssVar.colorBorder};
      border-style: dashed;
      border-width: 1px;
      border-block-start: none;
      border-inline-start: none;
      border-inline-end: none;
    }
  `);
function renderHR(_node, key) {
	return createElement("div", {
		className: useStyles,
		key
	}, createElement("hr"));
}
//#endregion
//#region src/renderer/renderers/image.tsx
function renderImage(node, key) {
	const { src, altText, width, height, maxWidth } = node;
	const style = {};
	if (maxWidth) style.maxWidth = maxWidth;
	if (width && width !== "inherit") style.width = width;
	if (height && height !== "inherit") style.height = height;
	return /* @__PURE__ */ jsx("span", {
		className: getImageClassName(),
		children: /* @__PURE__ */ jsx(Image, {
			alt: altText || "",
			preview: {},
			src,
			styles: { image: {
				...style,
				cursor: "zoom-in"
			} }
		})
	}, key);
}
function renderBlockImage(node, key) {
	const { src, altText, width, height, maxWidth } = node;
	const style = {};
	if (maxWidth) style.maxWidth = maxWidth;
	if (width && width !== "inherit") style.width = width;
	if (height && height !== "inherit") style.height = height;
	return /* @__PURE__ */ jsx("figure", {
		className: getBlockImageClassName(),
		children: /* @__PURE__ */ jsx(Image, {
			alt: altText || "",
			preview: {},
			src,
			styles: { image: {
				...style,
				cursor: "zoom-in"
			} }
		})
	}, key);
}
//#endregion
//#region src/renderer/renderers/math.tsx
function renderMath(node, key) {
	const code = node.code || "";
	const displayMode = node.type === "mathBlock";
	const html = katex.renderToString(code, {
		displayMode,
		throwOnError: false
	});
	return createElement(displayMode ? "div" : "span", {
		className: displayMode ? getMathBlockClassName() : getMathInlineClassName(),
		dangerouslySetInnerHTML: { __html: html },
		key
	});
}
//#endregion
//#region src/renderer/renderers/mention.tsx
function renderMention(node, key) {
	const label = node.label || "";
	return /* @__PURE__ */ jsx("span", {
		className: getMentionClassName(),
		children: /* @__PURE__ */ jsxs("span", {
			className: "editor_mention",
			children: ["@", label]
		})
	}, key);
}
//#endregion
//#region src/renderer/renderers/index.ts
function createDefaultRenderers() {
	return new Map([
		["image", renderImage],
		["block-image", renderBlockImage],
		["math", renderMath],
		["mathBlock", renderMath],
		["code", renderCodeBlock],
		["horizontalrule", renderHR],
		["mention", renderMention],
		["file", renderFile]
	]);
}
//#endregion
//#region src/renderer/LexicalRenderer.tsx
function LexicalRenderer({ value, overrides, extraNodes, renderContext, as: Tag = "div", className, style, variant }) {
	const content = useMemo(() => {
		const nodes = extraNodes ? [...rendererNodes, ...extraNodes] : rendererNodes;
		const registry = createDefaultRenderers();
		const editor = createHeadlessEditor({
			editable: false,
			nodes,
			onError: (error) => {
				console.error("[LexicalRenderer]", error);
			}
		});
		const state = editor.parseEditorState(value);
		editor.setEditorState(state);
		let result = null;
		const headingSlugs = /* @__PURE__ */ new Map();
		state.read(() => {
			result = $getRoot().getChildren().map((child, i) => renderNode(child, registry, headingSlugs, overrides, `r-${i}`, {
				...renderContext,
				variant
			}));
		});
		return result;
	}, [
		value,
		overrides,
		extraNodes,
		renderContext,
		variant
	]);
	const cssVars = getCSSVariables(variant);
	return createElement(Tag, {
		className: getRendererClassName(className),
		style: {
			...cssVars,
			...style
		}
	}, createElement("div", null, content));
}
//#endregion
//#region src/renderer/diff/style.ts
const base = createStaticStyles(({ css, cssVar }) => ({
	body: css`
    display: flex;
    flex-direction: column;
    background: ${cssVar.colorBgContainer};
  `,
	cell: css`
    overflow: auto;

    min-width: 0;
    min-height: 24px;
    padding-block: 8px;
    padding-inline: 16px;

    > div {
      width: 100%;
      min-width: 0;
    }
  `,
	deleteCell: css`
    background: color-mix(in srgb, ${cssVar.colorError} 10%, transparent);
  `,
	emptyCell: css`
    background: ${cssVar.colorFillQuaternary};
  `,
	insertCell: css`
    background: color-mix(in srgb, ${cssVar.colorSuccess} 10%, transparent);
  `,
	row: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  `
}));
const defaultOverrides = createStaticStyles(({ css, cssVar }) => ({
	header: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorFillQuaternary};
  `,
	headerCell: css`
    padding-block: 8px;
    padding-inline: 16px;

    font-size: 12px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `,
	headerOld: css`
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
	root: css`
    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 14px;

    background: ${cssVar.colorBgContainer};
  `
}));
const borderlessOverrides = createStaticStyles(({ css, cssVar }) => ({
	body: css`
    & > *:nth-child(odd) {
      background: ${cssVar.colorFillQuaternary};
    }
  `,
	header: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  `,
	headerCell: css`
    padding-block: 8px;
    padding-inline: 16px;

    font-size: 12px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `,
	root: css`
    overflow: hidden;
    font-size: 14px;
    background: ${cssVar.colorBgContainer};
  `
}));
function merge(baseSet, overrides) {
	const result = {};
	const allKeys = new Set([...Object.keys(baseSet), ...Object.keys(overrides)]);
	for (const key of allKeys) result[key] = cx(baseSet[key], overrides[key]);
	return result;
}
const diffStyles = {
	borderless: merge(base, borderlessOverrides),
	default: merge(base, defaultOverrides)
};
//#endregion
//#region src/renderer/LexicalDiff.tsx
function wrapBlock(block) {
	return { root: {
		children: [block],
		direction: "ltr",
		format: "",
		indent: 0,
		type: "root",
		version: 1
	} };
}
function RowCell({ className, content }) {
	return /* @__PURE__ */ jsx("div", {
		className,
		children: content
	});
}
function LexicalDiff({ oldValue, newValue, variant = "default", appearance = "default", extraNodes, overrides, renderContext, labels, blockRenderers, renderBlockDiff, className, style }) {
	const styles = diffStyles[appearance];
	const rows = useMemo(() => computeLexicalDiffRows(oldValue, newValue), [oldValue, newValue]);
	const renderDefaultCell = (block) => {
		if (!block) return null;
		return /* @__PURE__ */ jsx(LexicalRenderer, {
			extraNodes,
			overrides,
			renderContext,
			value: wrapBlock(block),
			variant
		});
	};
	const renderRow = (row, index) => {
		const blockType = row.oldCell?.blockType && row.newCell?.blockType ? row.oldCell.blockType === row.newCell.blockType ? row.oldCell.blockType : null : row.oldCell?.blockType ?? row.newCell?.blockType ?? null;
		const baseBlockType = row.oldCell?.baseBlockType && row.newCell?.baseBlockType ? row.oldCell.baseBlockType === row.newCell.baseBlockType ? row.oldCell.baseBlockType : null : row.oldCell?.baseBlockType ?? row.newCell?.baseBlockType ?? null;
		const context = {
			baseBlockType,
			blockType,
			newBaseBlockType: row.newCell?.baseBlockType ?? null,
			newBlockType: row.newCell?.blockType ?? null,
			oldBaseBlockType: row.oldCell?.baseBlockType ?? null,
			oldBlockType: row.oldCell?.blockType ?? null,
			renderDefaultNew: () => renderDefaultCell(row.newCell?.block ?? null),
			renderDefaultOld: () => renderDefaultCell(row.oldCell?.block ?? null),
			row
		};
		const renderers = [
			blockType ? blockRenderers?.[blockType] : void 0,
			baseBlockType && baseBlockType !== blockType ? blockRenderers?.[baseBlockType] : void 0,
			renderBlockDiff
		];
		let rendered;
		for (const renderer of renderers) {
			if (!renderer) continue;
			const next = renderer(context);
			if (next === null) continue;
			rendered = next;
			break;
		}
		const oldContent = rendered?.old ?? context.renderDefaultOld();
		const newContent = rendered?.new ?? context.renderDefaultNew();
		return /* @__PURE__ */ jsxs("div", {
			className: styles.row,
			children: [/* @__PURE__ */ jsx(RowCell, {
				className: cx(styles.cell, !row.oldCell && styles.emptyCell, row.kind === "delete" && styles.deleteCell),
				content: oldContent
			}), /* @__PURE__ */ jsx(RowCell, {
				className: cx(styles.cell, !row.newCell && styles.emptyCell, row.kind === "insert" && styles.insertCell),
				content: newContent
			})]
		}, `row-${index}`);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: cx(styles.root, className),
		style,
		children: [/* @__PURE__ */ jsxs("div", {
			className: styles.header,
			children: [/* @__PURE__ */ jsx("div", {
				className: cx(styles.headerCell, styles.headerOld),
				children: labels?.old ?? "Old"
			}), /* @__PURE__ */ jsx("div", {
				className: styles.headerCell,
				children: labels?.new ?? "New"
			})]
		}), /* @__PURE__ */ jsx("div", {
			className: styles.body,
			children: rows.map(renderRow)
		})]
	});
}
//#endregion
export { LexicalDiff, LexicalRenderer, computeLexicalDiffRows, createDefaultRenderers, loadLanguage, rendererNodes };
