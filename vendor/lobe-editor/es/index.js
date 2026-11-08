import { A as __toCommonJS, C as noop, E as unregisterEditorKernel, S as moment, T as registerEditorKernel, _ as getNodeKeyFromDOMNode, a as DOM_DOCUMENT_FRAGMENT_TYPE, b as isDOMNode, c as DOM_TEXT_TYPE, d as compareNodeOrder, f as createEmptyEditorState, g as getKernelFromEditorConfig, h as getKernelFromEditor, i as $getNodeFromDOMNode, l as EDITOR_THEME_KEY, m as generateEditorId, n as $closestNodeType, o as DOM_DOCUMENT_TYPE, p as genServiceId, r as $getNearestNodeFromDOMNode, s as DOM_ELEMENT_TYPE, t as $closest, u as assert, v as getParentElement, w as reconcileDecorator, x as isDocumentFragment, y as init_utils } from "./utils-DR6xvOCh.js";
import { $ as HOVER_COMMAND, B as $isCursorNode, C as formatUrl, Ct as INodeHelper, D as supportedLanguagesInfo, Dt as zhCN, E as resolveSupportedLanguageId, Et as init_locale, F as $createCodeMirrorNode, G as Editor, I as $isCodeMirrorNode, J as Kernel, K as resetRandomKey, L as CodeMirrorNode, O as $createCodeNode$1, Q as init_plugin, R as $createCursorNode, S as TOGGLE_LINK_COMMAND, St as init_utils$1, Tt as enUS, U as cursorNodeSerialized, V as CardLikeElementNode, X as kernel_exports, Y as init_kernel, Z as KernelPlugin, _ as AutoLinkNode, a as $createMathBlockNode, at as HotkeyScopeEnum, b as HOVER_OUT_LINK_COMMAND, c as MathBlockNode, ct as browserDebug, dt as debugLoggers, et as getHotkeyById, f as LinkHighlightNode, ft as debug_exports, g as $toggleLink, h as $isLinkNode, ht as prodSafeLogger, it as HotkeyEnum, j as CodeNode$1, l as MathInlineNode, lt as createDebugLogger, m as $createLinkNode, mt as init_debug, nt as CONTROL_OR_META, o as $createMathInlineNode, ot as KeyEnum, pt as devConsole, q as DataSource, rt as init_sys, s as $isMathNode, st as init_hotkey, tt as init_registerHotkey, u as $createLinkHighlightNode, ut as debugLogger, v as EDIT_LINK_COMMAND, w as SUPPORTED_SHIKI_LANGUAGE_IDS, wt as init_helper, x as LinkNode, xt as exportNodeToJSON, y as HOVER_LINK_COMMAND, z as $isCardLikeElementNode } from "./style-B85viVq4.js";
import { A as INodePlugin, B as MARKDOWN_READER_LEVEL_HIGH, C as registerCheckList, D as $isSelectionInCodeContext, E as ReactPlainText, F as CommonPlugin, G as INSERT_HEADING_COMMAND, H as MARKDOWN_WRITER_LEVEL_MAX, I as isPasteTargetCodeEditor, J as ReactEditor, K as INSERT_QUOTE_COMMAND, L as isPasteTargetNativeFormControl, M as GET_MARKDOWN_SELECTION_COMMAND, N as INSERT_MARKDOWN_COMMAND, O as MarkdownPlugin, P as ReactEditorContent, R as scrollIntoView, S as INSERT_CHECK_LIST_COMMAND, T as registerCodeInlineCommand, U as isPunctuationChar, V as MARKDOWN_READER_LEVEL_NORMAL, W as parseMarkdownToLexical, Y as LexicalErrorBoundary, _ as registerCodeCommand, a as ReactMentionPlugin, b as ReactMarkdownPlugin, c as INSERT_LINK_HIGHLIGHT_COMMAND, d as getSelectedNode, f as sanitizeUrl, g as UPDATE_CODEBLOCK_LANG, h as CustomShikiTokenizer, i as SlashPlugin, j as INodeService, k as looksLikeMermaidDiagramSyntax, l as registerLinkHighlightCommand, m as useLexicalNodeSelection, n as ReactSlashOption, o as MentionPlugin, q as useLexicalEditor, r as SlashMenu, s as INSERT_MENTION_COMMAND, t as ReactSlashPlugin, u as extractUrlFromText, v as registerCodeHighlighting, w as INSERT_CODEINLINE_COMMAND, x as useTranslation, y as toCodeTheme, z as IMarkdownShortCutService } from "./ReactSlashPlugin-Dz3bYDG1.js";
import { r as useLexicalComposerContext } from "./react-context-DwwzSNVm.js";
import { S as MermaidWithErrorBoundary, _ as PlaceholderBlockNode, a as styles$15, b as $isHorizontalRuleNode, c as ImageNode, d as BlockImageNode, f as styles$14, g as computeLexicalDiffRows, h as FileNode, i as imageBroken, l as $createBlockImageNode, m as $isFileNode, n as styles$17, o as $createImageNode, p as $createFileNode, r as styles$16, s as $isImageNode, t as styles$18, u as $isBlockImageNode, v as PlaceholderNode, x as HorizontalRuleNode, y as $createHorizontalRuleNode } from "./style-Dl9d1VsS.js";
import { a as initialSvgForDiagram, n as EMPTY_META2D_DIAGRAM_JSON, r as EMPTY_META2D_PLACEHOLDER_SVG } from "./meta2dLight-JnDieCPZ.js";
import { $computeTableMapSkipCellCheck, $createTableNodeWithDimensions, $createTableSelection, $deleteTableColumnAtSelection, $deleteTableRowAtSelection, $findTableNode, $getElementForTableNode, $getNodeTriplet, $getTableAndElementByKey, $getTableCellNodeFromLexicalNode, $getTableColumnIndexFromTableCellNode, $getTableNodeFromLexicalNodeOrThrow, $getTableRowIndexFromTableCellNode, $insertTableColumnAtSelection, $insertTableRowAtSelection, $isTableCellNode, $isTableNode, $isTableRowNode, $isTableSelection, $mergeCells, $unmergeCell, TableCellHeaderStates, TableCellNode, TableNode, TableNode as TableNode$1, TableRowNode, getDOMCellFromTarget, getTableElement, getTableObserverFromTableElement, registerTableCellUnmergeTransform, registerTablePlugin, registerTableSelectionObserver, setScrollableTablesActive } from "@lexical/table";
import { debounce } from "es-toolkit/compat";
import EventEmitter from "eventemitter3";
import { $applyNodeReplacement, $createNodeSelection, $createParagraphNode, $createRangeSelection, $createTextNode, $getNearestNodeFromDOMNode as $getNearestNodeFromDOMNode$1, $getNodeByKey, $getPreviousSelection, $getRoot, $getSelection, $insertNodes, $isBlockElementNode, $isElementNode, $isNodeSelection, $isRangeSelection, $isRootNode, $isRootOrShadowRoot, $isTextNode, $normalizeSelection__EXPERIMENTAL, $parseSerializedNode, $setSelection, CLICK_COMMAND, COMMAND_PRIORITY_CRITICAL, COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_HIGH, COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_NORMAL, DROP_COMMAND, DecoratorNode, ElementNode, HISTORY_MERGE_TAG, INDENT_CONTENT_COMMAND, INSERT_TAB_COMMAND, KEY_BACKSPACE_COMMAND, KEY_DOWN_COMMAND, KEY_ESCAPE_COMMAND, KEY_TAB_COMMAND, OUTDENT_CONTENT_COMMAND, PASTE_COMMAND, SELECTION_CHANGE_COMMAND, SKIP_SCROLL_INTO_VIEW_TAG, TabNode, TextNode, createCommand, getDOMSelection, getDOMSelectionFromTarget, isHTMLElement, isModifierMatch } from "lexical";
import { $isHeadingNode, DRAG_DROP_PASTE } from "@lexical/rich-text";
import { $filter, $findMatchingParent, $getNearestBlockElementAncestorOrThrow, $getNearestNodeOfType, $insertNodeToNearestRoot, $wrapNodeInElement, addClassNamesToElement, calculateZoomLevel, mergeRegister, removeClassNamesFromElement } from "@lexical/utils";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Component, Suspense, createContext, forwardRef, lazy, memo, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import katex, { renderToString } from "katex";
import { $createListItemNode, $createListNode, $isListItemNode, $isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND as INSERT_ORDERED_LIST_COMMAND$1, INSERT_UNORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND as INSERT_UNORDERED_LIST_COMMAND$1, ListItemNode, ListNode, REMOVE_LIST_COMMAND, UPDATE_LIST_START_COMMAND, registerList, registerListStrictIndentTransform } from "@lexical/list";
import { $createCodeNode, $isCodeHighlightNode, $isCodeNode, CodeHighlightNode, CodeNode } from "@lexical/code-core";
import { createPortal } from "react-dom";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { ActionIcon, ActionIconGroup, Block, Button, Center, CopyButton, Dropdown, Flexbox, Hotkey, Icon, Input, InputNumber, LOBE_THEME_APP_ID, MaterialFileTypeIcon, Popover, Select, Text, TextArea } from "@lobehub/ui";
import { createStaticStyles, cssVar, cx, useThemeMode } from "antd-style";
import { Image as Image$1, Switch, message } from "antd";
import { BaselineIcon, Check, CheckIcon, ChevronDown, ChevronRight, ClipboardCopyIcon, CopyIcon, DownloadIcon, EditIcon, ExternalLinkIcon, Grid2X2XIcon, LinkIcon, ListTreeIcon, LoaderCircleIcon, MoreHorizontalIcon, PanelBottomCloseIcon, PanelLeftCloseIcon, PanelRightCloseIcon, PanelTopCloseIcon, PlusIcon, TableColumnsSplitIcon, TableRowsSplitIcon, UnlinkIcon, UploadIcon } from "lucide-react";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
//#region src/editor-kernel/react/PortalContainer.tsx
const LexicalPortalContainer = forwardRef(({ editor, node, children }, ref) => {
	const divRef = useRef(null);
	useImperativeHandle(ref, () => divRef.current, []);
	useEffect(() => {
		return () => {
			if (divRef.current) delete divRef.current[`__lexicalKey_${editor._key}`];
		};
	}, [editor, node]);
	return /* @__PURE__ */ jsx("div", {
		ref: (dom) => {
			divRef.current = dom;
			if (dom) {
				const prop = `__lexicalKey_${editor._key}`;
				dom[prop] = node.getKey();
			}
		},
		children
	});
});
LexicalPortalContainer.displayName = "LexicalPortalContainer";
//#endregion
//#region src/plugins/common/markmap-utils.ts
/**
* 递归统计节点总数
*/
function countNodes(node) {
	let count = 1;
	for (const child of node.children || []) count += countNodes(child);
	return count;
}
/**
* 递归设置所有节点的折叠状态
* @param fold true=折叠, false=展开
*/
function setFoldAll(node, fold) {
	for (const child of node.children || []) {
		child.payload = {
			...child.payload ?? {},
			fold: fold ? 1 : 0
		};
		setFoldAll(child, fold);
	}
}
//#endregion
//#region src/plugins/common/react/MarkmapWithErrorBoundary.tsx
var MarkmapRenderErrorBoundary = class extends Component {
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
	const errorMsg = error.message || "Markmap 渲染失败，请检查 Markdown 语法";
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
			children: "⚠️ Markmap 渲染失败"
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
const MIN_SCALE$1 = .2;
const MAX_SCALE$1 = 10;
const SCALE_STEP$1 = .25;
const clampScale = (v) => Math.min(Math.max(MIN_SCALE$1, v), MAX_SCALE$1);
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
	const zoomIn = useCallback(() => setScale((s) => clampScale(s + SCALE_STEP$1)), []);
	const zoomOut = useCallback(() => setScale((s) => clampScale(s - SCALE_STEP$1)), []);
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
						disabled: scale <= MIN_SCALE$1,
						onClick: zoomOut,
						style: {
							...btnBase,
							opacity: scale <= MIN_SCALE$1 ? .4 : 1
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
						disabled: scale >= MAX_SCALE$1,
						onClick: zoomIn,
						style: {
							...btnBase,
							opacity: scale >= MAX_SCALE$1 ? .4 : 1
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
/**
* 带完整错误处理的 Markmap 包装组件
*
* 错误捕获层级：
* 1. 预解析检测：Transformer.transform() 转换 Markdown 为 markmap 数据
* 2. 渲染错误边界：Class ErrorBoundary 捕获 React 渲染期间的错误
* 3. 代码变化时自动重置错误状态
*/
const MarkmapWithErrorBoundary = memo(({ children, enableImagePreview = true }) => {
	const markdown = children.trim();
	const containerRef = useRef(null);
	const markmapRef = useRef(null);
	const [error, setError] = useState(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [svgContent, setSvgContent] = useState("");
	useEffect(() => {
		let canceled = false;
		setError(null);
		setSvgContent("");
		if (!markdown || !containerRef.current) return;
		try {
			const { root } = new Transformer().transform(markdown);
			if (!root) throw new Error("无法解析 Markdown 内容");
			if (markmapRef.current) {
				markmapRef.current.destroy();
				markmapRef.current = null;
			}
			const container = containerRef.current;
			container.innerHTML = "";
			const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svgElement.style.width = "100%";
			svgElement.style.minHeight = "300px";
			container.append(svgElement);
			const markmap = new Markmap(svgElement);
			markmapRef.current = markmap;
			if (countNodes(root) > 30) setFoldAll(root, true);
			markmap.setData(root);
			requestAnimationFrame(() => {
				markmap.fit();
			});
			setTimeout(() => {
				if (!canceled && containerRef.current) {
					const svg = containerRef.current.querySelector("svg");
					if (svg) setSvgContent(svg.outerHTML);
				}
			}, 500);
		} catch (error_) {
			if (!canceled) setError(error_ instanceof Error ? error_ : new Error(String(error_)));
		}
		return () => {
			canceled = true;
			if (markmapRef.current) {
				markmapRef.current.destroy();
				markmapRef.current = null;
			}
		};
	}, [markdown]);
	const handlePreviewClick = useCallback((e) => {
		if (!enableImagePreview) return;
		e.stopPropagation();
		setPreviewOpen(true);
	}, [enableImagePreview]);
	const handlePreviewClose = useCallback(() => setPreviewOpen(false), []);
	const expandAll = useCallback(() => {
		if (!markmapRef.current) return;
		const data = markmapRef.current.state.data;
		if (!data) return;
		setFoldAll(data, false);
		markmapRef.current.renderData(data);
	}, []);
	const collapseAll = useCallback(() => {
		if (!markmapRef.current) return;
		const data = markmapRef.current.state.data;
		if (!data) return;
		setFoldAll(data, true);
		markmapRef.current.renderData(data);
	}, []);
	if (!markdown) return null;
	if (error) return /* @__PURE__ */ jsx(ErrorFallback, { error });
	return /* @__PURE__ */ jsx(MarkmapRenderErrorBoundary, {
		code: markdown,
		fallback: (err) => /* @__PURE__ */ jsx(ErrorFallback, { error: err }),
		children: /* @__PURE__ */ jsxs("div", {
			style: {
				position: "relative",
				width: "100%",
				minHeight: 200
			},
			children: [
				/* @__PURE__ */ jsx("div", {
					onClick: svgContent ? handlePreviewClick : void 0,
					ref: containerRef,
					style: {
						cursor: enableImagePreview && svgContent ? "zoom-in" : void 0,
						minHeight: 200,
						padding: 16,
						width: "100%"
					}
				}),
				/* @__PURE__ */ jsxs("div", {
					style: {
						alignItems: "center",
						background: "rgba(255,255,255,0.9)",
						backdropFilter: "blur(4px)",
						border: "1px solid #f0f0f0",
						borderRadius: 6,
						bottom: 8,
						boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
						display: "flex",
						gap: 4,
						left: 8,
						padding: "4px 8px",
						position: "absolute",
						zIndex: 10
					},
					children: [/* @__PURE__ */ jsx("button", {
						onClick: (e) => {
							e.stopPropagation();
							expandAll();
						},
						style: {
							background: "none",
							border: "1px solid #d9d9d9",
							borderRadius: 4,
							color: "#595959",
							cursor: "pointer",
							fontSize: 12,
							height: 24,
							padding: "0 6px"
						},
						title: "展开全部节点",
						type: "button",
						children: "⟱ 展开"
					}), /* @__PURE__ */ jsx("button", {
						onClick: (e) => {
							e.stopPropagation();
							collapseAll();
						},
						style: {
							background: "none",
							border: "1px solid #d9d9d9",
							borderRadius: 4,
							color: "#595959",
							cursor: "pointer",
							fontSize: 12,
							height: 24,
							padding: "0 6px"
						},
						title: "折叠全部节点",
						type: "button",
						children: "⟰ 折叠"
					})]
				}),
				previewOpen && svgContent && /* @__PURE__ */ jsx(SvgPreviewOverlay, {
					onClose: handlePreviewClose,
					svg: svgContent
				})
			]
		})
	});
});
MarkmapWithErrorBoundary.displayName = "MarkmapWithErrorBoundary";
//#endregion
//#region src/plugins/inode/react/index.tsx
const ReactNodePlugin = () => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(INodePlugin);
	}, [editor]);
	return null;
};
ReactNodePlugin.displayName = "ReactNodePlugin";
//#endregion
//#region src/plugins/code/plugin/registry.ts
init_helper();
init_plugin();
init_hotkey();
function registerCodeInline(editor, kernel, options) {
	const { enableHotkey = true } = options || {};
	return mergeRegister(editor.registerUpdateListener(({ mutatedNodes }) => {
		const keys = (mutatedNodes?.get(CodeNode$1))?.keys() || [];
		const needAddBefore = /* @__PURE__ */ new Set();
		editor.getEditorState().read(() => {
			for (const key of keys) {
				const node = $getNodeByKey(key);
				if (!node) return;
				if (node.getParent()?.getFirstChild() === node) needAddBefore.add(node);
			}
		});
		if (needAddBefore.size > 0) editor.update(() => {
			needAddBefore.forEach((node) => {
				if (!node.getPreviousSibling()) node.insertBefore($createCursorNode());
			});
		}, { tag: HISTORY_MERGE_TAG });
	}), kernel.registerHotkey(HotkeyEnum.CodeInline, () => editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, void 0), {
		enabled: enableHotkey,
		preventDefault: true,
		stopImmediatePropagation: true
	}));
}
//#endregion
//#region src/plugins/code/plugin/index.ts
const CodePlugin = class extends KernelPlugin {
	static {
		this.pluginName = "CodePlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		kernel.registerNodes([CodeNode$1]);
		kernel.registerThemes({ codeInline: config?.theme || "editor-code" });
	}
	onInit(editor) {
		this.register(registerCodeInlineCommand(editor));
		this.register(registerCodeInline(editor, this.kernel, { enableHotkey: this.config?.enableHotkey }));
		this.register(editor.registerNodeTransform(TextNode, (node) => {
			if (node.hasFormat("code")) node.replace($createCodeNode$1(node.getTextContent())).insertAfter($createCursorNode());
		}));
		this.registerMarkdown();
	}
	registerMarkdown() {
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!markdownService) return;
		markdownService.registerMarkdownWriter(CodeNode$1.getType(), (ctx, node) => {
			ctx.appendLine(`\`${node.getTextContent().replaceAll("﻿", "")}\``);
			return true;
		});
		markdownService.registerMarkdownShortCuts([{
			process: (selection) => {
				if (selection.getNodes().some((node) => node.getType() === CodeNode$1.getType())) return false;
				const text = selection.getTextContent();
				selection.removeText();
				selection.insertNodes([$createCodeNode$1(text), $createCursorNode()]);
				$setSelection(selection);
			},
			tag: "`",
			type: "text-format"
		}]);
		markdownService.registerMarkdownReader("inlineCode", (node) => {
			return [INodeHelper.createElementNode("codeInline", {
				children: [cursorNodeSerialized, INodeHelper.createTextNode(node.value || "", {})],
				direction: "ltr",
				format: "",
				indent: 0,
				type: "codeInline",
				version: 1
			}), cursorNodeSerialized];
		});
	}
};
//#endregion
//#region src/plugins/hr/command/index.ts
const INSERT_HORIZONTAL_RULE_COMMAND = createCommand("INSERT_HORIZONTAL_RULE_COMMAND");
function registerHorizontalRuleCommand(editor) {
	return editor.registerCommand(INSERT_HORIZONTAL_RULE_COMMAND, () => {
		editor.update(() => {
			$insertNodes([$createHorizontalRuleNode()]);
		});
		return true;
	}, COMMAND_PRIORITY_EDITOR);
}
//#endregion
//#region src/plugins/hr/plugin/index.ts
init_helper();
init_plugin();
const HRPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "HRPlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		kernel.registerNodes([HorizontalRuleNode]);
		kernel.registerThemes({ hr: config?.theme || "" });
		this.registerDecorator(kernel, "horizontalrule", (node, editor) => {
			return config?.decorator ? config.decorator(node, editor) : null;
		});
	}
	onInit(editor) {
		this.register(registerHorizontalRuleCommand(editor));
		this.registerMarkdown();
	}
	registerMarkdown() {
		this.kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
			regExp: /^(---|\*\*\*|___)$/,
			replace: (parentNode, _1, _2, isImport) => {
				const line = $createHorizontalRuleNode();
				if (isImport || parentNode.getNextSibling()) parentNode.replace(line);
				else parentNode.insertBefore(line);
				line.selectNext();
			},
			trigger: "enter",
			type: "element"
		});
		this.kernel.requireService(IMarkdownShortCutService)?.registerMarkdownWriter(HorizontalRuleNode.getType(), (ctx, node) => {
			if ($isHorizontalRuleNode(node)) ctx.appendLine("---\n\n");
		});
		this.kernel.requireService(IMarkdownShortCutService)?.registerMarkdownReader("thematicBreak", () => {
			return INodeHelper.createElementNode("horizontalrule", {});
		});
	}
};
//#endregion
//#region src/utils/cx.ts
const cx$1 = (...classNames) => classNames.filter(Boolean).join(" ");
//#endregion
//#region src/plugins/list/utils/index.ts
const LIST_INDENT_SIZE = 4;
function getIndent(whitespaces) {
	const tabs = whitespaces.match(/\t/g);
	const spaces = whitespaces.match(/ /g);
	let indent = 0;
	if (tabs) indent += tabs.length;
	if (spaces) indent += Math.floor(spaces.length / LIST_INDENT_SIZE);
	return indent;
}
const listReplace = (listType) => {
	return (parentNode, children, match, isImport) => {
		const previousNode = parentNode.getPreviousSibling();
		const nextNode = parentNode.getNextSibling();
		const listItem = $createListItemNode(listType === "check" ? match[3] === "x" : void 0);
		if ($isListNode(nextNode) && nextNode.getListType() === listType) {
			const firstChild = nextNode.getFirstChild();
			if (firstChild !== null) firstChild.insertBefore(listItem);
			else nextNode.append(listItem);
			parentNode.remove();
		} else if ($isListNode(previousNode) && previousNode.getListType() === listType) {
			previousNode.append(listItem);
			parentNode.remove();
		} else {
			const list = $createListNode(listType, listType === "number" ? Number(match[2]) : void 0);
			list.append(listItem);
			parentNode.replace(list);
		}
		listItem.append(...children);
		if (!isImport) listItem.select(0, 0);
		const indent = getIndent(match[1]);
		if (indent) listItem.setIndent(indent);
	};
};
function $indentOverTab(selection) {
	if ($filter(selection.getNodes(), (node) => {
		if ($isBlockElementNode(node) && node.canIndent()) return node;
		return null;
	}).length > 0) return true;
	const anchor = selection.anchor;
	const focus = selection.focus;
	const first = focus.isBefore(anchor) ? focus : anchor;
	const firstBlock = $getNearestBlockElementAncestorOrThrow(first.getNode());
	if (firstBlock.canIndent()) {
		const firstBlockKey = firstBlock.getKey();
		let selectionAtStart = $createRangeSelection();
		selectionAtStart.anchor.set(firstBlockKey, 0, "element");
		selectionAtStart.focus.set(firstBlockKey, 0, "element");
		selectionAtStart = $normalizeSelection__EXPERIMENTAL(selectionAtStart);
		if (selectionAtStart.anchor.is(first)) return true;
	}
	return false;
}
//#endregion
//#region src/plugins/list/plugin/registry.ts
init_hotkey();
function registerListCommands(editor, kernel, options) {
	const { enableHotkey = true } = options || {};
	return mergeRegister(kernel.registerHotkey(HotkeyEnum.BulletList, () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND$1, void 0), {
		enabled: enableHotkey,
		preventDefault: true,
		stopImmediatePropagation: true
	}), kernel.registerHotkey(HotkeyEnum.NumberList, () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND$1, void 0), {
		enabled: enableHotkey,
		preventDefault: true,
		stopImmediatePropagation: true
	}), editor.registerCommand(KEY_TAB_COMMAND, (event) => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return false;
		event.preventDefault();
		const command = $indentOverTab(selection) ? event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND : INSERT_TAB_COMMAND;
		return editor.dispatchCommand(command, void 0);
	}, COMMAND_PRIORITY_EDITOR), editor.registerCommand(KEY_BACKSPACE_COMMAND, (event) => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
		const anchor = selection.anchor;
		if (anchor.offset !== 0) return false;
		const anchorNode = anchor.getNode();
		let listItemNode;
		if ($isListItemNode(anchorNode)) listItemNode = anchorNode;
		else if ($isTextNode(anchorNode)) {
			if (anchorNode.getPreviousSibling()) return false;
			const parent = anchorNode.getParentOrThrow();
			if (!$isListItemNode(parent)) return false;
			listItemNode = parent;
		}
		if (!listItemNode || !$isRootNode(listItemNode.getParent()?.getParent())) return false;
		const listNode = listItemNode.getParentOrThrow();
		queueMicrotask(() => {
			editor.update(() => {
				if (!listItemNode) return;
				let newlistNode;
				if (listItemNode.getPreviousSibling() === null) {
					listItemNode.replace($createParagraphNode(), true).select(0, 0);
					return;
				}
				let next = listItemNode.getNextSibling();
				if (next) newlistNode = $createListNode(listNode.getListType(), listItemNode.getValue());
				while (next && newlistNode) {
					next.remove();
					newlistNode.append(next);
					next = next.getNextSibling();
				}
				const p = listItemNode.replace($createParagraphNode(), true);
				p.remove();
				listNode.insertAfter(p);
				if (newlistNode) p.insertAfter(newlistNode);
				p.select(0, 0);
			});
		});
		event.stopImmediatePropagation();
		event.preventDefault();
		return true;
	}, COMMAND_PRIORITY_LOW));
}
//#endregion
//#region src/plugins/list/plugin/index.ts
init_helper();
init_plugin();
const ORDERED_LIST_REGEX = /^(\s*)(\d+)\.\s/;
const UNORDERED_LIST_REGEX = /^(\s*)[*+-]\s/;
const CHECK_LIST_REGEX = /^(\s*)(?:-\s)?\s?(\[(\s|x)?])\s/i;
const ListPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "ListPlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		kernel.registerNodes([ListNode, ListItemNode]);
		kernel.registerThemes({ list: {
			checklist: "editor_listItemCheck",
			listitem: "editor_listItem",
			listitemChecked: "editor_listItemChecked",
			listitemUnchecked: "editor_listItemUnchecked",
			nested: { listitem: "editor_listItemNested" },
			ol: cx$1("editor_listOrdered", config?.theme),
			olDepth: [
				"editor_listOrdered dp1",
				"editor_listOrdered dp2",
				"editor_listOrdered dp3",
				"editor_listOrdered dp4",
				"editor_listOrdered dp5"
			],
			ul: cx$1("editor_listUnordered", config?.theme)
		} });
	}
	onInit(editor) {
		this.register(registerList(editor));
		this.register(registerCheckList(editor));
		this.register(registerListStrictIndentTransform(editor));
		this.register(registerListCommands(editor, this.kernel, { enableHotkey: this.config?.enableHotkey }));
		this.registerMarkdown();
	}
	registerMarkdown() {
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!markdownService) return;
		markdownService.registerMarkdownShortCut({
			regExp: UNORDERED_LIST_REGEX,
			replace: listReplace("bullet"),
			type: "element"
		});
		markdownService.registerMarkdownShortCut({
			regExp: ORDERED_LIST_REGEX,
			replace: listReplace("number"),
			type: "element"
		});
		markdownService.registerMarkdownShortCut({
			regExp: CHECK_LIST_REGEX,
			replace: listReplace("check"),
			type: "element"
		});
		markdownService.registerMarkdownWriter(ListNode.getType(), (ctx, node) => {
			if ($isListNode(node)) {
				const prefix = $isListItemNode(node.getParent()) ? "\n" : "";
				ctx.wrap(prefix, "\n");
			}
		});
		const getLevel = (node) => {
			if (!node) return 0;
			if ($isRootNode(node.getParent())) return 0;
			const parent = node.getParent();
			if (!parent) return 0;
			return getLevel($getNearestNodeOfType(parent, ListNode)) + 1;
		};
		markdownService.registerMarkdownWriter(ListItemNode.getType(), (ctx, node) => {
			const parent = node.getParent();
			if ($isListItemNode(node) && $isListNode(parent)) {
				if ($isListNode(node.getFirstChild())) return;
				const level = getLevel(parent);
				const prefix = "    ".repeat(level);
				switch (parent.getListType()) {
					case "bullet":
						ctx.wrap(prefix + "- ", "\n");
						break;
					case "number":
						ctx.wrap(`${prefix}${node.getValue()}. `, "\n");
						break;
					case "check":
						ctx.wrap(`${prefix}- [${node.getChecked() ? "x" : " "}] `, "\n");
						break;
					default: break;
				}
			}
		});
		markdownService.registerMarkdownReader("list", (node, children) => {
			const isCheck = node.children?.[0]?.type === "listItem" && typeof node.children?.[0]?.checked === "boolean";
			let start = node.start || 1;
			return INodeHelper.createElementNode("list", {
				children: children.map((v) => {
					if (v.type === "listitem") v.value = start++;
					return v;
				}),
				direction: "ltr",
				format: "",
				indent: 0,
				listType: isCheck ? "check" : node.ordered ? "number" : "bullet",
				start: node.start || 1,
				tag: node.ordered ? "ol" : "ul",
				version: 1
			});
		});
		markdownService.registerMarkdownReader("listItem", (node, children, index) => {
			const isCheck = typeof node.checked === "boolean";
			const listItemChildren = children.flatMap((v) => {
				if (v.type === "paragraph") return v.children || [];
				return v;
			});
			return INodeHelper.createElementNode("listitem", {
				checked: isCheck ? node.checked : void 0,
				children: listItemChildren,
				direction: "ltr",
				format: "",
				indent: 0,
				type: "listitem",
				value: index + 1,
				version: 1
			});
		});
	}
};
//#endregion
//#region src/plugins/table/command/index.ts
const INSERT_TABLE_COMMAND = createCommand();
const SELECT_TABLE_COMMAND = createCommand();
function registerTableCommand(editor) {
	return mergeRegister(editor.registerCommand(INSERT_TABLE_COMMAND, ({ rows, columns, includeHeaders }) => {
		const selection = $getSelection() || $getPreviousSelection();
		if (!selection || !$isRangeSelection(selection)) return false;
		if ($findTableNode(selection.anchor.getNode())) return false;
		const anchorNode = selection.anchor.getNode();
		const tableNode = $createTableNodeWithDimensions(Number(rows), Number(columns), includeHeaders);
		if ($isElementNode(anchorNode) && anchorNode.isEmpty()) anchorNode.replace(tableNode);
		else $insertNodeToNearestRoot(tableNode);
		const firstDescendant = tableNode.getFirstDescendant();
		if ($isTextNode(firstDescendant)) firstDescendant.select();
		return true;
	}, COMMAND_PRIORITY_EDITOR), editor.registerCommand(SELECT_TABLE_COMMAND, ({ table, columnIndex, rowIndex }) => {
		editor.update(() => {
			const prevSelection = $getSelection();
			const tableNode = $getNodeByKey(table);
			if (!tableNode || !$isTableNode(tableNode)) return;
			const tableSelection = $isTableSelection(prevSelection) ? prevSelection : $createTableSelection();
			if (rowIndex !== void 0) {
				const firstRow = tableNode.getChildren()[rowIndex];
				if (!firstRow) return;
				const firstCell = firstRow.getFirstChild();
				const lastCell = firstRow.getLastChild();
				if (!firstCell || !lastCell) return;
				tableSelection.set(table, firstCell.getKey(), lastCell.getKey());
				$setSelection(tableSelection);
			} else if (columnIndex !== void 0) {
				const firstRow = tableNode.getFirstChild();
				const lastRow = tableNode.getLastChild();
				if (!firstRow || !lastRow) return;
				const firstCell = firstRow.getChildren()[columnIndex];
				const lastCell = lastRow.getChildren()[columnIndex];
				if (!firstCell || !lastCell) return;
				tableSelection.set(table, firstCell.getKey(), lastCell.getKey());
				$setSelection(tableSelection);
			} else {
				const firstRow = tableNode.getFirstChild();
				const lastRow = tableNode.getLastChild();
				if (!firstRow || !lastRow) return;
				const firstCell = firstRow.getFirstChild();
				const lastCell = lastRow.getLastChild();
				if (!firstCell || !lastCell) return;
				tableSelection.set(table, firstCell.getKey(), lastCell.getKey());
				$setSelection(tableSelection);
			}
		});
		return false;
	}, COMMAND_PRIORITY_EDITOR));
}
//#endregion
//#region src/plugins/table/node/index.ts
const OriginalCreateDOM = TableNode.prototype.createDOM;
function patchTableNode() {
	Object.defineProperty(TableNode.prototype, "createDOM", {
		configurable: true,
		enumerable: false,
		value: function(config, editor) {
			const table = OriginalCreateDOM.call(this, config, editor);
			const controller = document.createElement("div");
			table.append(controller);
			return table;
		},
		writable: true
	});
}
//#endregion
//#region src/plugins/table/plugin/index.ts
init_helper();
init_plugin();
const tableCellProcessor = (before, content, after) => {
	return before + content.replace(/\n+$/, "").replaceAll(/\n+/g, "</br>") + after;
};
function isHeadlessEditor$1(editor) {
	return editor._headless === true;
}
const TablePlugin = class extends KernelPlugin {
	static {
		this.pluginName = "TablePlugin";
	}
	constructor(kernel, options) {
		super();
		this.kernel = kernel;
		patchTableNode();
		kernel.registerNodes([
			TableNode$1,
			TableRowNode,
			TableCellNode
		]);
		kernel.registerThemes({
			table: "editor_table",
			tableCell: "editor_table_cell",
			tableCellHeader: "editor_table_cell_header",
			tableCellSelected: "editor_table_cell_selected",
			tableScrollableWrapper: cx$1("editor_table_scrollable_wrapper", options?.theme)
		});
	}
	onInit(editor) {
		this.register(registerTableCellUnmergeTransform(editor));
		if (!isHeadlessEditor$1(editor)) {
			setScrollableTablesActive(editor, true);
			this.register(registerTablePlugin(editor));
			this.register(registerTableSelectionObserver(editor));
			this.register(registerTableCommand(editor));
		}
		this.registerMarkdown();
	}
	registerMarkdown() {
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!markdownService) return;
		markdownService.registerMarkdownWriter(TableNode$1.getType(), (ctx) => {
			ctx.wrap("", "\n");
		});
		markdownService.registerMarkdownWriter(TableRowNode.getType(), (ctx, node) => {
			const parent = node.getParent();
			if (!$isTableNode(parent)) return;
			if (!node.getPreviousSibling()) ctx.wrap("", `\n${parent.getColWidths()?.map(() => {
				return "|:--";
			}).join("")}|\n`);
			else ctx.wrap("", "\n");
		});
		markdownService.registerMarkdownWriter(TableCellNode.getType(), (ctx, node) => {
			ctx.addProcessor(tableCellProcessor);
			if (!node.getNextSibling()) ctx.wrap("|", "|");
			else ctx.wrap("|", "");
		});
		markdownService.registerMarkdownReader("table", (node, children) => {
			const colLen = node.children[0]?.children.length || 1;
			return INodeHelper.createElementNode("table", {
				children,
				colWidths: new Array(colLen).fill(750 / colLen),
				direction: null,
				format: "",
				indent: 0,
				version: 1
			});
		});
		markdownService.registerMarkdownReader("tableRow", (_node, children) => {
			return INodeHelper.createElementNode("tablerow", {
				children,
				direction: "ltr",
				format: "",
				height: 33,
				indent: 0,
				version: 1
			});
		});
		markdownService.registerMarkdownReader("tableCell", (_node, children) => {
			return INodeHelper.createElementNode("tablecell", {
				backgroundColor: null,
				children,
				colSpan: 1,
				direction: "ltr",
				format: "",
				headerState: 0,
				indent: 0,
				rowSpan: 1,
				version: 1
			});
		});
	}
};
//#endregion
//#region src/plugins/codeblock/utils/language.ts
function getCodeLanguageByInput(input) {
	return resolveSupportedLanguageId(input);
}
//#endregion
//#region src/headless/plugins/codeblock.ts
init_helper();
init_plugin();
const createCodeChildren = (code) => code.split("\n").flatMap((text, index, array) => {
	const textNode = INodeHelper.createTextNode(text);
	textNode.type = "code-highlight";
	if (index === array.length - 1) return textNode;
	return [textNode, {
		type: "linebreak",
		version: 1
	}];
}).flat();
const HeadlessCodeblockPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "HeadlessCodeblockPlugin";
	}
	constructor(kernel) {
		super();
		this.kernel = kernel;
		kernel.registerNodes([CodeNode, CodeHighlightNode]);
		kernel.registerThemes({ code: "editor-code" });
	}
	onInit() {
		this.registerMarkdown();
	}
	registerMarkdown() {
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!markdownService) return;
		markdownService.registerMarkdownWriter(CodeNode.getType(), (ctx, node) => {
			if ($isCodeNode(node)) ctx.wrap("```" + (node.getLanguage() || "") + "\n", "\n```\n");
		});
		markdownService.registerMarkdownWriter(TabNode.getType(), (ctx) => {
			ctx.appendLine("  ");
		});
		markdownService.registerMarkdownWriter(CodeHighlightNode.getType(), (ctx, node) => {
			if ($isCodeHighlightNode(node)) ctx.appendLine(node.getTextContent());
		});
		markdownService.registerMarkdownWriter("linebreak", (ctx, node) => {
			if ($isCodeNode(node.getParent())) ctx.appendLine("\n");
		});
		markdownService.registerMarkdownReader("code", (node) => {
			const language = node.lang ? getCodeLanguageByInput(node.lang) : "plaintext";
			return INodeHelper.createElementNode("code", {
				children: createCodeChildren(node.value),
				direction: "ltr",
				format: "",
				indent: 0,
				language,
				version: 1
			});
		});
	}
};
//#endregion
//#region src/headless/index.ts
const getNumericId = (id) => {
	if (typeof id !== "number" && typeof id !== "string") return null;
	const numericId = Number(id);
	return Number.isInteger(numericId) && numericId >= 0 ? numericId : null;
};
const findMaxSerializedId = (node) => {
	if (!node || typeof node !== "object") return -1;
	const record = node;
	const ownMax = getNumericId(record.id) ?? -1;
	if (!Array.isArray(record.children)) return ownMax;
	return record.children.reduce((maxId, child) => Math.max(maxId, findMaxSerializedId(child)), ownMax);
};
const createSerializedId = (context) => String(context.nextId++);
const createCodeChildrenFromLegacyCode = (code, context) => code.split("\n").flatMap((text, index, array) => {
	const textNode = {
		detail: 0,
		format: 0,
		id: createSerializedId(context),
		mode: "normal",
		style: "",
		text,
		type: "code-highlight",
		version: 1
	};
	if (index === array.length - 1) return textNode;
	return [textNode, {
		id: createSerializedId(context),
		type: "linebreak",
		version: 1
	}];
});
const normalizeLegacyEditorDataNode = (node, context) => {
	if (!node || typeof node !== "object") return node;
	const record = node;
	const children = Array.isArray(record.children) ? record.children.map((child) => normalizeLegacyEditorDataNode(child, context)) : record.children;
	if (record.type === "code" && typeof record.code === "string" && !Array.isArray(children)) return {
		...record,
		children: createCodeChildrenFromLegacyCode(record.code, context),
		direction: record.direction ?? "ltr",
		format: record.format ?? "",
		indent: record.indent ?? 0,
		language: record.language ?? "plaintext",
		theme: record.theme ?? record.codeTheme
	};
	if (Array.isArray(children)) return {
		...record,
		children
	};
	return record;
};
const normalizeLegacyEditorData = (editorData) => {
	const data = typeof editorData === "string" ? JSON.parse(editorData) : editorData;
	const context = { nextId: findMaxSerializedId(data.root) + 1 };
	return {
		...data,
		root: normalizeLegacyEditorDataNode(data.root, context)
	};
};
const DEFAULT_HEADLESS_EDITOR_PLUGINS = [
	[CommonPlugin, { enableHotkey: false }],
	MarkdownPlugin,
	CodePlugin,
	HeadlessCodeblockPlugin,
	HRPlugin,
	ListPlugin,
	TablePlugin
];
var HeadlessEditor = class {
	constructor(options = {}) {
		this.kernel = Editor.createEditor();
		const plugins = [...options.plugins ?? DEFAULT_HEADLESS_EDITOR_PLUGINS, ...options.additionalPlugins ?? []];
		this.kernel.registerPlugins(plugins);
		this.kernel.initHeadlessEditor();
		if (options.initialValue) this.hydrate(options.initialValue);
	}
	hydrate(input) {
		this.kernel.setDocument(input.type, input.content, input.options);
		return this;
	}
	hydrateEditorData(editorData, options) {
		this.kernel.setDocument("json", normalizeLegacyEditorData(editorData), options);
		return this;
	}
	hydrateMarkdown(markdown, options) {
		this.kernel.setDocument("markdown", markdown, options);
		return this;
	}
	export(_options) {
		return {
			editorData: this.kernel.getDocument("json"),
			markdown: this.kernel.getDocument("markdown")
		};
	}
	exportState(options) {
		return this.export(options);
	}
	destroy() {
		this.kernel.destroy();
	}
};
function createHeadlessEditor(options) {
	return new HeadlessEditor(options);
}
//#endregion
//#region src/plugins/markdown/utils/detectLanguage.ts
const LANGUAGE_PATTERNS = {
	bash: {
		optional: [
			/\|\||&&/,
			/echo\s+/,
			/if\s+\[/
		],
		required: [/^#!\/bin\/(ba)?sh/, /\${?\w+}?/],
		weight: 7
	},
	csharp: {
		optional: [
			/\[.*]/,
			/async\s+Task/,
			/var\s+\w+\s*=/
		],
		required: [/(public|private|protected)\s+(class|interface|namespace)/, /using\s+\w+/],
		weight: 8
	},
	css: {
		optional: [/@media|@import|@keyframes/, /!important/],
		required: [/[#.]?[\w-]+\s*{/, /:\s*[\w#%-]+;/],
		weight: 8
	},
	dockerfile: {
		required: [/^FROM\s+/, /^(RUN|CMD|COPY|ADD|WORKDIR|ENV|EXPOSE)\s+/m],
		weight: 10
	},
	go: {
		optional: [
			/import\s+\(/,
			/:=/,
			/defer|goroutine/
		],
		required: [/package\s+\w+/, /func\s+\w+/],
		weight: 8
	},
	graphql: {
		optional: [/fragment\s+/, /on\s+\w+/],
		required: [/(query|mutation|subscription)\s+/, /{[\S\s]*}/],
		weight: 8
	},
	html: {
		optional: [/<\/\w+>/, /class=|id=/],
		required: [/<(html|head|body|div|span|p|a|img|script|style|link|meta)/i],
		weight: 9
	},
	ini: {
		exclude: [/^\s*</, /{.*}/],
		required: [/^\[.*]$/m, /\w+\s*=\s*/],
		weight: 6
	},
	java: {
		optional: [
			/@Override|@Autowired/,
			/extends|implements/,
			/System\.out/
		],
		required: [/(public|private|protected)\s+(class|interface|static)/, /\w+\s+\w+\s*\([^)]*\)\s*{/],
		weight: 8
	},
	javascript: {
		exclude: [
			/^\s*</,
			/interface\s+\w+/,
			/:\s*\w+\s*[;=]/
		],
		optional: [
			/=>\s*{/,
			/console\.(log|error|warn)/,
			/\.then\(/,
			/require\(/
		],
		required: [/(function|const|let|var|class|import|export|async|await)\s/],
		weight: 7
	},
	json: {
		optional: [/"[^"]*"\s*:/, /:\s*["'[{]/],
		required: [/^\s*[[{]/, /[\]}]\s*$/],
		weight: 10
	},
	jsx: {
		exclude: [/^\s*<!DOCTYPE/, /^\s*<html/],
		optional: [
			/className=/,
			/{.*}/,
			/import.*from/
		],
		required: [/<\w+[^>]*>/, /(const|function|class)\s+\w+/],
		weight: 8
	},
	makefile: {
		optional: [/\$\(.*\)/, /\.PHONY/],
		required: [/^[\w-]+:\s*/, /^\t/m],
		weight: 7
	},
	markdown: {
		optional: [
			/```/,
			/\*\*.*\*\*/,
			/^\s*[*+-]\s+/m
		],
		required: [/^#{1,6}\s+/, /\[.*]\(.*\)/],
		weight: 6
	},
	php: {
		optional: [
			/function\s+\w+/,
			/class\s+\w+/,
			/echo|print/
		],
		required: [/<\?php/, /\$\w+/],
		weight: 10
	},
	powershell: {
		optional: [
			/\|\s*Where/,
			/\|\s*Select/,
			/param\(/
		],
		required: [/\$\w+/, /(Get|Set|New|Remove)-\w+/],
		weight: 8
	},
	python: {
		optional: [
			/if __name__|print\(/,
			/self\.|lambda/,
			/@\w+\s*$/m
		],
		required: [/(def|class|import|from)\s+\w+/, /:\s*$/m],
		weight: 8
	},
	ruby: {
		optional: [
			/do\s*\|.*\|/,
			/puts|require/,
			/:\w+\s*=>/
		],
		required: [/(def|class|module|end)\s/, /@\w+/],
		weight: 7
	},
	rust: {
		optional: [
			/::\w+/,
			/&mut|&str/,
			/#\[derive\(/
		],
		required: [/(fn|struct|impl|trait|use)\s+/, /let\s+(mut\s+)?\w+/],
		weight: 8
	},
	scss: {
		optional: [/@mixin|@include|@extend/, /#{.*}/],
		required: [/\$[\w-]+\s*:/, /[&@]\w+/],
		weight: 8
	},
	sql: {
		optional: [/from|where|join|group by|order by/i, /\*/],
		required: [/(select|insert|update|delete|create|alter|drop)\s+/i],
		weight: 9
	},
	toml: {
		optional: [/\[\[.*]]/, /"""[\S\s]*"""/],
		required: [/^\[.*]$/m, /\w+\s*=\s*[\w"']/],
		weight: 8
	},
	tsx: {
		optional: [
			/:\s*React\./,
			/:\s*FC</,
			/useState|useEffect/
		],
		required: [/<\w+[^>]*>/, /interface|type\s+\w+/],
		weight: 9
	},
	typescript: {
		optional: [
			/<\w+>/,
			/as\s+\w+/,
			/implements|extends/
		],
		required: [/(interface|type|enum)\s+\w+/, /:\s*\w+(\[]|<.+>)?\s*[);=]/],
		weight: 8
	},
	xml: {
		optional: [/<\/\w+>/, /xmlns/],
		required: [/<\?xml|<\w+[^>]*>/],
		weight: 9
	},
	yaml: {
		exclude: [/^\s*[[\]{]/],
		required: [/^[\s-]*\w+:\s*/, /^[\s-]*-\s+/m],
		weight: 8
	}
};
/**
* Detect the programming language of a code snippet
* @param code - The code snippet to analyze
* @returns Language detection result with confidence score
*/
function detectLanguage(code) {
	if (!code || code.trim().length === 0) return null;
	const trimmed = code.trim();
	const scores = {};
	for (const [language, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
		let score = 0;
		const baseWeight = pattern.weight || 5;
		if (pattern.exclude) {
			if (pattern.exclude.some((regex) => regex.test(trimmed))) continue;
		}
		if (pattern.required) {
			if (!pattern.required.every((regex) => regex.test(trimmed))) continue;
			score += baseWeight * 2;
		}
		if (pattern.optional) {
			const matchedOptional = pattern.optional.filter((regex) => regex.test(trimmed)).length;
			score += matchedOptional * baseWeight;
		}
		if (score > 0) scores[language] = score;
	}
	const entries = Object.entries(scores);
	if (entries.length === 0) return null;
	entries.sort((a, b) => b[1] - a[1]);
	const [topLanguage, topScore] = entries[0];
	const maxPossibleScore = (LANGUAGE_PATTERNS[topLanguage].weight || 5) * 5;
	const confidence = Math.min(100, Math.round(topScore / maxPossibleScore * 100));
	if (confidence < 30) return null;
	return {
		confidence,
		language: topLanguage
	};
}
/**
* Simple detection for common formats with high confidence
* Falls back to detectLanguage for more complex detection
*/
function detectCodeLanguage(code) {
	const trimmed = code.trim();
	if (trimmed.startsWith("{") && trimmed.endsWith("}") || trimmed.startsWith("[") && trimmed.endsWith("]")) try {
		JSON.parse(trimmed);
		return "json";
	} catch {}
	if (/^\s*(select|insert|update|delete|create|alter|drop)\s+/i.test(code)) return "sql";
	if (/^<\?xml/i.test(code)) return "xml";
	if (/^FROM\s+|^RUN\s+|^CMD\s+/m.test(code)) return "dockerfile";
	if (/<\?php/.test(code)) return "php";
	const result = detectLanguage(code);
	return result && result.confidence > 50 ? result.language : null;
}
//#endregion
//#region src/utils/url.ts
init_locale();
init_debug();
init_registerHotkey();
/**
* Shared URL validation utilities
*/
const URL_REGEX = /* @__PURE__ */ new RegExp(/^(?:(?:https?|ftp):\/\/)?(?:www\.)?[\dA-Za-z][\w#%+./:=?@~-]*[\w#%+/=@~-]$/);
/**
* Validates if a string is a valid URL
* @param url - The URL to validate
* @returns true if the URL is valid, false otherwise
*/
function isValidUrl(url) {
	if (!url || typeof url !== "string") return false;
	const trimmed = url.trim();
	if (URL_REGEX.test(trimmed)) return true;
	try {
		const urlObj = new URL(trimmed);
		return !!urlObj.protocol && !!urlObj.hostname;
	} catch {}
	if (/^[\da-z][\w#%+./:=?@~-]*\.[\w#%+/:=?@~-]+$/i.test(trimmed)) return true;
	return false;
}
/**
* Checks if text is a pure URL (single URL without other text)
* @param text - The text to check
* @returns true if text is a pure URL, false otherwise
*/
function isPureUrl(text) {
	if (!text || typeof text !== "string") return false;
	const trimmed = text.trim();
	if (trimmed.includes("\n")) return false;
	return isValidUrl(trimmed);
}
//#endregion
//#region src/plugins/auto-complete/plugin/index.ts
init_helper();
init_plugin();
const AutoCompletePlugin = class extends KernelPlugin {
	static {
		this.pluginName = "AutoCompletePlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		this.logger = createDebugLogger("plugin", "auto-complete");
		this.lastCursorPosition = null;
		this.cursorStableTimer = null;
		this.abortController = null;
		this.placeholderNodes = [];
		this.currentSuggestion = null;
		this.markdownService = null;
		this.delay = config?.delay ?? 1e3;
		kernel.registerNodes([PlaceholderNode, PlaceholderBlockNode]);
		if (config?.theme) kernel.registerThemes(config?.theme);
	}
	onInit(editor) {
		this.markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!this.markdownService) {
			this.logger.error("❌ MarkdownShortCutService is required for AutoCompletePlugin");
			return;
		}
		this.register(editor.registerUpdateListener(({ editorState }) => {
			editorState.read(() => {
				if (editor.isComposing()) return;
				const selection = $getSelection();
				if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
					this.clearTimer();
					this.clearPlaceholderNodes(editor);
					return;
				}
				const currentPosition = {
					key: selection.anchor.key,
					offset: selection.anchor.offset,
					type: selection.anchor.type
				};
				if (this.hasPositionChanged(currentPosition)) {
					this.clearTimer();
					this.clearPlaceholderNodes(editor);
					this.abortController = new AbortController();
					this.cursorStableTimer = window.setTimeout(() => {
						this.handleCursorStable(editor, currentPosition);
					}, this.delay);
				}
			});
		}));
		this.register(editor.registerCommand(KEY_TAB_COMMAND, (event) => {
			if (this.currentSuggestion) {
				event?.preventDefault();
				this.applySuggestion(editor);
				return true;
			}
			return false;
		}, COMMAND_PRIORITY_HIGH));
		this.register(editor.registerCommand(KEY_ESCAPE_COMMAND, (event) => {
			if (this.currentSuggestion) {
				event?.preventDefault();
				this.clearPlaceholderNodes(editor);
				this.currentSuggestion = null;
				return true;
			}
			return false;
		}, COMMAND_PRIORITY_CRITICAL));
		this.register(editor.registerTextContentListener(() => {
			if (this.placeholderNodes.length > 0) this.clearPlaceholderNodes(editor);
		}));
	}
	hasPositionChanged(currentPosition) {
		if (!this.lastCursorPosition) return true;
		return this.lastCursorPosition.key !== currentPosition.key || this.lastCursorPosition.offset !== currentPosition.offset || this.lastCursorPosition.type !== currentPosition.type;
	}
	clearTimer() {
		this.abortController?.abort("use cancel");
		if (this.cursorStableTimer) {
			clearTimeout(this.cursorStableTimer);
			this.cursorStableTimer = null;
		}
	}
	handleCursorStable(editor, position) {
		editor.getEditorState().read(() => {
			if (editor.isComposing()) return;
			if (!this.abortController || this.abortController.signal.aborted) return;
			const selection = $getSelection();
			if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
			const currentPosition = {
				key: selection.anchor.key,
				offset: selection.anchor.offset,
				type: selection.anchor.type
			};
			if (!this.isSamePosition(position, currentPosition)) return;
			if (this.lastCursorPosition && this.isSamePosition(position, this.lastCursorPosition)) return;
			this.lastCursorPosition = currentPosition;
			const anchorNode = selection.anchor.getNode();
			let selectionType = "unknown";
			const textRet = this.getTextBeforeCursor(selection);
			selectionType = anchorNode.getType();
			if (this.config?.onAutoComplete) this.config.onAutoComplete({
				abortSignal: this.abortController.signal,
				afterText: textRet.textAfter,
				editor: this.kernel,
				input: textRet.textBefore,
				selectionType
			}).then((result) => {
				let currentSelection = null;
				editor.getEditorState().read(() => {
					currentSelection = $getSelection();
				});
				if (editor.isComposing()) {
					this.clearPlaceholderNodes(editor);
					return;
				}
				if (!currentSelection || !$isRangeSelection(currentSelection) || !currentSelection.isCollapsed()) {
					this.clearPlaceholderNodes(editor);
					return;
				}
				const newPosition = {
					key: currentSelection.anchor.key,
					offset: currentSelection.anchor.offset,
					type: currentSelection.anchor.type
				};
				if (!this.isSamePosition(currentPosition, newPosition)) {
					this.clearPlaceholderNodes(editor);
					return;
				}
				if (result) {
					this.currentSuggestion = result;
					this.showPlaceholderNodes(editor, result);
					this.logger.debug("🔍 Auto-complete triggered:", {
						afterText: textRet.textAfter,
						input: textRet.textBefore,
						position: currentPosition,
						result,
						selectionType
					});
				} else this.clearPlaceholderNodes(editor);
			});
		});
	}
	getTextBeforeCursor(selection) {
		const ret = {
			textAfter: "",
			textBefore: ""
		};
		const anchorNode = selection.anchor.getNode();
		const anchorOffset = selection.anchor.offset;
		let paragraphNode = anchorNode;
		while (paragraphNode && paragraphNode.isInline()) {
			const parent = paragraphNode.getParent();
			if (!parent) break;
			paragraphNode = parent;
		}
		if (!paragraphNode) return ret;
		this.logger.debug("🔍 Paragraph Node Type:", paragraphNode, anchorNode);
		let founded = false;
		const collectTextBeforeCursor = (node, targetNode, targetOffset) => {
			if (node === targetNode) {
				founded = true;
				if (node.getTextContent) {
					const nodeText = node.getTextContent();
					return {
						text: nodeText.slice(0, targetOffset),
						textAfter: nodeText.slice(targetOffset)
					};
				}
				return {
					text: "",
					textAfter: ""
				};
			}
			let collectedText = "";
			let collectedTextAfter = "";
			if (node.getTextContent && node.getType() === "text") if (founded) collectedTextAfter += node.getTextContent();
			else collectedText += node.getTextContent();
			if (node.getChildren) {
				const children = node.getChildren();
				for (const child of children) {
					const result = collectTextBeforeCursor(child, targetNode, targetOffset);
					collectedTextAfter += result.textAfter;
					collectedText += result.text;
				}
			}
			return {
				text: collectedText,
				textAfter: collectedTextAfter
			};
		};
		const result = collectTextBeforeCursor(paragraphNode, anchorNode, anchorOffset);
		return {
			textAfter: result.textAfter,
			textBefore: result.text
		};
	}
	showPlaceholderNodes(editor, suggestion) {
		editor.update(() => {
			const selection = $getSelection();
			if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
				this.logger.warn("⚠️ No valid selection for placeholder");
				return;
			}
			if (!this.markdownService) {
				this.logger.warn("⚠️ No valid markdown service for placeholder");
				return;
			}
			const nodes = this.markdownService.parseMarkdownToLexical(suggestion);
			if (nodes.children[0]) {
				const firstChild = nodes.children[0];
				firstChild.children = [{
					children: firstChild.children,
					type: "PlaceholderInline"
				}];
			}
			for (let i = 1; i < nodes.children.length; i++) {
				const child = nodes.children[i];
				nodes.children[i] = {
					children: [child],
					type: "PlaceholderBlock"
				};
			}
			const markerNode = INodeHelper.createTextNode("​");
			nodes.children.push({
				children: [markerNode],
				name: "",
				type: "PlaceholderInline"
			});
			const saveSel = selection.clone();
			this.markdownService.insertIRootNode(editor, nodes, selection);
			$setSelection(saveSel);
		});
	}
	clearPlaceholderNodes(editor) {
		editor.update(() => {
			editor.getEditorState()._nodeMap.forEach((node) => {
				const selection = $getSelection();
				const clonedSelection = selection ? selection.clone() : null;
				if (node.isAttached() && ["PlaceholderBlock", "PlaceholderInline"].includes(node.getType())) {
					if (node.getType() === "PlaceholderInline" && node.getTextContent().includes("​") && node.getPreviousSibling() === null) {
						while (node.getNextSibling()) {
							const next = node.getNextSibling();
							if (next) $insertNodes([next]);
						}
						$setSelection(clonedSelection);
						node.getParent()?.remove();
						return;
					}
					node.remove();
				}
			});
		});
	}
	applySuggestion(editor) {
		if (!this.currentSuggestion) return;
		const markdown = this.currentSuggestion;
		editor.update(() => {
			const selection = $getSelection();
			if (!$isRangeSelection(selection) || !selection.isCollapsed() || !this.markdownService) return;
			editor.getEditorState()._nodeMap.forEach((node) => {
				if (node.isAttached() && ["PlaceholderBlock", "PlaceholderInline"].includes(node.getType())) node.remove();
			});
			const nodes = this.markdownService.parseMarkdownToLexical(markdown);
			this.markdownService.insertIRootNode(editor, nodes, selection);
			this.clearPlaceholderNodes(editor);
			this.currentSuggestion = null;
		});
	}
	isSamePosition(pos1, pos2) {
		return pos1.key === pos2.key && pos1.offset === pos2.offset && pos1.type === pos2.type;
	}
	destroy() {
		this.clearTimer();
		this.placeholderNodes = [];
		super.destroy();
	}
};
//#endregion
//#region src/plugins/auto-complete/react/style.ts
const styles$13 = createStaticStyles(({ css }) => ({
	placeholderBlock: css`
    opacity: 0.4;
  `,
	placeholderInline: css`
    opacity: 0.4;
  `
}));
//#endregion
//#region src/plugins/auto-complete/react/ReactAutoCompletePlugin.tsx
const ReactAutoCompletePlugin = ({ onAutoComplete, delay }) => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(AutoCompletePlugin, {
			delay,
			onAutoComplete,
			theme: {
				placeholderBlock: cx(styles$13.placeholderBlock),
				placeholderInline: cx(styles$13.placeholderInline)
			}
		});
	}, []);
	return null;
};
ReactAutoCompletePlugin.displayName = "ReactAutoCompletePlugin";
//#endregion
//#region src/plugins/code/react/style.ts
const styles$12 = createStaticStyles(({ css, cssVar }) => ({ codeInline: css`
    display: inline;

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
  ` }));
//#endregion
//#region src/plugins/code/react/CodeReactPlugin.tsx
const ReactCodePlugin = ({ className, enableHotkey = true }) => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(MarkdownPlugin);
		editor.registerPlugin(CodePlugin, {
			enableHotkey,
			theme: cx(styles$12.codeInline, className)
		});
	}, [
		className,
		cx,
		enableHotkey,
		styles$12.codeInline
	]);
	return null;
};
ReactCodePlugin.displayName = "ReactCodePlugin";
//#endregion
//#region src/plugins/codeblock/plugin/index.ts
init_helper();
init_plugin();
const origin = CodeNode.importDOM;
const LANGUAGE_DATA_ATTRIBUTE = "data-language";
const MAX_LENGTH = 8e3;
function $convertPreElement(domNode) {
	const language = domNode.getAttribute(LANGUAGE_DATA_ATTRIBUTE);
	if (domNode.innerHTML.length > MAX_LENGTH) return { node: null };
	return { node: $createCodeNode(language) };
}
CodeNode.importDOM = () => {
	const node = origin();
	if (node) node.pre = () => ({
		conversion: $convertPreElement,
		priority: 0
	});
	return node;
};
function toMarkdownTheme(theme) {
	if (!theme) return "";
	if (typeof theme === "string") return theme;
	return `${theme.light} ${theme.dark}`;
}
function isHeadlessEditor(editor) {
	return editor._headless === true;
}
const CodeblockPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "CodeblockPlugin";
	}
	constructor(kernel, config = {}) {
		super();
		this.kernel = kernel;
		this.config = config;
		kernel.registerNodes([CodeNode, CodeHighlightNode]);
		kernel.registerThemes({ code: config.theme?.code || "editor-code" });
		if (this.config?.shikiTheme) CustomShikiTokenizer.defaultTheme = this.config?.shikiTheme;
	}
	onInit(editor) {
		if (!isHeadlessEditor(editor)) if (this.config?.shikiTheme) this.register(registerCodeHighlighting(editor, CustomShikiTokenizer));
		else this.register(registerCodeHighlighting(editor));
		this.register(registerCodeCommand(editor));
		if (!isHeadlessEditor(editor)) this.register(editor.registerCommand(PASTE_COMMAND, (event) => {
			if (!(event instanceof ClipboardEvent)) return false;
			const clipboardData = event.clipboardData;
			if (!clipboardData) return false;
			const isInHighlightNodeSelection = editor.getEditorState().read(() => {
				const sel = $getSelection();
				if (!$isRangeSelection(sel)) return false;
				let node = sel.focus.getNode();
				while (node) {
					if ($isCodeHighlightNode(node) || $isCodeNode(node)) return sel;
					node = node.getParent();
				}
				return false;
			});
			if (isInHighlightNodeSelection) {
				const rawText = clipboardData.getData("text/plain").trimEnd() || clipboardData.getData("text/uri-list").trimEnd();
				editor.update(() => {
					isInHighlightNodeSelection.insertRawText(rawText);
				});
				return true;
			}
			return false;
		}, COMMAND_PRIORITY_EDITOR));
		this.registerMarkdown();
	}
	registerMarkdown() {
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!markdownService) return;
		markdownService.registerMarkdownShortCut({
			regExp: /^(```|···)(.+)?$/,
			replace: (parentNode, _, match) => {
				const code = $createCodeNode(getCodeLanguageByInput(match[2]), toCodeTheme(CustomShikiTokenizer));
				parentNode.replace(code);
				code.selectStart();
			},
			trigger: "enter",
			type: "element"
		});
		markdownService.registerMarkdownWriter(CodeNode.getType(), (ctx, node) => {
			if ($isCodeNode(node)) ctx.wrap("```" + (node.getLanguage() || "") + "\n", "\n```\n");
		});
		markdownService.registerMarkdownWriter(TabNode.getType(), (ctx) => {
			ctx.appendLine("  ");
		});
		markdownService.registerMarkdownWriter(CodeHighlightNode.getType(), (ctx, node) => {
			if ($isCodeHighlightNode(node)) ctx.appendLine(node.getTextContent());
		});
		markdownService.registerMarkdownWriter("linebreak", (ctx, node) => {
			if ($isCodeNode(node.getParent())) ctx.appendLine("\n");
		});
		markdownService.registerMarkdownReader("code", (node) => {
			const language = node.lang ? getCodeLanguageByInput(node.lang) : "plaintext";
			return INodeHelper.createElementNode("code", {
				children: node.value.split("\n").flatMap((text, index, arr) => {
					const textNode = INodeHelper.createTextNode(text);
					textNode.type = "code-highlight";
					if (index === arr.length - 1) return textNode;
					return [textNode, {
						type: "linebreak",
						version: 1
					}];
				}).flat(),
				direction: "ltr",
				format: "",
				indent: 0,
				language,
				textStyle: "--shiki-dark:var(--color-info);--shiki-light:var(--color-info)",
				theme: `${toMarkdownTheme(this.config?.shikiTheme)} needUpdate`,
				version: 1
			});
		});
	}
};
//#endregion
//#region src/plugins/codeblock/react/style.ts
const styles$11 = createStaticStyles(({ css, cssVar }) => ({
	code: css`
    position: relative;

    overflow: hidden;
    display: block;

    width: 100%;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
    padding: 16px;
    border-radius: var(--lobe-markdown-border-radius);

    font-family: ${cssVar.fontFamilyCode};
    font-size: calc(var(--lobe-markdown-font-size) * 0.85);

    background: ${cssVar.colorFillTertiary} !important;
    box-shadow: 0 0 0 1px var(--lobe-markdown-border-color) inset;

    &::after {
      content: attr(data-language);

      position: absolute;
      z-index: 3;
      inset-block-end: 8px;
      inset-inline-end: 8px;

      display: block;

      padding-block: 1px;
      padding-inline: 7px;
      border-radius: ${cssVar.borderRadius};

      font-family: ${cssVar.fontFamilyCode};
      font-size: 12px;
      color: ${cssVar.colorTextSecondary};

      opacity: 0;
      background: ${cssVar.colorFillQuaternary};
      backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);

      transition: opacity 0.1s;
    }

    &:hover {
      &::after {
        opacity: 1;
      }
    }
  `,
	noBackground: css`
    background: transparent !important;
  `
}));
//#endregion
//#region src/plugins/codeblock/react/ReactCodeblockPlugin.tsx
const ReactCodeblockPlugin = ({ theme, shikiTheme }) => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(MarkdownPlugin);
		editor.registerPlugin(CodeblockPlugin, {
			shikiTheme: shikiTheme || "lobe-theme",
			theme: theme || { code: styles$11.code }
		});
	}, [
		cx(styles$11.code),
		editor,
		shikiTheme,
		theme
	]);
	return null;
};
ReactCodeblockPlugin.displayName = "ReactCodeblockPlugin";
//#endregion
//#region src/plugins/codemirror-block/command/index.ts
const INSERT_CODEMIRROR_COMMAND = createCommand("INSERT_CODEMIRROR_COMMAND");
const SELECT_BEFORE_CODEMIRROR_COMMAND = createCommand("SELECT_BEFORE_CODEMIRROR_COMMAND");
const SELECT_AFTER_CODEMIRROR_COMMAND = createCommand("SELECT_AFTER_CODEMIRROR_COMMAND");
function registerCodeMirrorCommand(editor) {
	return mergeRegister(editor.registerCommand(INSERT_CODEMIRROR_COMMAND, () => {
		editor.update(() => {
			const codeMirrorNode = $createCodeMirrorNode("", "");
			$insertNodes([codeMirrorNode]);
			const selection = $createNodeSelection();
			selection.add(codeMirrorNode.getKey());
			$setSelection(selection);
		});
		return true;
	}, COMMAND_PRIORITY_EDITOR), editor.registerCommand(UPDATE_CODEBLOCK_LANG, (payload) => {
		const codeMirrorNode = editor.getEditorState().read(() => {
			const selection = $getSelection();
			if ($isRangeSelection(selection)) if (selection.isCollapsed()) return $findMatchingParent(selection.anchor.getNode(), $isCodeMirrorNode);
			else {
				const anchor = $findMatchingParent(selection.anchor.getNode(), $isCodeMirrorNode);
				const focus = $findMatchingParent(selection.focus.getNode(), $isCodeMirrorNode);
				if (anchor && focus && anchor === focus) return anchor;
				return null;
			}
			return false;
		});
		if (!codeMirrorNode) return false;
		queueMicrotask(() => {
			editor.update(() => {
				if ($isCodeMirrorNode(codeMirrorNode)) codeMirrorNode.setLang(payload.lang);
			});
		});
		return true;
	}, COMMAND_PRIORITY_EDITOR), editor.registerCommand(SELECT_BEFORE_CODEMIRROR_COMMAND, (payload) => {
		editor.update(() => {
			const node = $getNodeByKey(payload.key);
			if (!node) return;
			const prevNode = node.getPreviousSibling();
			const sel = prevNode?.selectEnd();
			console.info("SELECT_BEFORE_CODEMIRROR_COMMAND", prevNode, sel);
			if (sel) $setSelection(sel);
			editor.focus();
		});
		return false;
	}, COMMAND_PRIORITY_EDITOR), editor.registerCommand(SELECT_AFTER_CODEMIRROR_COMMAND, (payload) => {
		editor.update(() => {
			const node = $getNodeByKey(payload.key);
			if (!node) return;
			const selection = node.getNextSibling()?.selectStart();
			if (selection) $setSelection(selection);
			else {
				const paragraph = $createParagraphNode();
				node.insertAfter(paragraph);
				const paragraphSelection = paragraph.selectStart();
				if (paragraphSelection) $setSelection(paragraphSelection);
			}
			editor.focus();
		});
		return false;
	}, COMMAND_PRIORITY_EDITOR));
}
//#endregion
//#region src/plugins/codemirror-block/lib/mode.ts
const MODES = [
	{
		ext: ["agda"],
		name: "Agda",
		syntax: "text/x-agda",
		value: "agda"
	},
	{
		ext: ["ets", "arkts"],
		name: "ArkTS",
		syntax: "text/x-arkts",
		value: "arkts"
	},
	{
		ext: ["bash"],
		name: "Bash",
		syntax: "shell",
		value: "bash"
	},
	{
		ext: ["vbs"],
		name: "Basic",
		syntax: "vbscript",
		value: "basic"
	},
	{
		ext: [
			"c",
			"h",
			"ino"
		],
		name: "C",
		syntax: "text/x-csrc",
		value: "c"
	},
	{
		ext: [
			"cpp",
			"c++",
			"cc",
			"cxx",
			"hpp",
			"h++",
			"hh",
			"hxx"
		],
		name: "C++",
		syntax: "text/x-c++src",
		value: "cpp"
	},
	{
		ext: ["cs"],
		name: "C#",
		syntax: "text/x-csharp",
		value: "csharp"
	},
	{
		ext: ["css"],
		name: "CSS",
		syntax: "css",
		value: "css"
	},
	{
		ext: ["dart"],
		name: "Dart",
		syntax: "dart",
		value: "dart"
	},
	{
		ext: ["diff", "patch"],
		name: "Diff",
		syntax: "diff",
		value: "diff"
	},
	{
		name: "Dockerfile",
		syntax: "dockerfile",
		value: "dockerfile"
	},
	{
		ext: ["erl"],
		name: "Erlang",
		syntax: "erlang",
		value: "erlang"
	},
	{
		ext: ["glsl"],
		name: "Glsl",
		syntax: "x-shader/x-vertex",
		value: "glsl"
	},
	{
		name: "Git",
		syntax: "shell",
		value: "git"
	},
	{
		ext: ["go"],
		name: "Go",
		syntax: "go",
		value: "go"
	},
	{
		name: "GraphQL",
		syntax: "graphql",
		value: "graphql"
	},
	{
		ext: ["groovy", "gradle"],
		name: "Groovy",
		syntax: "groovy",
		value: "groovy"
	},
	{
		ext: [
			"html",
			"htm",
			"handlebars",
			"hbs"
		],
		name: "HTML",
		syntax: "htmlmixed",
		value: "html"
	},
	{
		name: "HTTP",
		syntax: "http",
		value: "http"
	},
	{
		ext: ["java"],
		name: "Java",
		syntax: "text/x-java",
		value: "java"
	},
	{
		ext: ["js"],
		name: "JavaScript",
		syntax: "text/javascript",
		value: "javascript"
	},
	{
		ext: ["json", "map"],
		name: "JSON",
		syntax: "application/json",
		value: "json"
	},
	{
		ext: ["jsx"],
		name: "JSX",
		syntax: "jsx",
		value: "jsx"
	},
	{
		name: "KaTeX",
		syntax: "simplemode",
		value: "katex"
	},
	{
		ext: ["kt"],
		name: "Kotlin",
		syntax: "text/x-kotlin",
		value: "kotlin"
	},
	{
		ext: ["less"],
		name: "Less",
		syntax: "css",
		value: "less"
	},
	{
		name: "Makefile",
		syntax: "cmake",
		value: "makefile"
	},
	{
		ext: [
			"markdown",
			"md",
			"mkd"
		],
		name: "Markdown",
		syntax: "markdown",
		value: "markdown"
	},
	{
		ext: ["mermaid", "mmd"],
		name: "Mermaid",
		/** No dedicated CM mode in bundle — text-like editing; value kept for fenced ```mermaid markdown */
		syntax: "simplemode",
		value: "mermaid"
	},
	{
		ext: ["markmap", "mmap"],
		name: "Markmap",
		/** No dedicated CM mode in bundle — text-like editing; value kept for fenced ```markmap markdown */
		syntax: "markdown",
		value: "markmap"
	},
	{
		name: "MATLAB",
		syntax: "octave",
		value: "matlab"
	},
	{
		ext: ["conf"],
		name: "Nginx",
		syntax: "nginx",
		value: "nginx"
	},
	{
		ext: ["m"],
		name: "Objective-C",
		syntax: "text/x-objectivec",
		value: "objectivec"
	},
	{
		ext: ["p", "pas"],
		name: "Pascal",
		syntax: "pascal",
		value: "pascal"
	},
	{
		ext: ["pl", "pm"],
		name: "Perl",
		syntax: "perl",
		value: "perl"
	},
	{
		ext: [
			"php",
			"php3",
			"php4",
			"php5",
			"php7",
			"phtml"
		],
		name: "PHP",
		syntax: "text/x-php",
		value: "php"
	},
	{
		ext: [
			"ps1",
			"psd1",
			"psm1"
		],
		name: "PowerShell",
		syntax: "powershell",
		value: "powershell"
	},
	{
		ext: ["proto"],
		name: "Protobuf",
		syntax: "protobuf",
		value: "protobuf"
	},
	{
		ext: [
			"build",
			"bzl",
			"py",
			"pyw"
		],
		name: "Python",
		syntax: "python",
		value: "python"
	},
	{
		ext: ["r", "R"],
		name: "R",
		syntax: "r",
		value: "r"
	},
	{
		ext: ["rb"],
		name: "Ruby",
		syntax: "ruby",
		value: "ruby"
	},
	{
		ext: ["rs"],
		name: "Rust",
		syntax: "rust",
		value: "rust"
	},
	{
		ext: ["scala"],
		name: "Scala",
		syntax: "text/x-scala",
		value: "scala"
	},
	{
		ext: ["sh", "ksh"],
		name: "Shell",
		syntax: "shell",
		value: "shell"
	},
	{
		ext: ["sql"],
		name: "SQL",
		syntax: "text/x-sql",
		value: "sql"
	},
	{
		name: "PL/SQL",
		syntax: "text/x-plsql",
		value: "plsql"
	},
	{
		ext: ["swift"],
		name: "Swift",
		syntax: "swift",
		value: "swift"
	},
	{
		ext: ["ts"],
		name: "TypeScript",
		syntax: "text/typescript",
		value: "typescript"
	},
	{
		ext: ["vb"],
		name: "VB.net",
		syntax: "vb",
		value: "vbnet"
	},
	{
		ext: ["vtl"],
		name: "Velocity",
		syntax: "velocity",
		value: "velocity"
	},
	{
		ext: [
			"xml",
			"xsl",
			"xsd",
			"svg"
		],
		name: "XML",
		syntax: "xml",
		value: "xml"
	},
	{
		ext: ["yaml", "yml"],
		name: "YAML",
		syntax: "yaml",
		value: "yaml"
	},
	{
		name: "sTeX",
		syntax: "text/x-stex",
		value: "stex"
	},
	{
		ext: [
			"text",
			"ltx",
			"tex"
		],
		name: "LaTeX",
		syntax: "text/x-latex",
		value: "latex"
	},
	{
		ext: ["sv", "svh"],
		name: "SystemVerilog",
		syntax: "text/x-systemverilog",
		value: "systemverilog"
	},
	{
		ext: ["sass", "scss"],
		name: "Sass",
		syntax: "text/x-sass",
		value: "sass"
	},
	{
		ext: ["tcl"],
		name: "Tcl",
		syntax: "text/x-tcl",
		value: "tcl"
	},
	{
		ext: ["v"],
		name: "Verilog",
		syntax: "text/x-verilog",
		value: "verilog"
	},
	{
		name: "Vue",
		syntax: "text/x-vue",
		value: "vue"
	},
	{
		ext: ["lua"],
		name: "Lua",
		syntax: "text/x-lua",
		value: "lua"
	},
	{
		ext: ["hs"],
		name: "Haskell",
		syntax: "haskell",
		value: "haskell"
	},
	{
		ext: [
			"properties",
			"ini",
			"in"
		],
		name: "Properties",
		syntax: "properties",
		value: "properties"
	},
	{
		ext: ["toml"],
		name: "TOML",
		syntax: "toml",
		value: "toml"
	},
	{
		ext: ["cyp", "cypher"],
		name: "Cypher",
		syntax: "cypher",
		value: "cypher"
	},
	{
		ext: ["tsx"],
		name: "TSX",
		syntax: "jsx",
		value: "tsx"
	},
	{
		ext: ["fs"],
		name: "F#",
		syntax: "mllike",
		value: "f#"
	},
	{
		ext: [
			"ml",
			"mli",
			"mll",
			"mly"
		],
		name: "OCaml",
		syntax: "mllike",
		value: "ocaml"
	},
	{
		ext: [
			"clj",
			"cljc",
			"cljx"
		],
		name: "Clojure",
		syntax: "clojure",
		value: "clojure"
	},
	{
		name: "ABAP",
		syntax: "abap",
		value: "abap"
	},
	{
		ext: ["jl"],
		name: "Julia",
		syntax: "julia",
		value: "julia"
	},
	{
		ext: ["cmake"],
		name: "CMake",
		syntax: "cmake",
		value: "cmake"
	},
	{
		ext: ["scm", "ss"],
		name: "Scheme",
		syntax: "scheme",
		value: "scheme"
	},
	{
		ext: [
			"cl",
			"lisp",
			"el"
		],
		name: "Lisp",
		syntax: "commonlisp",
		value: "commonlisp"
	},
	{
		ext: [
			"f90",
			"f95",
			"f03"
		],
		name: "Fortran",
		syntax: "fortran",
		value: "fortran"
	},
	{
		ext: ["sol"],
		name: "Solidity",
		syntax: "solidity",
		value: "solidity"
	}
];
MODES.sort((modeA, modeB) => {
	const nameA = modeA.name.toLowerCase();
	const nameB = modeB.name.toLowerCase();
	if (nameA === nameB) return 0;
	if (nameA < nameB) return -1;
	return 1;
});
MODES.unshift({
	name: "Plain Text",
	syntax: "simplemode",
	value: "plain"
});
function modeMatch(mode = "") {
	mode = mode.toLocaleLowerCase() || "plain";
	return MODES.find((m) => m.value === mode || m.ext?.includes(mode))?.value || "plain";
}
/**
* Stored language is MODES[].value (e.g. `typescript`). `@lobehub/codemirror` keys its
* language map `Sq` by that short id (`java`, `typescript`, …), not by legacy CodeMirror 5
* MIME strings (`text/x-java`, `text/typescript`). Passing MIME here yields no highlighter.
*/
function resolveCodeMirrorMode(langKey) {
	const key = (langKey || "plain").toLocaleLowerCase();
	return MODES.find((m) => m.value === key || m.ext?.includes(key))?.value ?? "plain";
}
//#endregion
//#region src/plugins/codemirror-block/plugin/index.ts
init_helper();
init_plugin();
const CodemirrorPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "CodemirrorPlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		kernel.registerNodes([CodeMirrorNode]);
		kernel.registerThemes({ hr: config?.theme || "" });
		this.registerDecorator(kernel, "codemirror", (node, editor) => {
			return config?.decorator ? config.decorator(node, editor) : null;
		});
	}
	onInit(editor) {
		this.register(registerCodeMirrorCommand(editor));
		this.registerMarkdown();
	}
	registerMarkdown() {
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		markdownService?.registerMarkdownShortCut({
			regExp: /^(```|···)(.+)?$/,
			replace: (parentNode, _, match) => {
				const code = $createCodeMirrorNode(modeMatch(match[2]), "");
				parentNode.replace(code);
				const sel = $createNodeSelection();
				sel.add(code.getKey());
				$setSelection(sel);
			},
			trigger: "enter",
			type: "element"
		});
		markdownService?.registerMarkdownWriter(CodeMirrorNode.getType(), (ctx, node) => {
			if (node instanceof CodeMirrorNode) {
				ctx.appendLine("```" + node.lang);
				ctx.appendLine("\n");
				ctx.appendLine(node.code);
				ctx.appendLine("\n```\n");
			}
		});
		markdownService?.registerMarkdownReader("code", (node) => {
			const language = node.lang ? modeMatch(node.lang) : "plain";
			return INodeHelper.createTypeNode("code", {
				code: node.value,
				language,
				version: 1
			});
		});
	}
};
//#endregion
//#region src/plugins/codemirror-block/react/theme.ts
/**
* Lobe 主题配置
* 基于 shiki 主题配置，使用 antd-style 的 cssVar 进行颜色映射
*/
const lobeTheme = {
	"&": {
		"& .cm-cursor": { "border-left-color": cssVar.colorPrimary },
		"& .cm-cursor.cm-cursor-primary": { "border-inline-start": `2px solid ${cssVar.colorPrimary} !important` },
		"& .cm-gutters": {
			"background-color": cssVar.colorBgContainer,
			"border": "none",
			"color": cssVar.colorTextQuaternary,
			"cursor": "default"
		},
		"& .cm-line": {
			"& .cm-atom": { color: cssVar.purple10 },
			"& .cm-attribute": { color: cssVar.purple10 },
			"& .cm-builtin": {
				color: cssVar.volcano10,
				fontStyle: "italic"
			},
			"& .cm-comment": {
				color: cssVar.colorTextQuaternary,
				fontStyle: "italic"
			},
			"& .cm-foldPlaceholder": {
				"background": `url("data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Crect fill='%23E8E8E8' width='16' height='16' rx='2'/%3E%3Cpath d='M2.75 7.984a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.375 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.375 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z' fill='%232A3238'/%3E%3C/g%3E%3C/svg%3E") no-repeat`,
				"border": "none",
				"color": "transparent",
				"display": "inline-block",
				"height": "16px",
				"padding": 0,
				"vertical-align": "middle",
				"width": "16px"
			},
			"& .cm-function": { color: cssVar.geekblue10 },
			"& .cm-header": { color: cssVar.colorInfo },
			"& .cm-keyword": { color: cssVar.colorInfo },
			"& .cm-meta": { color: cssVar.colorText },
			"& .cm-modifier": { color: cssVar.colorInfo },
			"& .cm-number": { color: cssVar.volcano10 },
			"& .cm-operator": { color: cssVar.colorInfo },
			"& .cm-property": { color: cssVar.volcano10 },
			"& .cm-punctuation": { color: cssVar.colorInfo },
			"& .cm-qualifier": { color: cssVar.colorWarning },
			"& .cm-string": { color: cssVar.colorSuccess },
			"& .cm-string-2": { color: cssVar.colorSuccess },
			"& .cm-tag": { color: cssVar.volcano10 },
			"& .cm-tag.cm-bracket": { color: cssVar.colorInfo },
			"& .cm-type": { color: cssVar.colorWarning },
			"& .cm-variable": { color: cssVar.colorText },
			"& .cm-variable-2": { color: cssVar.geekblue10 },
			"& .cm-variable-3": { color: cssVar.colorWarning },
			"& .cm-variable.cm-callee": { color: cssVar.geekblue10 },
			"& .cm-variable.cm-def": { color: cssVar.colorText },
			"color": cssVar.colorText,
			"padding-inline": "12px"
		}
	},
	"& .cm-selectionBackground": { background: "transparent" },
	"& .cm-selectionMatch": { background: `${cssVar.colorFillSecondary} !important` },
	"&.cm-editor": {
		"background": "transparent",
		"cursor": "text",
		"padding-block": "12px",
		"width": "100%"
	},
	"&.cm-editor span": {
		"font-family": cssVar.fontFamilyCode,
		"font-size": "calc(var(--lobe-markdown-font-size) * 0.8)"
	},
	"&.cm-editor.cm-focused .cm-selectionBackground": { background: cssVar.colorPrimaryBg },
	"&.cm-editor.cm-focused .cm-selectionLineGutter": { color: cssVar.colorText },
	"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { background: cssVar.yellow }
};
//#endregion
//#region src/plugins/codemirror-block/lib/index.ts
init_debug();
const logger$3 = createDebugLogger("plugin", "codemirror-loader");
const DEFAULT_CDN_URL = "https://registry.npmmirror.com/@lobehub/codemirror/1.0.0/files/es/index.js";
const LOAD_TIMEOUT = 1e4;
const POLL_INTERVAL = 50;
let codeMirrorPromise = null;
/**
* 加载 script 标签
*/
function loadScript(src) {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) {
			logger$3.debug("Script already loaded:", src);
			resolve();
			return;
		}
		logger$3.debug("Loading script:", src);
		const script = document.createElement("script");
		script.src = src;
		script.type = "module";
		script.async = true;
		script.addEventListener("load", () => {
			logger$3.debug("Script loaded successfully:", src);
			resolve();
		});
		script.addEventListener("error", (error) => {
			logger$3.error("Failed to load script:", src, error);
			reject(/* @__PURE__ */ new Error(`Failed to load script: ${src}`));
		});
		document.head.append(script);
	});
}
/**
* 等待 window.CodeMirror 可用
*/
function waitForCodeMirror(timeout = LOAD_TIMEOUT) {
	return new Promise((resolve, reject) => {
		const startTime = Date.now();
		const checkCodeMirror = () => {
			if (window.CodeMirror) {
				logger$3.debug("CodeMirror is ready");
				resolve();
				return;
			}
			if (Date.now() - startTime > timeout) {
				logger$3.error("Timeout waiting for CodeMirror");
				reject(/* @__PURE__ */ new Error("Timeout: CodeMirror failed to load from CDN"));
				return;
			}
			setTimeout(checkCodeMirror, POLL_INTERVAL);
		};
		checkCodeMirror();
	});
}
/**
* 从 CDN 加载 CodeMirror
* @param cdnUrl - 可选的自定义 CDN URL
*/
async function loadCodeMirror(cdnUrl = DEFAULT_CDN_URL) {
	if (window.CodeMirror?.default) {
		logger$3.debug("CodeMirror already available");
		return window.CodeMirror.default;
	}
	if (codeMirrorPromise) {
		logger$3.debug("CodeMirror loading in progress, reusing promise");
		return codeMirrorPromise;
	}
	codeMirrorPromise = (async () => {
		try {
			logger$3.debug("Starting CodeMirror load from:", cdnUrl);
			await loadScript(cdnUrl);
			await waitForCodeMirror();
			if (!window.CodeMirror?.default) throw new Error("CodeMirror loaded but not properly initialized");
			logger$3.debug("CodeMirror loaded successfully");
			return window.CodeMirror.default;
		} catch (error) {
			codeMirrorPromise = null;
			logger$3.error("Failed to load CodeMirror:", error);
			throw error;
		}
	})();
	return codeMirrorPromise;
}
//#endregion
//#region src/plugins/codemirror-block/react/components/CopyButton.tsx
const CopyButton$1 = ({ onCopy }) => {
	const [copied, setCopied] = useState(false);
	return /* @__PURE__ */ jsx(ActionIcon, {
		active: copied,
		className: "cm-hidden-actions",
		icon: copied ? Check : CopyIcon,
		onClick: () => {
			setCopied(true);
			onCopy();
			setTimeout(() => setCopied(false), 1e3);
		},
		size: "small",
		title: "Copy"
	});
};
CopyButton$1.displayName = "CopyButton";
//#endregion
//#region src/plugins/codemirror-block/react/components/style.ts
const styles$10 = createStaticStyles(({ css }) => ({ container: css`
    min-width: 160px;
  ` }));
//#endregion
//#region src/plugins/codemirror-block/react/components/LanguageSelect.tsx
const LanguageSelect = ({ selectedLang, onLanguageChange }) => {
	const t = useTranslation();
	const languageOptions = useMemo(() => MODES.map((mode) => ({
		aliases: mode.ext || [],
		label: /* @__PURE__ */ jsxs(Flexbox, {
			align: "center",
			gap: 4,
			horizontal: true,
			children: [/* @__PURE__ */ jsx(MaterialFileTypeIcon, {
				fallbackUnknownType: false,
				filename: mode.ext?.[0] ? `*.${mode.ext[0]}` : `*.${mode.value}`,
				size: 18,
				type: "file",
				variant: "raw"
			}), /* @__PURE__ */ jsx(Text, {
				ellipsis: true,
				fontSize: 13,
				children: mode.name
			})]
		}),
		title: mode.ext?.length ? mode.ext.map((ext) => `*.${ext}`).join(",") : `*.${mode.value}`,
		value: mode.value
	})), []);
	return /* @__PURE__ */ jsx(Flexbox, {
		align: "center",
		className: "cm-language-select",
		gap: 4,
		horizontal: true,
		onClick: (e) => e.stopPropagation(),
		children: /* @__PURE__ */ jsx(Select, {
			className: cx(styles$10.container),
			filterOption: (input, option) => {
				const lang = input.toLowerCase();
				if ((option?.value)?.toLowerCase().startsWith(lang)) return true;
				if (String(option?.label).toLowerCase().includes(lang)) return true;
				if (option?.aliases?.some((ext) => ext.toLowerCase().startsWith(lang))) return true;
				return false;
			},
			onChange: onLanguageChange,
			options: languageOptions,
			placeholder: t("codemirror.selectLanguage"),
			showSearch: true,
			size: "small",
			value: selectedLang,
			variant: "borderless"
		})
	});
};
LanguageSelect.displayName = "LanguageSelect";
//#endregion
//#region src/plugins/codemirror-block/react/components/MoreOptions.tsx
const MoreOptions = ({ tabSize, onTabSizeChange, useTabs, onUseTabsChange, showLineNumbers, onShowLineNumbersChange }) => {
	const t = useTranslation();
	const handleTabSizeChange = useCallback((value = 2) => {
		onTabSizeChange(value === null ? 2 : value);
	}, [onTabSizeChange]);
	return /* @__PURE__ */ jsx(Popover, {
		arrow: false,
		content: /* @__PURE__ */ jsxs(Flexbox, {
			gap: 8,
			style: { minWidth: 240 },
			children: [
				/* @__PURE__ */ jsxs(Flexbox, {
					align: "center",
					gap: 8,
					horizontal: true,
					justify: "space-between",
					children: [/* @__PURE__ */ jsx(Text, { children: t("codemirror.tabSize") }), /* @__PURE__ */ jsx(InputNumber, {
						max: 8,
						min: 1,
						onChange: handleTabSizeChange,
						size: "small",
						value: tabSize
					})]
				}),
				/* @__PURE__ */ jsxs(Flexbox, {
					align: "center",
					gap: 8,
					horizontal: true,
					justify: "space-between",
					children: [/* @__PURE__ */ jsx(Text, { children: t("codemirror.useTabs") }), /* @__PURE__ */ jsx(Switch, {
						checked: useTabs,
						onChange: onUseTabsChange,
						size: "small"
					})]
				}),
				/* @__PURE__ */ jsxs(Flexbox, {
					align: "center",
					gap: 8,
					horizontal: true,
					justify: "space-between",
					children: [/* @__PURE__ */ jsx(Text, { children: t("codemirror.showLineNumbers") }), /* @__PURE__ */ jsx(Switch, {
						checked: showLineNumbers,
						onChange: onShowLineNumbersChange,
						size: "small"
					})]
				})
			]
		}),
		placement: "bottomRight",
		trigger: "click",
		children: /* @__PURE__ */ jsx(ActionIcon, {
			className: "cm-hidden-actions",
			icon: MoreHorizontalIcon,
			size: "small"
		})
	});
};
MoreOptions.displayName = "MoreOptions";
//#endregion
//#region src/plugins/codemirror-block/react/components/Toolbar.tsx
const Toolbar = ({ selectedLang, onLanguageChange, onCopy, tabSize, onTabSizeChange, useTabs, onUseTabsChange, showLineNumbers, onShowLineNumbersChange, expand, toggleExpand }) => {
	return /* @__PURE__ */ jsxs(Flexbox, {
		align: "center",
		className: "cm-header-toolbar",
		horizontal: true,
		justify: "space-between",
		padding: 4,
		children: [/* @__PURE__ */ jsx(LanguageSelect, {
			onLanguageChange,
			selectedLang
		}), /* @__PURE__ */ jsxs(Flexbox, {
			gap: 4,
			horizontal: true,
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ jsx(MoreOptions, {
					onShowLineNumbersChange,
					onTabSizeChange,
					onUseTabsChange,
					showLineNumbers,
					tabSize,
					useTabs
				}),
				/* @__PURE__ */ jsx(CopyButton$1, { onCopy }),
				/* @__PURE__ */ jsx(ActionIcon, {
					icon: expand ? ChevronDown : ChevronRight,
					onClick: toggleExpand,
					size: "small"
				})
			]
		})]
	});
};
Toolbar.displayName = "Toolbar";
//#endregion
//#region src/plugins/codemirror-block/react/style.ts
const styles$9 = createStaticStyles(({ css, cssVar }) => css`
    cursor: pointer;

    position: relative;

    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;

    width: 100%;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
    border-radius: var(--lobe-markdown-border-radius);

    background: ${cssVar.colorFillTertiary};

    &:has(.cm-mermaid-preview) {
      overflow: visible;
    }

    &:has(.cm-markmap-preview) {
      overflow: visible;
    }

    .cm-hidden-actions {
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }

    .cm-language-select {
      opacity: 0.5;
      filter: grayscale(100%);
      transition:
        opacity,
        grayscale 0.2s ease-in-out;
    }

    &.selected {
      user-select: none;
    }

    &.selected::after {
      pointer-events: none;
      content: '';

      position: absolute;
      z-index: 10;
      inset: 0;

      width: 100%;
      height: 100%;

      opacity: 0.2;
      background: ${cssVar.yellow};

      transition: all 0.3s;
    }

    .cm-mermaid-preview {
      overflow: visible;
      align-self: stretch;

      width: 100%;
      padding-block-end: 8px;
      padding-inline: 12px;
      border-block-start: 1px solid ${cssVar.colorFillQuaternary};
    }

    .cm-mermaid-chart-area {
      cursor: zoom-in;

      overflow: visible;

      width: 100%;
      min-height: 120px;
      border-radius: ${cssVar.borderRadius}px;

      &:has(.cm-mermaid-render-expanded) {
        cursor: zoom-out;
      }
    }

    .cm-mermaid-render {
      overflow: auto;
      overflow-x: auto;
      width: 100%;

      /* 过小会被裁得像「不全」：略放大默认视窗，内部仍可滚动兜底超高/超宽 */
      max-height: min(480px, 55vh);

      img {
        max-width: 100%;
        height: auto;
      }

      svg {
        height: auto;
      }

      &:not(.cm-mermaid-render-expanded) svg {
        max-width: 100%;
      }

      &.cm-mermaid-render-expanded {
        max-height: min(92vh, 1200px);

        svg {
          max-width: none;
        }
      }
    }

    .cm-markmap-preview {
      overflow: visible;
      align-self: stretch;

      width: 100%;
      padding-block-end: 8px;
      padding-inline: 12px;
      border-block-start: 1px solid ${cssVar.colorFillQuaternary};
    }

    .cm-markmap-chart-area {
      cursor: zoom-in;

      overflow: visible;

      width: 100%;
      min-height: 120px;
      border-radius: ${cssVar.borderRadius}px;

      &:has(.cm-markmap-render-expanded) {
        cursor: zoom-out;
      }
    }

    .cm-markmap-render {
      overflow: auto;
      overflow-x: auto;
      width: 100%;

      max-height: min(480px, 55vh);

      svg {
        height: auto;
      }

      &:not(.cm-markmap-render-expanded) svg {
        max-width: 100%;
      }

      &.cm-markmap-render-expanded {
        max-height: min(92vh, 1200px);

        svg {
          max-width: none;
        }
      }
    }

    .cm-container {
      position: relative;
      width: 100%;
      border-block-start: 1px solid ${cssVar.colorFillQuaternary};
    }

    .cm-container-collapsed {
      overflow: hidden;
      height: 0;
      border-block-start: none;
    }

    .cm-textarea {
      height: 44px;
      opacity: 0;
    }

    &:hover {
      .cm-hidden-actions {
        opacity: 1;
      }

      .cm-language-select {
        opacity: 1;
        filter: grayscale(0);
      }
    }

    /* 深色模式下代码高亮颜色更柔和 */
    @media (prefers-color-scheme: dark) {
      background: ${cssVar.colorFillQuaternary};

      .cm-line {
        & .cm-atom,
        & .cm-attribute {
          color: ${cssVar.purple7};
        }

        & .cm-builtin,
        & .cm-number,
        & .cm-property,
        & .cm-tag {
          color: ${cssVar.volcano7};
        }

        & .cm-function,
        & .cm-keyword,
        & .cm-modifier,
        & .cm-operator,
        & .cm-punctuation,
        & .cm-tag.cm-bracket,
        & .cm-variable-2,
        & .cm-variable.cm-callee {
          color: ${cssVar.geekblue7};
        }

        & .cm-qualifier,
        & .cm-type,
        & .cm-variable-3 {
          color: ${cssVar.gold7};
        }

        & .cm-string,
        & .cm-string-2 {
          color: ${cssVar.green7};
        }
      }

      .cm-gutters {
        background-color: ${cssVar.colorBgElevated} !important;
      }

      .cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {
        background: ${cssVar.cyan6} !important;
      }

      .cm-foldPlaceholder {
        background: url("data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Crect fill='%232A3238' width='16' height='16' rx='2'/%3E%3Cpath d='M2.75 7.984a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.375 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.375 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z' fill='%238C8C8C'/%3E%3C/g%3E%3C/svg%3E")
          no-repeat !important;
      }
    }
  `);
//#endregion
//#region src/plugins/codemirror-block/react/CodemirrorNode.tsx
function isLikelyInteractiveTarget(target) {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(target.closest?.("button, a[href], [role=\"button\"], input, textarea, select"));
}
const ReactCodemirrorNode = ({ node, className, editor }) => {
	const blockShellRef = useRef(null);
	const ref = useRef(null);
	const keydownRef = useRef("");
	const instanceRef = useRef(null);
	const isEmptyRef = useRef(false);
	const t = useTranslation();
	const [isSelected, setSelected, clearSelection, isNodeSelected] = useLexicalNodeSelection(node.getKey());
	const [selectedLang, setSelectedLang] = useState(node.lang || "javascript");
	const [tabSize, setTabSize] = useState(node.options.tabSize ?? 2);
	const [useTabs, setUseTabs] = useState(node.options.indentWithTabs ?? false);
	const [showLineNumbers, setShowLineNumbers] = useState(node.options.lineNumbers ?? false);
	const [expand, setExpand] = useState(true);
	/** Live text for in-editor Mermaid preview (Codemirror only shows source; diagram is rendered here). */
	const [mermaidDiagramSource, setMermaidDiagramSource] = useState(node.code);
	/** Live text for in-editor Markmap preview (Codemirror only shows source; mindmap is rendered here). */
	const [markmapSource, setMarkmapSource] = useState(node.code);
	/**
	* Mermaid/Markmap 模式下是否显示代码源码区。
	* - Toolbar 展开按钮（箭头）仅控制 expand，不直接影响 showSource
	* - 点击代码块内部区域时恢复源码显示
	* - 点击代码块外部区域时隐藏源码，只保留图表
	*/
	const [mermaidShowSource, setMermaidShowSource] = useState(false);
	const [markmapShowSource, setMarkmapShowSource] = useState(false);
	const mermaidPreviewTimerRef = useRef(null);
	const markmapPreviewTimerRef = useRef(null);
	const showCodeMirror = useMemo(() => expand && (selectedLang !== "mermaid" && selectedLang !== "markmap" || selectedLang === "mermaid" && mermaidShowSource || selectedLang === "markmap" && markmapShowSource), [
		expand,
		mermaidShowSource,
		markmapShowSource,
		selectedLang
	]);
	/** Mermaid：单击图表区域切换放大预览（无悬浮按钮） */
	const [mermaidDiagramExpanded, setMermaidDiagramExpanded] = useState(false);
	/** Markmap：单击图表区域切换放大预览（无悬浮按钮） */
	const [markmapExpanded, setMarkmapExpanded] = useState(false);
	useEffect(() => {
		if (selectedLang === "mermaid") {
			setMermaidShowSource(true);
			setMermaidDiagramExpanded(false);
		}
		if (selectedLang === "markmap") {
			setMarkmapShowSource(true);
			setMarkmapExpanded(false);
		}
	}, [selectedLang]);
	/** 点击 Toolbar 展开/收起按钮：仅切换代码面板的展开状态 */
	const toggleCodePanel = useCallback(() => {
		setExpand((prev) => !prev);
	}, []);
	/**
	* Mermaid / Markmap 模式下，点击代码块内部(非图表区域)恢复源码显示，
	* 点击外部则隐藏源码只保留图表。
	* Toolbar 的展开按钮（箭头）独立控制 expand，不会和此逻辑冲突。
	*/
	useEffect(() => {
		if (selectedLang !== "mermaid" && selectedLang !== "markmap") return;
		let detach;
		const bind = (root) => {
			detach?.();
			detach = void 0;
			if (!root) return;
			const onPointerDown = (e) => {
				const shell = blockShellRef.current;
				const target = e.target;
				if (!shell || !(target instanceof Node)) return;
				if (!root.contains(target)) return;
				/** 点击下方渲染区时由图表自己处理缩放，不在此恢复/收起源码 */
				if ((selectedLang === "mermaid" || selectedLang === "markmap") && target instanceof Element && (target.closest("[data-cm-mermaid-chart-area=\"true\"]") || target.closest("[data-cm-markmap-chart-area=\"true\"]"))) return;
				if (shell.contains(target)) {
					if (selectedLang === "mermaid") setMermaidShowSource(true);
					if (selectedLang === "markmap") setMarkmapShowSource(true);
					return;
				}
				if (selectedLang === "mermaid") {
					setMermaidShowSource(false);
					setMermaidDiagramExpanded(false);
				}
				if (selectedLang === "markmap") {
					setMarkmapShowSource(false);
					setMarkmapExpanded(false);
				}
				instanceRef.current?.blur();
			};
			root.addEventListener("pointerdown", onPointerDown, true);
			detach = () => root.removeEventListener("pointerdown", onPointerDown, true);
		};
		bind(editor.getRootElement());
		const removeRootListener = editor.registerRootListener((rootElement) => {
			bind(rootElement);
		});
		return () => {
			detach?.();
			removeRootListener();
		};
	}, [editor, selectedLang]);
	const handleCopy = useCallback(async () => {
		if (instanceRef.current) {
			const code = instanceRef.current.getValue();
			try {
				await navigator.clipboard.writeText(code);
			} catch {
				message.error(t("codemirror.copyFailed"));
			}
		}
	}, [t]);
	const handleLanguageChange = useCallback((value) => {
		setSelectedLang(value);
		if (instanceRef.current) instanceRef.current.setOption("mode", resolveCodeMirrorMode(value));
		editor.update(() => {
			node.setLang(value);
		});
	}, [editor, node]);
	const handleTabSizeChange = useCallback((value = 2) => {
		const v = value === null ? 2 : value;
		setTabSize(v);
		if (instanceRef.current) instanceRef.current.setOption("tabSize", v);
		editor.update(() => {
			node.setTabSize(v);
		});
	}, [editor, node]);
	const handleUseTabsChange = useCallback((checked) => {
		setUseTabs(checked);
		if (instanceRef.current) instanceRef.current.setOption("indentWithTabs", checked);
		editor.update(() => {
			node.setIndentWithTabs(checked);
		});
	}, [editor, node]);
	const handleShowLineNumbersChange = useCallback((checked) => {
		setShowLineNumbers(checked);
		if (instanceRef.current) instanceRef.current.setOption("lineNumbers", checked);
		editor.update(() => {
			node.setLineNumbers(checked);
		});
	}, [editor, node]);
	/** 单击图表（非控件）切换放大预览 */
	const handleMermaidDiagramClick = useCallback((e) => {
		const el = e.target;
		if (!(el instanceof Element)) return;
		if (isLikelyInteractiveTarget(el)) return;
		e.stopPropagation();
		setMermaidDiagramExpanded((v) => !v);
	}, []);
	/** 单击思维导图（非控件）切换放大预览 */
	const handleMarkmapClick = useCallback((e) => {
		const el = e.target;
		if (!(el instanceof Element)) return;
		if (isLikelyInteractiveTarget(el)) return;
		e.stopPropagation();
		setMarkmapExpanded((v) => !v);
	}, []);
	useEffect(() => {
		const sel = editor.getEditorState().read(() => $getSelection());
		if (instanceRef.current?.view.hasFocus && sel === null) return;
		if (!isSelected || !isNodeSelected) {
			if (instanceRef.current) instanceRef.current.blur();
			return;
		}
		if ((selectedLang === "mermaid" || selectedLang === "markmap") && !showCodeMirror) return;
		if (isSelected && instanceRef.current && isNodeSelected) {
			if (instanceRef.current?.view.hasFocus) return;
			instanceRef.current.focus();
			if (keydownRef.current === "end") instanceRef.current.setSelectionToEnd();
		}
	}, [
		isSelected,
		isNodeSelected,
		editor,
		selectedLang,
		showCodeMirror
	]);
	useEffect(() => {
		if (selectedLang !== "mermaid" || !instanceRef.current) return;
		setMermaidDiagramSource(instanceRef.current.getValue());
	}, [selectedLang]);
	useEffect(() => {
		if (selectedLang !== "markmap" || !instanceRef.current) return;
		setMarkmapSource(instanceRef.current.getValue());
	}, [selectedLang]);
	useEffect(() => {
		if (instanceRef.current) return;
		if (ref.current) {
			const dom = ref.current;
			loadCodeMirror().then((CodeMirror) => {
				if (instanceRef.current) return;
				const instance = CodeMirror.fromTextArea(dom, {
					indentWithTabs: useTabs,
					lineNumbers: showLineNumbers,
					mode: resolveCodeMirrorMode(node.lang),
					tabSize,
					theme: "default",
					value: node.code
				});
				instance.view.dispatch({ effects: instance.optionHelper.theme.reconfigure(instance.view.constructor.theme(lobeTheme, { dark: false })) });
				isEmptyRef.current = !node.code.trim();
				instance.on("keydown", (instance, e) => {
					e.stopPropagation();
					if ((e.key === "Enter" || e.keyCode === 13) && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						instanceRef.current?.blur();
						editor.dispatchCommand(SELECT_AFTER_CODEMIRROR_COMMAND, { key: node.getKey() });
						queueMicrotask(() => {
							editor.focus();
						});
						return;
					}
					if (e.key === "Backspace" || e.keyCode === 8) {
						if (!isEmptyRef.current) return;
						e.preventDefault();
						editor.update(() => {
							const prevNode = node.getPreviousSibling();
							node.remove();
							if (prevNode) {
								const prevSelection = prevNode.selectEnd();
								if (prevSelection) $setSelection(prevSelection);
							}
						});
						queueMicrotask(() => {
							editor.focus();
						});
					}
				});
				instance.on("leftOut", () => {
					instanceRef.current?.blur();
					editor.dispatchCommand(SELECT_BEFORE_CODEMIRROR_COMMAND, { key: node.getKey() });
					queueMicrotask(() => {
						editor.focus();
					});
				});
				instance.on("rightOut", () => {
					instanceRef.current?.blur();
					editor.dispatchCommand(SELECT_AFTER_CODEMIRROR_COMMAND, { key: node.getKey() });
					queueMicrotask(() => {
						editor.focus();
					});
				});
				instance.on("change", () => {
					const currentValue = instance.getValue();
					isEmptyRef.current = !currentValue.trim();
					if (mermaidPreviewTimerRef.current) clearTimeout(mermaidPreviewTimerRef.current);
					mermaidPreviewTimerRef.current = setTimeout(() => {
						setMermaidDiagramSource(currentValue);
						mermaidPreviewTimerRef.current = null;
					}, 220);
					if (markmapPreviewTimerRef.current) clearTimeout(markmapPreviewTimerRef.current);
					markmapPreviewTimerRef.current = setTimeout(() => {
						setMarkmapSource(currentValue);
						markmapPreviewTimerRef.current = null;
					}, 220);
				});
				instance.on("change", debounce(() => {
					const currentValue = instance.getValue();
					editor.update(() => {
						node.setCode(currentValue);
					});
				}));
				instance.on("focus", () => {
					if (editor.getEditorState().read(() => {
						const sel = $getSelection();
						if (!sel) return false;
						if (sel?.getNodes().length > 1 || !sel?.getNodes().includes(node)) return true;
						return false;
					})) setSelected(true);
				});
				instanceRef.current = instance;
				if (isSelected) instanceRef.current.focus();
			});
		}
		return () => {
			if (mermaidPreviewTimerRef.current) {
				clearTimeout(mermaidPreviewTimerRef.current);
				mermaidPreviewTimerRef.current = null;
			}
			if (markmapPreviewTimerRef.current) {
				clearTimeout(markmapPreviewTimerRef.current);
				markmapPreviewTimerRef.current = null;
			}
			if (instanceRef.current) {
				instanceRef.current.destroy();
				instanceRef.current = null;
			}
		};
	}, [ref]);
	useEffect(() => {
		return mergeRegister(editor.registerCommand(KEY_DOWN_COMMAND, (payload) => {
			if (payload.key === "ArrowLeft" || payload.key === "ArrowUp") keydownRef.current = "end";
			else keydownRef.current = "";
			return false;
		}, COMMAND_PRIORITY_CRITICAL));
	}, [
		clearSelection,
		editor,
		isSelected,
		node,
		setSelected
	]);
	return /* @__PURE__ */ jsx("div", {
		ref: blockShellRef,
		children: /* @__PURE__ */ jsxs(Block, {
			className: cx(styles$9, isSelected && !isNodeSelected && "selected", className),
			onMouseDown: (e) => e.stopPropagation(),
			onMouseUp: (e) => e.stopPropagation(),
			onSelect: (e) => e.stopPropagation(),
			variant: "filled",
			children: [
				/* @__PURE__ */ jsx(Toolbar, {
					expand,
					onCopy: handleCopy,
					onLanguageChange: handleLanguageChange,
					onShowLineNumbersChange: handleShowLineNumbersChange,
					onTabSizeChange: handleTabSizeChange,
					onUseTabsChange: handleUseTabsChange,
					selectedLang,
					showLineNumbers,
					tabSize,
					toggleExpand: toggleCodePanel,
					useTabs
				}),
				/* @__PURE__ */ jsx("div", {
					className: cx("cm-container", !showCodeMirror && "cm-container-collapsed"),
					children: /* @__PURE__ */ jsx("textarea", {
						className: "cm-textarea",
						ref
					})
				}),
				selectedLang === "mermaid" && mermaidDiagramSource.trim().length > 0 && /* @__PURE__ */ jsx("div", {
					className: "cm-mermaid-preview",
					"data-cm-mermaid-chart-area": "true",
					children: /* @__PURE__ */ jsx("div", {
						className: "cm-mermaid-chart-area",
						onClick: handleMermaidDiagramClick,
						children: /* @__PURE__ */ jsx("div", {
							className: cx("cm-mermaid-render", mermaidDiagramExpanded && "cm-mermaid-render-expanded"),
							children: /* @__PURE__ */ jsx(MermaidWithErrorBoundary, {
								animated: false,
								fullFeatured: false,
								showLanguage: true,
								theme: "lobe-theme",
								variant: "filled",
								children: mermaidDiagramSource.trim()
							})
						})
					})
				}),
				selectedLang === "markmap" && markmapSource.trim().length > 0 && /* @__PURE__ */ jsx("div", {
					className: "cm-markmap-preview",
					"data-cm-markmap-chart-area": "true",
					children: /* @__PURE__ */ jsx("div", {
						className: "cm-markmap-chart-area",
						onClick: handleMarkmapClick,
						children: /* @__PURE__ */ jsx("div", {
							className: cx("cm-markmap-render", markmapExpanded && "cm-markmap-render-expanded"),
							children: /* @__PURE__ */ jsx(MarkmapWithErrorBoundary, {
								enableImagePreview: true,
								children: markmapSource.trim()
							})
						})
					})
				})
			]
		})
	});
};
ReactCodemirrorNode.displayName = "ReactCodemirrorNode";
//#endregion
//#region src/plugins/codemirror-block/react/ReactCodemirrorNode.tsx
const ReactCodemirrorPlugin = ({ className }) => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(CodemirrorPlugin, {
			decorator(node, editor) {
				return /* @__PURE__ */ jsx(ReactCodemirrorNode, {
					className,
					editor,
					node
				});
			},
			theme: className
		});
	}, [editor, className]);
	return null;
};
ReactCodemirrorPlugin.displayName = "ReactCodemirrorPlugin";
//#endregion
//#region src/plugins/diff/node/DiffChromeNode.ts
init_utils();
/** Toolbar + optional red "old" preview inside a DiffHunk ElementNode. */
var DiffChromeNode = class DiffChromeNode extends DecoratorNode {
	static getType() {
		return "diff-chrome";
	}
	static clone(node) {
		return new DiffChromeNode(node.__opId, node.__kind, node.__oldText, node.__key);
	}
	static importJSON(serializedNode) {
		return $createDiffChromeNode({
			kind: serializedNode.kind,
			oldText: serializedNode.oldText ?? "",
			opId: serializedNode.opId
		}).updateFromJSON(serializedNode);
	}
	constructor(opId, kind, oldText, key) {
		super(key);
		this.__opId = opId;
		this.__kind = kind;
		this.__oldText = oldText;
	}
	get opId() {
		return this.__opId;
	}
	get kind() {
		return this.__kind;
	}
	get oldText() {
		return this.__oldText;
	}
	createDOM(config) {
		const el = document.createElement("div");
		addClassNamesToElement(el, config.theme?.["diff-chrome"]);
		el.setAttribute("contenteditable", "false");
		el.setAttribute("data-diff-chrome-kind", this.__kind);
		if (this.__kind !== "update" || !this.__oldText) el.style.display = "none";
		return el;
	}
	updateDOM() {
		return false;
	}
	exportDOM() {
		return { element: document.createElement("div") };
	}
	isInline() {
		return false;
	}
	isKeyboardSelectable() {
		return false;
	}
	getTextContent() {
		return "";
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			kind: this.__kind,
			oldText: this.__oldText,
			opId: this.__opId,
			type: "diff-chrome",
			version: 1
		};
	}
	updateFromJSON(serializedNode) {
		const self = super.updateFromJSON(serializedNode);
		if (serializedNode.opId) self.__opId = serializedNode.opId;
		if (serializedNode.kind) self.__kind = serializedNode.kind;
		if (typeof serializedNode.oldText === "string") self.__oldText = serializedNode.oldText;
		return self;
	}
	decorate(editor) {
		const decorator = getKernelFromEditor(editor)?.getDecorator("diff-chrome");
		if (!decorator) return null;
		if (typeof decorator === "function") return decorator(this, editor);
		return {
			queryDOM: decorator.queryDOM,
			render: decorator.render(this, editor)
		};
	}
};
function $createDiffChromeNode(payload) {
	return $applyNodeReplacement(new DiffChromeNode(payload.opId, payload.kind, payload.oldText ?? ""));
}
function $isDiffChromeNode(node) {
	return node instanceof DiffChromeNode;
}
//#endregion
//#region src/plugins/diff/node/DiffHunkNode.ts
/**
* Top-level ElementNode hunk:
* - children[0] = DiffChrome (buttons + optional red old text)
* - children[1..] = editable block content (new for update/insert, old body for delete)
*/
var DiffHunkNode = class DiffHunkNode extends ElementNode {
	static getType() {
		return "diff-hunk";
	}
	static clone(node) {
		return new DiffHunkNode(node.__opId, node.__kind, node.__oldBlock, node.__key);
	}
	static importJSON(serializedNode) {
		return $createDiffHunkNode({
			kind: serializedNode.kind,
			oldBlock: serializedNode.oldBlock ?? null,
			opId: serializedNode.opId
		}).updateFromJSON(serializedNode);
	}
	constructor(opId, kind, oldBlock, key) {
		super(key);
		this.__opId = opId;
		this.__kind = kind;
		this.__oldBlock = oldBlock;
	}
	get opId() {
		return this.__opId;
	}
	get kind() {
		return this.__kind;
	}
	get oldBlock() {
		return this.__oldBlock;
	}
	createDOM(config) {
		const element = document.createElement("div");
		addClassNamesToElement(element, config.theme?.["diff-hunk"]);
		element.classList.add(`is-${this.__kind}`);
		element.setAttribute("data-diff-op-id", this.__opId);
		element.setAttribute("data-diff-kind", this.__kind);
		return element;
	}
	updateDOM(prev, dom) {
		if (prev.__kind !== this.__kind) {
			dom.classList.remove(`is-${prev.__kind}`);
			dom.classList.add(`is-${this.__kind}`);
			dom.setAttribute("data-diff-kind", this.__kind);
		}
		return false;
	}
	exportDOM() {
		return { element: document.createElement("div") };
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			kind: this.__kind,
			oldBlock: this.__oldBlock,
			opId: this.__opId,
			type: "diff-hunk",
			version: 1
		};
	}
	updateFromJSON(serializedNode) {
		const self = super.updateFromJSON(serializedNode);
		if (serializedNode.opId) self.__opId = serializedNode.opId;
		if (serializedNode.kind) self.__kind = serializedNode.kind;
		if ("oldBlock" in serializedNode) self.__oldBlock = serializedNode.oldBlock ?? null;
		return self;
	}
	canBeEmpty() {
		return false;
	}
};
function $createDiffHunkNode(payload) {
	return $applyNodeReplacement(new DiffHunkNode(payload.opId, payload.kind, payload.oldBlock ?? null));
}
function $isDiffHunkNode(node) {
	return node instanceof DiffHunkNode;
}
//#endregion
//#region src/plugins/diff/utils/sample-block.ts
/** Demo helper: plain paragraph serialized block. */
function makeParagraphBlock(text) {
	return {
		children: [{
			detail: 0,
			format: 0,
			mode: "normal",
			style: "",
			text,
			type: "text",
			version: 1
		}],
		direction: "ltr",
		format: "",
		indent: 0,
		textFormat: 0,
		textStyle: "",
		type: "paragraph",
		version: 1
	};
}
function blockPlainText(block) {
	if (!block) return "";
	const walk = (node) => {
		if (typeof node.text === "string") return node.text;
		const children = node.children;
		if (!Array.isArray(children)) return "";
		return children.map((c) => walk(c)).join("");
	};
	return walk(block);
}
//#endregion
//#region src/plugins/diff/command/index.ts
init_utils$1();
const APPLY_DIFF_OP_COMMAND = createCommand("APPLY_DIFF_OP_COMMAND");
const ACCEPT_DIFF_OP_COMMAND = createCommand("ACCEPT_DIFF_OP_COMMAND");
const REJECT_DIFF_OP_COMMAND = createCommand("REJECT_DIFF_OP_COMMAND");
let opSeq = 0;
function nextOpId() {
	opSeq += 1;
	return `diff-${Date.now().toString(36)}-${opSeq}`;
}
function $getTopLevelBySlot(slot1Based) {
	return $getRoot().getChildren()[slot1Based - 1] ?? null;
}
function $getSelectedTopLevel() {
	const selection = $getSelection() || $getPreviousSelection();
	if (!$isRangeSelection(selection)) return null;
	try {
		const top = selection.anchor.getNode().getTopLevelElementOrThrow();
		if ($isDiffHunkNode(top) || $isDiffChromeNode(top)) return null;
		let n = selection.anchor.getNode();
		while (n) {
			if ($isDiffHunkNode(n)) return null;
			n = n.getParent();
		}
		return top;
	} catch {
		return null;
	}
}
function $appendSerializedBlock(hunk, block) {
	const live = $parseSerializedNode(block);
	hunk.append(live);
}
/** @internal exported for overwrite_all / slot APIs */
function $buildHunk(kind, oldBlock, contentBlock) {
	const opId = nextOpId();
	const hunk = $createDiffHunkNode({
		kind,
		oldBlock,
		opId
	});
	const oldText = kind === "update" || kind === "delete" ? blockPlainText(oldBlock) : "";
	hunk.append($createDiffChromeNode({
		kind,
		oldText: kind === "update" ? oldText : "",
		opId
	}));
	$appendSerializedBlock(hunk, contentBlock);
	return hunk;
}
function $resolveTarget(slot) {
	if (typeof slot === "number") return $getTopLevelBySlot(slot);
	return $getSelectedTopLevel() ?? $getTopLevelBySlot(1);
}
function $applyOp(payload) {
	if (payload.kind === "update") {
		const target = $resolveTarget(payload.slot);
		if (!target || !$isElementNode(target) || $isDiffHunkNode(target)) return false;
		const hunk = $buildHunk("update", exportNodeToJSON(target), payload.newBlock);
		target.replace(hunk);
		return true;
	}
	if (payload.kind === "delete") {
		const target = $resolveTarget(payload.slot);
		if (!target || !$isElementNode(target) || $isDiffHunkNode(target)) return false;
		const oldBlock = exportNodeToJSON(target);
		const hunk = $buildHunk("delete", oldBlock, oldBlock);
		target.replace(hunk);
		return true;
	}
	const after = typeof payload.afterSlot === "number" ? payload.afterSlot === 0 ? null : $getTopLevelBySlot(payload.afterSlot) : $getSelectedTopLevel() ?? $getTopLevelBySlot(1);
	const hunk = $buildHunk("insert", null, payload.newBlock);
	if (!after) {
		const root = $getRoot();
		const first = root.getFirstChild();
		if (first) first.insertBefore(hunk);
		else root.append(hunk);
		return true;
	}
	if ($isDiffHunkNode(after)) return false;
	after.insertAfter(hunk);
	return true;
}
function $findHunkByOpId(opId) {
	for (const child of $getRoot().getChildren()) if ($isDiffHunkNode(child) && child.opId === opId) return child;
	return null;
}
function $contentChildren(hunk) {
	return hunk.getChildren().filter((c) => !$isDiffChromeNode(c));
}
function $accept(opId) {
	const hunk = $findHunkByOpId(opId);
	if (!hunk) return false;
	if (hunk.kind === "delete") {
		hunk.remove();
		return true;
	}
	const content = $contentChildren(hunk);
	if (content.length === 0) {
		hunk.remove();
		return true;
	}
	for (const node of content) hunk.insertBefore(node);
	hunk.remove();
	return true;
}
function $reject(opId) {
	const hunk = $findHunkByOpId(opId);
	if (!hunk) return false;
	if (hunk.kind === "insert") {
		hunk.remove();
		return true;
	}
	const block = hunk.oldBlock;
	if (!block) {
		hunk.remove();
		return true;
	}
	const live = $parseSerializedNode(block);
	hunk.replace(live);
	return true;
}
function registerDiffCommands(editor) {
	return [
		editor.registerCommand(APPLY_DIFF_OP_COMMAND, (payload) => {
			let ok = false;
			editor.update(() => {
				ok = $applyOp(payload);
			}, { discrete: true });
			return ok;
		}, COMMAND_PRIORITY_EDITOR),
		editor.registerCommand(ACCEPT_DIFF_OP_COMMAND, (opId) => {
			let ok = false;
			editor.update(() => {
				ok = $accept(opId);
			}, { discrete: true });
			return ok;
		}, COMMAND_PRIORITY_EDITOR),
		editor.registerCommand(REJECT_DIFF_OP_COMMAND, (opId) => {
			let ok = false;
			editor.update(() => {
				ok = $reject(opId);
			}, { discrete: true });
			return ok;
		}, COMMAND_PRIORITY_EDITOR)
	];
}
function acceptDiffOp(editor, opId) {
	editor.update(() => {
		$accept(opId);
	});
}
function rejectDiffOp(editor, opId) {
	editor.update(() => {
		$reject(opId);
	});
}
function $collectOpIds() {
	const ids = [];
	for (const child of $getRoot().getChildren()) if ($isDiffHunkNode(child)) ids.push(child.opId);
	else if (child.getType() === "diff-hunk") {
		const id = child.__opId;
		if (id) ids.push(id);
	}
	return ids;
}
/** Must run inside `editor.update`. */
function $acceptAllDiffOps() {
	for (const id of $collectOpIds()) $accept(id);
}
/** Must run inside `editor.update`. Undo All — restore pre-proposal tree. */
function $rejectAllDiffOps() {
	for (const id of $collectOpIds()) $reject(id);
}
function acceptAllDiffOps(editor) {
	editor.update(() => {
		$acceptAllDiffOps();
	});
}
function rejectAllDiffOps(editor) {
	editor.update(() => {
		$rejectAllDiffOps();
	});
}
function $hasPendingDiff() {
	return $collectOpIds().length > 0;
}
function hasPendingDiff(editor) {
	return editor.getEditorState().read(() => $hasPendingDiff());
}
/** Host publish gate: block when any DiffHunk is pending. */
function assertCanPublish(editor) {
	if (hasPendingDiff(editor)) return {
		ok: false,
		error: "pending diff; Keep All / Undo All before publish"
	};
	return { ok: true };
}
/** @deprecated use acceptDiffOp */
function acceptDiffHunkByKey(editor, key) {
	editor.update(() => {
		const node = $getNodeByKey(key);
		if ($isDiffHunkNode(node)) $accept(node.opId);
		if ($isDiffChromeNode(node)) $accept(node.opId);
	});
}
/** @deprecated use rejectDiffOp */
function rejectDiffHunkByKey(editor, key) {
	editor.update(() => {
		const node = $getNodeByKey(key);
		if ($isDiffHunkNode(node)) $reject(node.opId);
		if ($isDiffChromeNode(node)) $reject(node.opId);
	});
}
//#endregion
//#region src/plugins/diff/api.ts
init_utils();
init_utils$1();
/** Drop any in-flight DiffHunks (Undo All) so a new proposal can land. */
function discardPendingDiffs(editor) {
	if (hasPendingDiff(editor)) rejectAllDiffOps(editor);
}
function mdToRoot(editor, md) {
	try {
		const service = getKernelFromEditor(editor).requireService(IMarkdownShortCutService);
		if (service) return { root: service.parseMarkdownToLexical(md) };
	} catch {}
	return { root: parseMarkdownToLexical(md, {}) };
}
function mdToBlocks(editor, md) {
	const { root } = mdToRoot(editor, md);
	return Array.isArray(root.children) ? [...root.children] : [];
}
function isDiffHunkSerialized(node) {
	return node.type === "diff-hunk";
}
function isDiffChromeSerialized(node) {
	return node.type === "diff-chrome";
}
function flattenSerializedHunk(node, mode) {
	const record = node;
	const kind = String(record.kind ?? "");
	const oldBlock = record.oldBlock ?? null;
	const children = Array.isArray(record.children) ? record.children.filter((c) => !isDiffChromeSerialized(c)) : [];
	if (mode === "keep") {
		if (kind === "delete") return [];
		return children;
	}
	if (kind === "insert") return [];
	if (oldBlock) return [oldBlock];
	return [];
}
/** Pure: strip DiffHunk from serialized state (does not mutate the live editor). */
function flattenCanonicalState(state, mode = "keep") {
	const children = Array.isArray(state.root.children) ? state.root.children : [];
	const next = [];
	for (const child of children) if (isDiffHunkSerialized(child)) next.push(...flattenSerializedHunk(child, mode));
	else next.push(child);
	return { root: {
		...state.root,
		children: next
	} };
}
function getCanonicalEditorState(editor, mode = "keep") {
	return flattenCanonicalState(editor.getEditorState().toJSON(), mode);
}
function $getSlotNode(slot1Based) {
	return $getRoot().getChildren()[slot1Based - 1] ?? null;
}
function updateSlot(editor, slot, md) {
	discardPendingDiffs(editor);
	const blocks = mdToBlocks(editor, md);
	if (blocks.length !== 1) return {
		error: "update_slot expects exactly one top-level markdown block",
		ok: false
	};
	let ok = false;
	let error = "update_slot failed";
	editor.update(() => {
		$rejectAllDiffOps();
		const target = $getSlotNode(slot);
		if (!target || $isDiffHunkNode(target)) {
			error = "invalid slot or target is already a diff hunk";
			return;
		}
		const hunk = $buildHunk("update", exportNodeToJSON(target), blocks[0]);
		target.replace(hunk);
		ok = true;
	}, { discrete: true });
	return ok ? { ok: true } : {
		error,
		ok: false
	};
}
function insertAfterSlot(editor, slot, md) {
	discardPendingDiffs(editor);
	const blocks = mdToBlocks(editor, md);
	if (blocks.length === 0) return {
		error: "insert_after got empty markdown",
		ok: false
	};
	let ok = false;
	let error = "insert_after failed";
	editor.update(() => {
		$rejectAllDiffOps();
		const after = slot === 0 ? null : $getSlotNode(slot);
		if (slot !== 0 && (!after || $isDiffHunkNode(after))) {
			error = "invalid afterSlot";
			return;
		}
		let cursor = after;
		for (const block of blocks) {
			const hunk = $buildHunk("insert", null, block);
			if (!cursor) {
				const root = $getRoot();
				const first = root.getFirstChild();
				if (first) first.insertBefore(hunk);
				else root.append(hunk);
			} else cursor.insertAfter(hunk);
			cursor = hunk;
		}
		ok = true;
	}, { discrete: true });
	return ok ? { ok: true } : {
		error,
		ok: false
	};
}
function removeSlot(editor, slot) {
	discardPendingDiffs(editor);
	let ok = false;
	let error = "remove_slot failed";
	editor.update(() => {
		$rejectAllDiffOps();
		const target = $getSlotNode(slot);
		if (!target || $isDiffHunkNode(target)) {
			error = "invalid slot or target is already a diff hunk";
			return;
		}
		const oldBlock = exportNodeToJSON(target);
		const hunk = $buildHunk("delete", oldBlock, oldBlock);
		target.replace(hunk);
		ok = true;
	}, { discrete: true });
	return ok ? { ok: true } : {
		error,
		ok: false
	};
}
function buildOverwritePlan(oldState, newState) {
	const rows = computeLexicalDiffRows(oldState, newState);
	const plan = [];
	for (const row of rows) {
		if (row.kind === "equal") {
			const block = row.oldCell?.sourceBlock ?? row.oldCell?.block;
			if (block) plan.push({
				block,
				kind: "equal"
			});
			continue;
		}
		if (row.kind === "modify") {
			const oldBlock = row.oldCell?.sourceBlock ?? row.oldCell?.block;
			const newBlock = row.newCell?.sourceBlock ?? row.newCell?.block;
			if (oldBlock && newBlock) plan.push({
				kind: "update",
				newBlock,
				oldBlock
			});
			continue;
		}
		if (row.kind === "delete") {
			const oldBlock = row.oldCell?.sourceBlock ?? row.oldCell?.block;
			if (oldBlock) plan.push({
				kind: "delete",
				oldBlock
			});
			continue;
		}
		const newBlock = row.newCell?.sourceBlock ?? row.newCell?.block;
		if (newBlock) plan.push({
			kind: "insert",
			newBlock
		});
	}
	return plan;
}
function applyOverwritePlan(editor, newState) {
	discardPendingDiffs(editor);
	const plan = buildOverwritePlan(editor.getEditorState().toJSON(), newState);
	if (!plan.some((p) => p.kind !== "equal")) return { ok: true };
	let applied = false;
	editor.update(() => {
		$rejectAllDiffOps();
		const root = $getRoot();
		root.clear();
		for (const step of plan) {
			if (step.kind === "equal") {
				root.append($parseSerializedNode(step.block));
				continue;
			}
			if (step.kind === "update") {
				root.append($buildHunk("update", step.oldBlock, step.newBlock));
				continue;
			}
			if (step.kind === "delete") {
				root.append($buildHunk("delete", step.oldBlock, step.oldBlock));
				continue;
			}
			root.append($buildHunk("insert", null, step.newBlock));
		}
		applied = true;
	}, { discrete: true });
	return applied ? { ok: true } : {
		error: "overwrite_all failed",
		ok: false
	};
}
/**
* Full-document propose (approach B): LCS current vs md → multiple DiffHunks.
* Any pending hunks are Undo All'd first so LCS runs against the restored base.
*/
function overwriteAll(editor, md) {
	return applyOverwritePlan(editor, mdToRoot(editor, md));
}
/**
* Same as overwriteAll, but new side is already Lexical JSON.
* Prefer this for batch_update_slots: avoid Lexical→MD→Lexical round-trip that
* rewrites every unchanged block and paints the whole doc as modified.
*/
function overwriteAllFromState(editor, newState) {
	return applyOverwritePlan(editor, newState);
}
/** Mutate live tree via accept/reject all. Prefer getCanonicalEditorState for export. */
function materializeCanonical(editor, mode) {
	if (mode === "keep") acceptAllDiffOps(editor);
	else rejectAllDiffOps(editor);
}
//#endregion
//#region src/plugins/diff/plugin/index.ts
init_plugin();
const DiffPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "DiffPlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		kernel.registerNodes([DiffHunkNode, DiffChromeNode]);
		kernel.registerThemes({
			"diff-chrome": "",
			"diff-hunk": config?.theme || ""
		});
		this.registerDecorator(kernel, "diff-chrome", (node, editor) => {
			return config?.decorator ? config.decorator(node, editor) : null;
		});
	}
	onInit(editor) {
		this.register(mergeRegister(...registerDiffCommands(editor)));
	}
};
//#endregion
//#region src/plugins/diff/react/style.ts
const styles$8 = createStaticStyles(({ css }) => ({
	chrome: css`
    margin: 0;
    padding: 0;
    line-height: 0;
    user-select: none;
  `,
	deleteLine: css`
    margin: 0;
    padding: 2px 10px;
    background: color-mix(in srgb, #f14c4c 16%, transparent);
    color: #c72e2e;
    font-size: 1rem;
    line-height: 1.6;
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, #c72e2e 50%, transparent);
    box-shadow: inset 3px 0 0 #f14c4c;
  `,
	hunkActions: css`
    position: fixed;
    z-index: 1000;
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 4px;
    border: 1px solid color-mix(in srgb, #000 10%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, #f4f4f4 92%, transparent);
    box-shadow: 0 2px 10px rgb(0 0 0 / 12%);
    backdrop-filter: blur(10px);
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  `,
	keepBtn: css`
    cursor: pointer;
    padding: 5px 12px;
    border: none;
    border-radius: 6px;
    background: #2ea043;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;

    &:hover {
      background: #3fb950;
    }
  `,
	navBtn: css`
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #555;
    font-size: 10px;
    line-height: 1;

    &:hover {
      background: rgb(0 0 0 / 6%);
    }

    &:disabled {
      cursor: default;
      opacity: 0.35;
    }
  `,
	navCount: css`
    min-width: 3.2em;
    color: #555;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    text-align: center;
    white-space: nowrap;
    user-select: none;
  `,
	topBar: css`
    display: flex;
    gap: 8px;
    align-items: center;
    margin-block-end: 8px;
    padding: 6px 8px;
    border: 1px solid color-mix(in srgb, #000 8%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, #f7f7f7 96%, transparent);
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  `,
	topSpacer: css`
    flex: 1;
  `,
	undoBtn: css`
    cursor: pointer;
    padding: 5px 10px;
    border: 1px solid color-mix(in srgb, #000 12%, transparent);
    border-radius: 6px;
    background: #ebebeb;
    color: #333;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;

    &:hover {
      background: #e0e0e0;
    }
  `
}));
/** Theme on DiffHunk ElementNode DOM — Cursor-like red/green wash. */
const diffHunkTheme = createStaticStyles(({ css }) => css`
    position: relative;
    /* 不同 hunk（不相关改动）之间留间距，避免糊成一片 */
    margin-block: 0.55em;
    border-radius: 0;

    /*
     * hunk 内部子块贴紧：update 的红 chrome + 绿正文是同一改动，不要露白缝。
     * （也压掉 .mdocs-editor p / UA 的默认外边距）
     */
    & > * {
      margin-block: 0 !important;
    }

    &.is-delete {
      background: color-mix(in srgb, #f14c4c 16%, transparent);
      color: #c72e2e;
      text-decoration: line-through;
      text-decoration-color: color-mix(in srgb, #c72e2e 45%, transparent);
    }

    &.is-insert {
      background: color-mix(in srgb, #3fb950 16%, transparent);

      &.is-active {
        background: color-mix(in srgb, #3fb950 22%, transparent);
        box-shadow: inset 3px 0 0 #3fb950;
      }
    }

    &.is-update {
      display: flex;
      flex-direction: column;
      gap: 0;
      background: transparent;

      /* chrome 宿主本身不留底缝 */
      & > [data-diff-chrome-kind] {
        flex: 0 0 auto;
        margin: 0 !important;
        padding: 0;
        line-height: 0;
      }

      & > :not([data-diff-chrome-kind]) {
        flex: 0 0 auto;
        /* 物理 longhand 压掉 .mdocs-editor p/h* 的 margin-top/bottom（逻辑属性有时压不住） */
        margin: 0 !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        margin-block: 0 !important;
        background: color-mix(in srgb, #3fb950 16%, transparent);
      }

      &.is-active > :not([data-diff-chrome-kind]) {
        background: color-mix(in srgb, #3fb950 22%, transparent);
        box-shadow: inset 3px 0 0 #3fb950;
      }
    }

    &.is-delete.is-active {
      background: color-mix(in srgb, #f14c4c 22%, transparent);
      box-shadow: inset 3px 0 0 #f14c4c;
    }
  `);
//#endregion
//#region src/plugins/diff/react/components/DiffChromeView.tsx
/** Old-line preview only (Cursor-style). Keep/Undo live in the floating bar. */
const DiffChromeView = ({ node }) => {
	if (node.kind === "update" && node.oldText) return /* @__PURE__ */ jsx("div", {
		className: styles$8.chrome,
		contentEditable: false,
		children: /* @__PURE__ */ jsx("div", {
			className: styles$8.deleteLine,
			children: node.oldText
		})
	});
	return null;
};
DiffChromeView.displayName = "DiffChromeView";
//#endregion
//#region src/plugins/diff/react/components/DiffReviewBar.tsx
function readPending(lexical) {
	const list = [];
	lexical.getEditorState().read(() => {
		for (const child of $getRoot().getChildren()) {
			if (!$isDiffHunkNode(child) && child.getType() !== "diff-hunk") continue;
			const opId = $isDiffHunkNode(child) ? child.opId : String(child.__opId ?? "");
			const kind = $isDiffHunkNode(child) ? child.kind : String(child.__kind ?? "");
			if (opId) list.push({
				kind,
				opId
			});
		}
	});
	return list;
}
function markActive(root, opId) {
	if (!root) return;
	root.querySelectorAll("[data-diff-op-id]").forEach((el) => {
		el.classList.toggle("is-active", el.getAttribute("data-diff-op-id") === opId);
	});
}
function scrollToOp(root, opId) {
	if (!root || !opId) return;
	root.querySelector(`[data-diff-op-id="${opId}"]`)?.scrollIntoView({
		behavior: "smooth",
		block: "nearest"
	});
}
function placeUnder(hunk) {
	const opId = hunk.getAttribute("data-diff-op-id");
	if (!opId) return null;
	const rect = hunk.getBoundingClientRect();
	return {
		left: rect.left,
		opId,
		top: rect.bottom + 4
	};
}
const DiffReviewBar = ({ editor }) => {
	const [pending, setPending] = useState([]);
	const [index, setIndex] = useState(0);
	const [lexical, setLexical] = useState(null);
	const [hover, setHover] = useState(null);
	const hoverHunkRef = useRef(null);
	const hideTimerRef = useRef(null);
	const refresh = useCallback((lex) => {
		const next = readPending(lex);
		setPending(next);
		setIndex((i) => next.length === 0 ? 0 : Math.min(i, next.length - 1));
		setHover((h) => {
			if (!h || !next.some((p) => p.opId === h.opId)) {
				hoverHunkRef.current = null;
				return null;
			}
			const el = hoverHunkRef.current;
			return el ? placeUnder(el) : h;
		});
	}, []);
	useLexicalEditor((lex) => {
		setLexical(lex);
		refresh(lex);
		return lex.registerUpdateListener(() => {
			refresh(lex);
		});
	}, [refresh]);
	const active = pending[index];
	useEffect(() => {
		markActive(editor.getRootElement(), active?.opId);
	}, [
		editor,
		active?.opId,
		pending
	]);
	const clearHideTimer = () => {
		if (hideTimerRef.current != null) {
			window.clearTimeout(hideTimerRef.current);
			hideTimerRef.current = null;
		}
	};
	const scheduleHide = () => {
		clearHideTimer();
		hideTimerRef.current = window.setTimeout(() => {
			hoverHunkRef.current = null;
			setHover(null);
		}, 140);
	};
	const showActionsFor = useCallback((hunk) => {
		clearHideTimer();
		hoverHunkRef.current = hunk;
		const next = placeUnder(hunk);
		if (!next) return;
		setHover(next);
		setIndex((i) => {
			const idx = pending.findIndex((p) => p.opId === next.opId);
			return idx >= 0 ? idx : i;
		});
	}, [pending]);
	useEffect(() => {
		const root = editor.getRootElement();
		if (!root || pending.length === 0) return;
		const onOver = (e) => {
			const t = e.target;
			if (!t?.closest) return;
			if (t.closest("[data-diff-hunk-actions]")) {
				clearHideTimer();
				return;
			}
			const hunk = t.closest("[data-diff-op-id]");
			if (hunk && root.contains(hunk)) showActionsFor(hunk);
		};
		const onOut = (e) => {
			const to = e.relatedTarget;
			if (to?.closest?.("[data-diff-op-id]") || to?.closest?.("[data-diff-hunk-actions]")) return;
			scheduleHide();
		};
		root.addEventListener("mouseover", onOver);
		root.addEventListener("mouseout", onOut);
		return () => {
			root.removeEventListener("mouseover", onOver);
			root.removeEventListener("mouseout", onOut);
			clearHideTimer();
		};
	}, [
		editor,
		pending.length,
		showActionsFor
	]);
	useEffect(() => {
		if (!hover) return;
		const sync = () => {
			const el = hoverHunkRef.current;
			if (!el) return;
			const next = placeUnder(el);
			if (next) setHover(next);
		};
		window.addEventListener("scroll", sync, true);
		window.addEventListener("resize", sync);
		return () => {
			window.removeEventListener("scroll", sync, true);
			window.removeEventListener("resize", sync);
		};
	}, [hover]);
	useEffect(() => {
		const onKey = (e) => {
			if (pending.length === 0 || !lexical || !active) return;
			const meta = e.metaKey || e.ctrlKey;
			if (meta && e.key.toLowerCase() === "y") {
				e.preventDefault();
				acceptDiffOp(lexical, active.opId);
			}
			if (meta && e.key.toLowerCase() === "n") {
				e.preventDefault();
				rejectDiffOp(lexical, active.opId);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		lexical,
		pending,
		active
	]);
	if (pending.length === 0 || !lexical) return null;
	const go = (nextIndex) => {
		setIndex(nextIndex);
		scrollToOp(editor.getRootElement(), pending[nextIndex]?.opId);
	};
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
		className: styles$8.topBar,
		children: [
			/* @__PURE__ */ jsx("button", {
				"aria-label": "Previous change",
				className: styles$8.navBtn,
				disabled: pending.length < 2,
				onClick: () => go((index - 1 + pending.length) % pending.length),
				onMouseDown: (e) => e.preventDefault(),
				type: "button",
				children: "▲"
			}),
			/* @__PURE__ */ jsxs("span", {
				className: styles$8.navCount,
				children: [
					index + 1,
					" of ",
					pending.length
				]
			}),
			/* @__PURE__ */ jsx("button", {
				"aria-label": "Next change",
				className: styles$8.navBtn,
				disabled: pending.length < 2,
				onClick: () => go((index + 1) % pending.length),
				onMouseDown: (e) => e.preventDefault(),
				type: "button",
				children: "▼"
			}),
			/* @__PURE__ */ jsx("div", { className: styles$8.topSpacer }),
			/* @__PURE__ */ jsx("button", {
				className: styles$8.undoBtn,
				onClick: () => rejectAllDiffOps(lexical),
				onMouseDown: (e) => e.preventDefault(),
				type: "button",
				children: "Undo All"
			}),
			/* @__PURE__ */ jsx("button", {
				className: styles$8.keepBtn,
				onClick: () => acceptAllDiffOps(lexical),
				onMouseDown: (e) => e.preventDefault(),
				type: "button",
				children: "Keep All"
			})
		]
	}), hover ? createPortal(/* @__PURE__ */ jsxs("div", {
		className: styles$8.hunkActions,
		"data-diff-hunk-actions": "",
		onMouseEnter: clearHideTimer,
		onMouseLeave: scheduleHide,
		style: {
			left: hover.left,
			top: hover.top
		},
		children: [/* @__PURE__ */ jsx("button", {
			className: styles$8.undoBtn,
			onClick: () => rejectDiffOp(lexical, hover.opId),
			onMouseDown: (e) => e.preventDefault(),
			type: "button",
			children: "Undo ⌘N"
		}), /* @__PURE__ */ jsx("button", {
			className: styles$8.keepBtn,
			onClick: () => acceptDiffOp(lexical, hover.opId),
			onMouseDown: (e) => e.preventDefault(),
			type: "button",
			children: "Keep ⌘Y"
		})]
	}), document.body) : null] });
};
DiffReviewBar.displayName = "DiffReviewBar";
//#endregion
//#region src/plugins/diff/react/ReactDiffPlugin.tsx
/**
* Register during render (useMemo) before ReactPlainText setRootElement.
* Top bar: ▲/▼ + Keep All / Undo All; hover a hunk → Keep/Undo under it.
*/
const ReactDiffPlugin = () => {
	const [editor] = useLexicalComposerContext();
	useMemo(() => {
		editor.registerPlugin(DiffPlugin, {
			decorator(node, lexicalEditor) {
				return /* @__PURE__ */ jsx(DiffChromeView, {
					editor: lexicalEditor,
					node
				});
			},
			theme: diffHunkTheme
		});
	}, [editor]);
	return /* @__PURE__ */ jsx(DiffReviewBar, { editor });
};
ReactDiffPlugin.displayName = "ReactDiffPlugin";
//#endregion
//#region src/plugins/file/command/index.ts
init_debug();
const logger$2 = createDebugLogger("plugin", "file");
const INSERT_FILE_COMMAND = createCommand("INSERT_FILE_COMMAND");
function registerFileCommand(editor, handleUpload) {
	return editor.registerCommand(INSERT_FILE_COMMAND, (payload) => {
		const { file } = payload;
		editor.update(() => {
			const fileNode = $createFileNode(file.name);
			$insertNodes([fileNode]);
			if ($isRootOrShadowRoot(fileNode.getParentOrThrow())) $wrapNodeInElement(fileNode, $createParagraphNode).selectEnd();
			handleUpload(file).then((url) => {
				editor.update(() => {
					fileNode.setUploaded(url.url);
				});
			}).catch((error) => {
				logger$2.error("❌ File upload failed:", error);
				editor.update(() => {
					fileNode.setError("File upload failed : " + error.message);
				});
			});
		});
		return false;
	}, COMMAND_PRIORITY_HIGH);
}
//#endregion
//#region src/plugins/upload/service/i-upload-service.ts
const UPLOAD_PRIORITY_LOW = 2;
const UPLOAD_PRIORITY_MEDIUM = 1;
const UPLOAD_PRIORITY_HIGH = 0;
const IUploadService = genServiceId("UploadService");
var UploadService = class {
	constructor() {
		this.uploadHandlers = [
			[],
			[],
			[]
		];
	}
	registerUpload(handler, priority = 2) {
		this.uploadHandlers[priority].push(handler);
	}
	async uploadFile(file, from, range) {
		for (const uploadHandlers of this.uploadHandlers) {
			if (uploadHandlers.length === 0) continue;
			for (const handler of uploadHandlers) {
				const result = await handler(file, from, range);
				if (result) return result;
			}
		}
		throw new Error("No upload handler registered for this file type: " + file.type);
	}
};
//#endregion
//#region src/plugins/upload/utils/index.ts
function getDragSelection(event) {
	if (typeof document === "undefined") return null;
	let range;
	const domSelection = getDOMSelectionFromTarget(event.target);
	if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(event.clientX, event.clientY);
	else if (event.rangeParent && domSelection !== null) {
		domSelection.collapse(event.rangeParent, event.rangeOffset || 0);
		range = domSelection.getRangeAt(0);
	} else throw new Error(`Cannot get the selection when dragging`);
	return range;
}
//#endregion
//#region src/plugins/upload/plugin/index.ts
init_plugin();
init_debug();
const UploadPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "UploadPlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		this.logger = createDebugLogger("plugin", "upload");
		kernel.registerService(IUploadService, new UploadService());
	}
	onInit(editor) {
		this.register(editor.registerCommand(DROP_COMMAND, (event) => {
			const dataTransfer = event.dataTransfer;
			if (dataTransfer && dataTransfer.files.length > 0) {
				event.preventDefault();
				event.stopImmediatePropagation();
				const file = dataTransfer.files[0];
				const uploadService = this.kernel.requireService(IUploadService);
				if (uploadService) uploadService.uploadFile(file, "drop", getDragSelection(event)).catch((error) => {
					this.logger.error("Upload failed:", error);
				});
			}
			return true;
		}, COMMAND_PRIORITY_HIGH));
		this.register(editor.registerCommand(DRAG_DROP_PASTE, (files) => {
			for (const file of files) {
				const uploadService = this.kernel.requireService(IUploadService);
				if (uploadService) uploadService.uploadFile(file, "drag-drop-paste", null).catch((error) => {
					this.logger.error("Upload failed:", error);
				});
			}
			return true;
		}, COMMAND_PRIORITY_HIGH));
	}
};
//#endregion
//#region src/plugins/file/utils/matchFile.ts
function getExtension(filename) {
	const i = filename.lastIndexOf(".");
	if (i < 0 || i === filename.length - 1) return "";
	return filename.slice(i + 1).toLowerCase();
}
function matchMime(fileType, allowed) {
	if (!fileType) return false;
	return allowed.some((rule) => {
		if (rule.endsWith("/")) return fileType.startsWith(rule);
		return fileType === rule;
	});
}
/**
* Whether a dropped/pasted file should be claimed by FilePlugin.
* No allowlist → accept all.
*/
function isAllowedUploadFile(file, options) {
	const mimes = options?.allowedMimeTypes;
	const exts = options?.allowedExtensions;
	if ((!mimes || mimes.length === 0) && (!exts || exts.length === 0)) return true;
	if (mimes && mimes.length > 0 && matchMime(file.type, mimes)) return true;
	if (exts && exts.length > 0) {
		const ext = getExtension(file.name);
		if (ext && exts.some((e) => e.toLowerCase().replace(/^\./, "") === ext)) return true;
	}
	return false;
}
//#endregion
//#region src/plugins/file/utils/index.ts
function registerFileNodeSelectionObserver(editor) {
	const selectFileKeys = [];
	return editor.registerUpdateListener(({ editorState }) => {
		const selection = editorState.read(() => $getSelection());
		const newSelectFileKeys = [];
		if ($isNodeSelection(selection)) editorState.read(() => selection.getNodes()).forEach((node) => {
			if (node.getType() === "file") newSelectFileKeys.push(node.getKey());
		});
		else if ($isRangeSelection(selection) && !selection.isCollapsed()) editorState.read(() => {
			selection.getNodes().forEach((node) => {
				if (node.getType() === "file") newSelectFileKeys.push(node.getKey());
			});
		});
		const removeKeys = selectFileKeys.filter((key) => !newSelectFileKeys.includes(key));
		const addKeys = newSelectFileKeys.filter((key) => !selectFileKeys.includes(key));
		selectFileKeys.length = 0;
		selectFileKeys.push(...newSelectFileKeys);
		removeKeys.forEach((key) => {
			editor.getElementByKey(key)?.classList.remove("selected");
		});
		addKeys.forEach((key) => {
			editor.getElementByKey(key)?.classList.add("selected");
		});
	});
}
//#endregion
//#region src/plugins/file/plugin/index.ts
init_plugin();
init_debug();
const FilePlugin = class extends KernelPlugin {
	static {
		this.pluginName = "FilePlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		this.logger = createDebugLogger("plugin", "file");
		kernel.registerNodes([FileNode]);
		if (config?.theme) kernel.registerThemes(config?.theme);
		this.registerDecorator(kernel, FileNode.getType(), (node, editor) => {
			return config?.decorator ? config.decorator(node, editor) : null;
		});
	}
	onInit(editor) {
		this.kernel.requireService(IUploadService)?.registerUpload(async (file, _from, range) => {
			if (!isAllowedUploadFile(file, this.config)) return false;
			editor.update(() => {
				if (range) {
					const rangeSelection = $createRangeSelection();
					if (range !== null && range !== void 0) rangeSelection.applyDOMRange(range);
					$setSelection(rangeSelection);
				}
				const fileNode = $createFileNode(file.name);
				$insertNodes([fileNode]);
				if ($isRootOrShadowRoot(fileNode.getParentOrThrow())) $wrapNodeInElement(fileNode, $createParagraphNode).selectEnd();
				this.config.handleUpload(file).then((url) => {
					editor.update(() => {
						fileNode.setUploaded(url.url);
					});
				}).catch((error) => {
					this.logger.error("File upload failed:", error);
					editor.update(() => {
						fileNode.setError("File upload failed : " + error.message);
					});
				});
			});
			return true;
		}, 2);
		this.register(registerFileCommand(editor, this.config.handleUpload));
		this.register(registerFileNodeSelectionObserver(editor));
		this.registerMarkdownWriter();
	}
	registerMarkdownWriter() {
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!markdownService) return;
		markdownService.registerMarkdownWriter(FileNode.getType(), (ctx, node) => {
			if ($isFileNode(node)) {
				if (this.config?.markdownWriter) {
					ctx.appendLine(this.config.markdownWriter(node));
					return;
				}
				if (node.status === "pending") ctx.appendLine(`Uploading ${node.name}...`);
				else if (node.status === "error") ctx.appendLine(`Failed to upload ${node.name}: ${node.message}`);
				else ctx.appendLine(`[${node.name}](${node.fileUrl})`);
			}
		});
	}
};
//#endregion
//#region src/plugins/file/react/components/ReactFile.tsx
const ReactFile = ({ className, editor, node }) => {
	const spanRef = useRef(null);
	const t = useTranslation();
	const [, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());
	const onClick = useCallback((payload) => {
		if (payload.target === spanRef.current || spanRef.current?.contains(payload.target)) {
			clearSelection();
			setSelected(true);
			return true;
		}
		return false;
	}, [clearSelection, setSelected]);
	useEffect(() => {
		return editor.registerCommand(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW);
	}, [
		editor,
		node,
		onClick
	]);
	const onDownloadClick = useCallback((e) => {
		e.stopPropagation();
	}, []);
	if (node.status === "pending") return /* @__PURE__ */ jsx("div", {
		className,
		children: t("file.uploading")
	});
	if (node.status === "error") return /* @__PURE__ */ jsx("div", {
		className,
		children: t("file.error", { message: node.message || "Unknown error" })
	});
	const content = /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(MaterialFileTypeIcon, {
		filename: node.name,
		size: 18,
		type: "file",
		variant: "raw"
	}), node.name] });
	if (node.fileUrl) return /* @__PURE__ */ jsx(Center, {
		className,
		gap: ".2em",
		horizontal: true,
		ref: spanRef,
		children: /* @__PURE__ */ jsx("a", {
			download: node.name,
			href: node.fileUrl,
			onClick: onDownloadClick,
			rel: "noopener noreferrer",
			target: "_blank",
			title: t("file.download"),
			children: content
		})
	});
	return /* @__PURE__ */ jsx(Center, {
		className,
		gap: ".2em",
		horizontal: true,
		ref: spanRef,
		children: content
	});
};
ReactFile.displayName = "ReactFile";
//#endregion
//#region src/plugins/file/react/ReactFilePlugin.tsx
const ReactFilePlugin = ({ allowedExtensions, allowedMimeTypes, className, locale, handleUpload, markdownWriter, theme }) => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		if (locale) editor.registerLocale(locale);
		editor.registerPlugin(UploadPlugin);
		editor.registerPlugin(FilePlugin, {
			allowedExtensions,
			allowedMimeTypes,
			decorator: (node, editor) => {
				return /* @__PURE__ */ jsx(ReactFile, {
					className,
					editor,
					node
				});
			},
			handleUpload: async (file) => {
				if (handleUpload) return handleUpload(file);
				throw new Error("No upload handler provided");
			},
			markdownWriter,
			theme: theme || styles$14
		});
	}, [
		allowedExtensions,
		allowedMimeTypes,
		editor
	]);
	return null;
};
ReactFilePlugin.displayName = "ReactFilePlugin";
//#endregion
//#region src/plugins/hr/react/style.ts
const styles$7 = createStaticStyles(({ css, cssVar }) => css`
    cursor: pointer;

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

    &.selected {
      background: ${cssVar.yellow};

      hr {
        border-color: #000;
      }
    }
  `);
//#endregion
//#region src/plugins/hr/react/components/HRNode.tsx
const HRNode = ({ node, className, editor }) => {
	const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(node.getKey());
	useEffect(() => {
		return mergeRegister(editor.registerCommand(CLICK_COMMAND, (event) => {
			const hrElem = editor.getElementByKey(node.getKey());
			if (hrElem?.contains(event.target) || event.target === hrElem) {
				if (!event.shiftKey) clearSelection();
				setSelected(!isSelected);
				return true;
			}
			return false;
		}, COMMAND_PRIORITY_LOW));
	}, [
		clearSelection,
		editor,
		isSelected,
		node,
		setSelected
	]);
	return /* @__PURE__ */ jsx("div", {
		className: cx(styles$7, isSelected && "selected", className),
		children: /* @__PURE__ */ jsx("hr", {})
	});
};
HRNode.displayName = "HRNode";
//#endregion
//#region src/plugins/hr/react/ReactHRPlugin.tsx
const ReactHRPlugin = ({ className }) => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(MarkdownPlugin);
		editor.registerPlugin(HRPlugin, {
			decorator(node, editor) {
				return /* @__PURE__ */ jsx(HRNode, {
					className,
					editor,
					node
				});
			},
			theme: className
		});
	}, []);
	return null;
};
ReactHRPlugin.displayName = "ReactHRPlugin";
//#endregion
//#region src/plugins/image/command/index.ts
init_debug();
const logger$1 = createDebugLogger("plugin", "image");
const INSERT_IMAGE_COMMAND = createCommand("INSERT_IMAGE_COMMAND");
function isImageFile(file) {
	return file.type.startsWith("image/");
}
function registerImageCommand(editor, handleUpload, defaultBlockImage = false) {
	return editor.registerCommand(INSERT_IMAGE_COMMAND, (payload) => {
		const { file, range, block, maxWidth } = payload;
		const isBlock = block ?? defaultBlockImage;
		if (!isImageFile(file)) return false;
		const placeholderURL = URL.createObjectURL(file);
		editor.update(() => {
			if (range) {
				const rangeSelection = $createRangeSelection();
				if (range !== null && range !== void 0) rangeSelection.applyDOMRange(range);
				$setSelection(rangeSelection);
			}
			const imageNode = isBlock ? $createBlockImageNode({
				altText: file.name,
				maxWidth: maxWidth || 800,
				src: placeholderURL,
				status: "loading"
			}) : $createImageNode({
				altText: file.name,
				maxWidth: maxWidth || 800,
				src: placeholderURL,
				status: "loading"
			});
			$insertNodes([imageNode]);
			if (!isBlock && $isRootOrShadowRoot(imageNode.getParentOrThrow())) $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
			else if (isBlock) {
				const emptyPara = $createParagraphNode();
				imageNode.insertAfter(emptyPara);
				emptyPara.selectEnd();
			}
			handleUpload(file).then((res) => {
				editor.update(() => {
					imageNode.setUploaded(res.url);
				});
			}).catch((error) => {
				logger$1.error("❌ Image upload failed:", error);
				editor.update(() => {
					imageNode.setError("Image upload failed : " + error.message);
				});
			});
		});
		return true;
	}, COMMAND_PRIORITY_EDITOR);
}
//#endregion
//#region src/plugins/image/plugin/index.ts
init_helper();
init_plugin();
init_debug();
const ImagePlugin = class extends KernelPlugin {
	static {
		this.pluginName = "ImagePlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		this.logger = createDebugLogger("plugin", "image");
		kernel.registerNodes([ImageNode, BlockImageNode]);
		ImageNode.setDecorate(config.renderImage);
		BlockImageNode.setDecorate(config.renderImage);
		if (config?.theme) kernel.registerThemes(config.theme);
	}
	onInit(editor) {
		this.register(registerImageCommand(editor, this.config.handleUpload, this.config?.defaultBlockImage !== false));
		this.registerMarkdown();
		this.registerINode();
		this.registerUpload(editor);
		this.registerImageUrlPaste(editor);
		if (this.config?.needRehost && this.config?.handleRehost) {
			const needRehost = this.config.needRehost;
			const handleRehost = this.config.handleRehost;
			this.register(editor.registerNodeTransform(ImageNode, (node) => {
				if (node.status === "uploaded" && needRehost(node.src)) {
					node.setStatus("loading");
					handleRehost(node.src).then(({ url }) => {
						editor.update(() => {
							node.setUploaded(url);
						});
					}).catch(() => {
						editor.update(() => {
							node.setError("Rehost failed");
						});
					});
				}
			}));
			this.register(editor.registerNodeTransform(BlockImageNode, (node) => {
				if (node.status === "uploaded" && needRehost(node.src)) {
					node.setStatus("loading");
					handleRehost(node.src).then(({ url }) => {
						editor.update(() => {
							node.setUploaded(url);
						});
					}).catch(() => {
						editor.update(() => {
							node.setError("Rehost failed");
						});
					});
				}
			}));
		}
	}
	registerUpload(editor) {
		const uploadService = this.kernel.requireService(IUploadService);
		if (!uploadService) return;
		uploadService.registerUpload(async (file, from, range) => {
			if (!file.type.startsWith("image/")) return false;
			const imageWidth = await this.getImageWidth(file);
			return editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
				block: this.config?.defaultBlockImage !== false,
				file,
				maxWidth: imageWidth,
				range
			});
		}, 0);
	}
	registerMarkdown() {
		const defaultBlockImage = this.config?.defaultBlockImage !== false;
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!markdownService) return;
		markdownService.registerMarkdownWriter(ImageNode.getType(), (ctx, node) => {
			if ($isImageNode(node)) ctx.appendLine(`![${node.altText}](${node.src})`);
		});
		markdownService.registerMarkdownWriter(BlockImageNode.getType(), (ctx, node) => {
			if ($isBlockImageNode(node)) ctx.appendLine(`![${node.altText}](${node.src})\n\n`);
		});
		markdownService.registerMarkdownReader("image", (node) => {
			const altText = node.alt;
			const src = node.url;
			return INodeHelper.createTypeNode(defaultBlockImage ? BlockImageNode.getType() : ImageNode.getType(), {
				altText,
				showCaption: false,
				src,
				version: 1
			});
		});
		markdownService.registerMarkdownShortCut({
			regExp: /!\[([^\]]*)]\(([^)]*)\)/,
			replace: (node, match) => {
				const [, altText, src] = match;
				const imageNode = defaultBlockImage ? $createBlockImageNode({
					altText,
					src,
					status: "uploaded"
				}) : $createImageNode({
					altText,
					src,
					status: "uploaded"
				});
				if (defaultBlockImage) {
					const parent = node.getParent();
					if (parent && $isRootOrShadowRoot(parent.getParent())) {
						const emptyPara = $createParagraphNode();
						parent.replace(imageNode);
						imageNode.insertAfter(emptyPara);
						emptyPara.selectEnd();
					} else node.replace(imageNode);
				} else {
					node.replace(imageNode);
					if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
				}
			},
			trigger: ")",
			type: "text-match"
		});
	}
	registerINode() {
		const service = this.kernel.requireService(INodeService);
		if (!service) return;
		service.registerProcessNodeTree(({ root }) => {
			const loopNodes = (node) => {
				if ("children" in node && Array.isArray(node.children)) {
					if (node.type === "paragraph" && node.children.length === 1 && node.children[0].type === BlockImageNode.getType()) return node.children[0];
					node.children = node.children.map((child) => {
						return loopNodes(child);
					});
				}
				return node;
			};
			root.children = root.children.map((child) => {
				return loopNodes(child);
			});
		});
	}
	getImageWidth(file) {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.addEventListener("load", (e) => {
				const img = new Image();
				img.addEventListener("load", () => {
					resolve(img.naturalWidth);
				});
				img.addEventListener("error", () => {
					resolve(800);
				});
				img.src = e.target?.result;
			});
			reader.addEventListener("error", () => {
				resolve(800);
			});
			reader.readAsDataURL(file);
		});
	}
	/**
	* Handle pasting image URLs — create ImageNode instead of LinkNode
	*/
	registerImageUrlPaste(editor) {
		this.register(editor.registerCommand(PASTE_COMMAND, (payload) => {
			const { clipboardData } = payload;
			if (clipboardData && clipboardData.types && clipboardData.types.length === 1 && clipboardData.types[0] === "text/plain") {
				const data = clipboardData.getData("text/plain").trim();
				if (/^https?:\/\/\S+\.(?:jpe?g|png|gif|webp|svg|bmp|ico)(?:\?\S*)?$/i.test(data)) {
					payload.stopImmediatePropagation();
					payload.preventDefault();
					this.logger.debug("Pasting image URL:", data);
					editor.update(() => {
						if ($isRangeSelection($getSelection())) {
							const isBlock = this.config?.defaultBlockImage !== false;
							const imageNode = isBlock ? $createBlockImageNode({
								altText: "",
								src: data,
								status: "uploaded"
							}) : $createImageNode({
								altText: "",
								src: data,
								status: "uploaded"
							});
							$insertNodes([imageNode]);
							if (!isBlock && $isRootOrShadowRoot(imageNode.getParentOrThrow())) $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
							else if (isBlock) {
								const emptyPara = $createParagraphNode();
								imageNode.insertAfter(emptyPara);
								emptyPara.selectEnd();
							}
						}
					});
					return true;
				}
			}
			return false;
		}, COMMAND_PRIORITY_NORMAL));
	}
};
//#endregion
//#region src/plugins/image/utils/downloadImage.ts
function guessFilename(src) {
	try {
		const base = new URL(src, window.location.href).pathname.split("/").pop() || "";
		if (base && /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(base)) return decodeURIComponent(base);
	} catch {}
	return `image-${Date.now()}.png`;
}
/**
* Download an image URL. Prefers fetch→blob (works for same-origin / CORS-enabled).
* Falls back to opening the URL when fetch is blocked.
*/
async function downloadImage(src, filename) {
	if (!src) return;
	const name = filename || guessFilename(src);
	try {
		const res = await fetch(src);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const blob = await res.blob();
		const objectUrl = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = objectUrl;
		a.download = name;
		a.rel = "noopener";
		document.body.append(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(objectUrl);
	} catch {
		const a = document.createElement("a");
		a.href = src;
		a.download = name;
		a.target = "_blank";
		a.rel = "noopener noreferrer";
		document.body.append(a);
		a.click();
		a.remove();
	}
}
//#endregion
//#region src/plugins/image/react/components/style.ts
const styles$6 = createStaticStyles(({ css, cssVar }) => ({
	brokenImage: css`
    width: 200px;
    height: auto;
  `,
	downloadButton: css`
    pointer-events: auto;

    position: absolute;
    z-index: 12;
    inset-block-start: 6px;
    inset-inline-end: 6px;

    border-radius: ${cssVar.borderRadiusSM};

    color: white !important;

    background-color: color-mix(in srgb, rgb(0, 0, 0) 55%, transparent) !important;

    &:hover {
      background-color: color-mix(in srgb, rgb(0, 0, 0) 75%, transparent) !important;
    }
  `,
	imageContainer: css`
    cursor: default;
    user-select: none;

    position: relative;

    overflow: hidden;
    display: inline-block;

    width: auto;
    max-width: 100%;
    height: auto;
    border-radius: ${cssVar.borderRadiusSM};

    transition: border-color 0.2s ease;

    &.selected {
      cursor: pointer;
      outline: none;

      &::after {
        pointer-events: none;
        content: '';

        position: absolute;
        z-index: 10;
        inset: 0;

        background-color: color-mix(in srgb, ${cssVar.yellow} 10%, transparent);
      }
    }

    &.loading {
      &::after {
        pointer-events: none;
        content: '';

        position: absolute;
        z-index: 10;
        inset: 0;

        background-color: color-mix(in srgb, ${cssVar.colorBgContainer} 40%, transparent);

        animation: image-loading-pulse 1.5s ease-in-out infinite;
      }

      @keyframes image-loading-pulse {
        0%,
        100% {
          opacity: 1;
        }

        50% {
          opacity: 0.4;
        }
      }
    }
  `,
	lazyImage: css`
    cursor: default;
  `,
	loadingIcon: css`
    pointer-events: none;

    position: absolute;
    z-index: 11;
    inset: 0;

    display: flex;
    align-items: center;
    justify-content: center;

    color: ${cssVar.colorTextSecondary};
  `,
	resizeHandle: css`
    pointer-events: auto;
    cursor: col-resize;

    position: absolute;
    z-index: 9999;
    inset-block-start: 0;

    width: 6px;
    height: 100%;

    &::after {
      pointer-events: none;
      content: '';

      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 0;
      transform: translateY(-50%);

      width: 6px;
      height: min(80px, 80%);
      border: 1px solid color-mix(in srgb, rgb(255, 255, 255) 75%, transparent);
      border-radius: 3px;

      background-color: color-mix(in srgb, rgb(0, 0, 0) 50%, transparent);
    }
  `,
	resizeHandleLeft: css`
    inset-inline-start: 8px;
  `,
	resizeHandleRight: css`
    inset-inline-end: 8px;
  `,
	scaleInfo: css`
    pointer-events: none;

    position: absolute;
    z-index: 11;
    inset-block-start: 2px;
    inset-inline-start: 2px;

    padding-block: 2px;
    padding-inline: 6px;
    border-radius: ${cssVar.borderRadiusSM};

    font-size: 12px;
    color: white;

    background-color: color-mix(in srgb, rgb(0, 0, 0) 50%, transparent);
  `
}));
//#endregion
//#region src/plugins/image/react/components/BrokenImage.tsx
const BrokenImage = () => {
	return /* @__PURE__ */ jsx("img", {
		alt: useTranslation()("image.broken"),
		className: styles$6.brokenImage,
		draggable: "false",
		src: imageBroken
	});
};
BrokenImage.displayName = "BrokenImage";
//#endregion
//#region src/editor-kernel/react/useEditable.ts
const useEditable = () => {
	const [editor] = useLexicalComposerContext();
	const [editable, setEditable] = useState(editor.isEditable());
	useEffect(() => {
		const updateEditable = (newEditable) => {
			setEditable(newEditable);
		};
		const handleInitialized = () => {
			setEditable(editor.isEditable());
		};
		editor.on("editableChange", updateEditable);
		editor.on("initialized", handleInitialized);
		return () => {
			editor.off("editableChange", updateEditable);
			editor.off("initialized", handleInitialized);
		};
	}, [editor]);
	return { editable };
};
//#endregion
//#region src/plugins/image/react/components/ImageEditPopover.tsx
const ImageEditPopover = memo(({ children, node, handleUpload, onPickFile }) => {
	const [open, setOpen] = useState(false);
	const [url, setUrl] = useState("");
	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef(null);
	const editorRef = useRef(null);
	const { editable } = useEditable();
	const t = useTranslation();
	useLexicalEditor((editor) => {
		editorRef.current = editor;
		return () => {
			editorRef.current = null;
		};
	}, []);
	const handleOpenChange = useCallback((nextOpen) => {
		if (nextOpen && node.status !== "uploaded") return;
		if (nextOpen) setUrl(node.src);
		setOpen(nextOpen);
	}, [node]);
	const handleClose = useCallback(() => {
		setOpen(false);
	}, []);
	const handleUrlSubmit = useCallback(() => {
		const editor = editorRef.current;
		if (!editor || !url.trim()) return;
		const trimmedUrl = url.trim();
		handleClose();
		editor.update(() => {
			node.setUploaded(trimmedUrl);
		});
	}, [
		node,
		url,
		handleClose
	]);
	const handleFileChange = useCallback(async (e) => {
		const file = e.target.files?.[0];
		if (!file || !handleUpload) return;
		handleClose();
		setUploading(true);
		try {
			const editor = editorRef.current;
			if (!editor) return;
			editor.update(() => {
				node.setStatus("loading");
			});
			const result = await handleUpload(file);
			editor.update(() => {
				node.setUploaded(result.url);
			});
		} catch {
			const editor = editorRef.current;
			if (editor) editor.update(() => {
				node.setError("Upload failed");
			});
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	}, [
		node,
		handleUpload,
		handleClose
	]);
	const handlePickFile = useCallback(async () => {
		if (onPickFile) {
			const file = await onPickFile();
			if (file && handleUpload) {
				handleClose();
				setUploading(true);
				try {
					const editor = editorRef.current;
					if (!editor) return;
					editor.update(() => {
						node.setStatus("loading");
					});
					const result = await handleUpload(file);
					editor.update(() => {
						node.setUploaded(result.url);
					});
				} catch {
					const editor = editorRef.current;
					if (editor) editor.update(() => {
						node.setError("Upload failed");
					});
				} finally {
					setUploading(false);
				}
			}
		} else fileInputRef.current?.click();
	}, [
		onPickFile,
		handleUpload,
		handleClose,
		node
	]);
	const handleDownload = useCallback(() => {
		if (!node.src) return;
		downloadImage(node.src);
	}, [node]);
	return /* @__PURE__ */ jsx(Popover, {
		arrow: false,
		content: /* @__PURE__ */ jsxs(Flexbox, {
			gap: 8,
			style: { width: 320 },
			children: [/* @__PURE__ */ jsx(Input, {
				onChange: (e) => setUrl(e.target.value),
				onKeyDown: (e) => {
					if (e.key === "Enter") handleUrlSubmit();
					if (e.key === "Escape") handleClose();
				},
				placeholder: "https://...",
				prefix: /* @__PURE__ */ jsx(Icon, {
					color: cssVar.colorTextDescription,
					icon: LinkIcon
				}),
				value: url
			}), /* @__PURE__ */ jsxs(Flexbox, {
				gap: 8,
				horizontal: true,
				justify: "flex-end",
				children: [
					/* @__PURE__ */ jsx(Button, {
						icon: /* @__PURE__ */ jsx(Icon, { icon: DownloadIcon }),
						onClick: handleDownload,
						size: "small",
						type: "text",
						children: t("image.download")
					}),
					handleUpload && /* @__PURE__ */ jsxs(Fragment, { children: [!onPickFile && /* @__PURE__ */ jsx("input", {
						accept: "image/*",
						onChange: handleFileChange,
						ref: fileInputRef,
						style: { display: "none" },
						type: "file"
					}), /* @__PURE__ */ jsx(Button, {
						icon: /* @__PURE__ */ jsx(Icon, { icon: UploadIcon }),
						loading: uploading,
						onClick: handlePickFile,
						size: "small",
						type: "text",
						children: t("image.replace")
					})] }),
					/* @__PURE__ */ jsx(Button, {
						onClick: handleUrlSubmit,
						size: "small",
						type: "text",
						variant: "filled",
						children: t("confirm")
					})
				]
			})]
		}),
		disabled: !editable || node.status !== "uploaded",
		onOpenChange: handleOpenChange,
		open,
		placement: "bottom",
		styles: { content: { padding: 12 } },
		trigger: "click",
		children
	});
});
ImageEditPopover.displayName = "ImageEditPopover";
//#endregion
//#region src/plugins/image/react/components/useSupenseImage.ts
const imageCache = /* @__PURE__ */ new Map();
const useSuspenseImage = (src) => {
	let cached = imageCache.get(src);
	if (typeof cached === "boolean") return cached;
	else if (!cached) {
		cached = new Promise((resolve) => {
			const img = new Image();
			img.src = src;
			img.addEventListener("load", () => resolve(false));
			img.addEventListener("error", () => resolve(true));
		}).then((hasError) => {
			imageCache.set(src, hasError);
			return hasError;
		});
		imageCache.set(src, cached);
		throw cached;
	}
	throw cached;
};
//#endregion
//#region src/plugins/image/react/components/LazyImage.tsx
function isSVG(src) {
	return src.toLowerCase().endsWith(".svg");
}
const LazyImage = ({ className, enableImagePreview = true, node, newWidth, onError, onLoad, onPreviewOpen }) => {
	const { src, altText, maxWidth, width } = node;
	const [dimensions, setDimensions] = useState(null);
	const isSVGImage = isSVG(src);
	const hasError = useSuspenseImage(src);
	useEffect(() => {
		if (hasError && onError) onError();
	}, [hasError, onError]);
	if (hasError) return /* @__PURE__ */ jsx(BrokenImage, {});
	const calculateDimensions = () => {
		if (!isSVGImage) return {
			maxWidth,
			width
		};
		const naturalWidth = dimensions?.width || 200;
		const naturalHeight = dimensions?.height || 200;
		let finalWidth = naturalWidth;
		let finalHeight = naturalHeight;
		if (finalWidth > maxWidth) {
			const scale = maxWidth / finalWidth;
			finalWidth = maxWidth;
			finalHeight = Math.round(finalHeight * scale);
		}
		const maxHeight = 500;
		if (finalHeight > maxHeight) {
			const scale = maxHeight / finalHeight;
			finalHeight = maxHeight;
			finalWidth = Math.round(finalWidth * scale);
		}
		return {
			maxWidth,
			width: finalWidth
		};
	};
	const imageStyle = calculateDimensions();
	const mergedStyle = {
		...imageStyle,
		maxWidth: `calc(min(${newWidth || imageStyle.maxWidth}px, 100%))`,
		width: newWidth || imageStyle.width,
		...enableImagePreview ? { cursor: "zoom-in" } : {}
	};
	return /* @__PURE__ */ jsx(Image$1, {
		alt: altText,
		classNames: { image: cx(styles$6.lazyImage, className || void 0) },
		draggable: false,
		onError,
		onLoad: (e) => {
			const img = e.currentTarget;
			const w = Math.min(img.naturalWidth, img.getBoundingClientRect().width);
			if (isSVGImage) setDimensions({
				height: img.naturalHeight,
				width: w
			});
			onLoad?.({
				height: img.naturalHeight,
				width: w
			});
		},
		preview: enableImagePreview ? { onOpenChange: (open) => {
			if (open) onPreviewOpen?.();
		} } : false,
		src,
		styles: { image: mergedStyle }
	});
};
LazyImage.displayName = "LazyImage";
//#endregion
//#region src/plugins/image/react/components/ResizeHandle.tsx
const ResizeHandle = ({ imageRef, isBlock, onResize, onResizeEnd, onResizeStart, position }) => {
	const startWidthRef = useRef(0);
	const handleMouseDown = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		const initialWidth = imageRef.current?.offsetWidth || 0;
		startWidthRef.current = initialWidth;
		onResizeStart(initialWidth);
		const startX = e.clientX;
		const startY = e.clientY;
		const rect = isBlock ? e.target.getBoundingClientRect() : {
			height: 0,
			left: 0,
			top: 0,
			width: 0
		};
		const centerX = rect.left + rect.width / 2;
		let lastDeltaX = 0;
		let lastDeltaY = 0;
		const handleMouseMove = (e) => {
			let deltaX = e.clientX - startX;
			const deltaY = e.clientY - startY;
			switch (position) {
				case "left":
					deltaX = isBlock ? centerX - e.clientX : -deltaX;
					break;
				case "right":
					if (isBlock) deltaX = e.clientX - centerX;
					break;
			}
			lastDeltaX = deltaX;
			lastDeltaY = deltaY;
			onResize(deltaX, deltaY, position);
		};
		const handleMouseUp = () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
			if (typeof onResizeEnd === "function") onResizeEnd(lastDeltaX, lastDeltaY);
		};
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	}, [
		imageRef,
		isBlock,
		onResize,
		onResizeEnd,
		onResizeStart,
		position
	]);
	return /* @__PURE__ */ jsx("div", {
		className: cx(styles$6.resizeHandle, position === "left" ? styles$6.resizeHandleLeft : styles$6.resizeHandleRight),
		onMouseDown: handleMouseDown
	});
};
ResizeHandle.displayName = "ResizeHandle";
//#endregion
//#region src/plugins/image/react/components/Image.tsx
const Image$2 = memo(({ node, className, enableImagePreview = true, showScaleInfo = false, handleUpload, onPickFile }) => {
	const [isSelected, setSelected] = useLexicalNodeSelection(node.getKey());
	const [isHovered, setIsHovered] = useState(false);
	const [isResizing, setIsResizing] = useState(false);
	const [scale, setScale] = useState(1);
	const [size, setSize] = useState({
		height: 0,
		width: 0
	});
	const [newWidth, setNewWidth] = useState(null);
	const imageRef = useRef(null);
	const originalSizeRef = useRef({
		height: 0,
		width: 0
	});
	const editorRef = useRef(null);
	const startWidthRef = useRef(0);
	const lastLoadedSrcRef = useRef(null);
	const t = useTranslation();
	const isBlock = useMemo(() => {
		return $isBlockImageNode(node);
	}, [node]);
	const handleDownload = useCallback((e) => {
		e.stopPropagation();
		e.preventDefault();
		if (!node.src) return;
		downloadImage(node.src);
	}, [node]);
	useLexicalEditor((editor) => {
		editorRef.current = editor;
		const unregister = editor.registerCommand(SELECTION_CHANGE_COMMAND, (_, _activeEditor) => {
			return false;
		}, COMMAND_PRIORITY_LOW);
		return () => {
			editorRef.current = null;
			unregister();
		};
	}, []);
	const handleResize = useCallback((deltaX) => {
		if (!originalSizeRef.current.width || !originalSizeRef.current.height) return;
		if (!imageRef.current) return;
		const aspectRatio = originalSizeRef.current.width / originalSizeRef.current.height;
		const maxWidth = imageRef.current.parentElement?.clientWidth || window.innerWidth;
		const adjustedDeltaX = deltaX * 2;
		const newWidth = Math.max(50, Math.min(startWidthRef.current + adjustedDeltaX, maxWidth));
		setSize({
			height: newWidth / aspectRatio,
			width: newWidth
		});
		setNewWidth(newWidth);
		setScale(newWidth / originalSizeRef.current.width);
	}, []);
	const handleResizeStart = useCallback((initialWidth) => {
		setIsResizing(true);
		startWidthRef.current = initialWidth;
	}, []);
	const handleClick = useCallback((e) => {
		e.stopPropagation();
		setSelected(true);
	}, [setSelected]);
	const handleDoubleClick = useCallback((e) => {
		const editor = editorRef.current;
		if (!editor) return;
		e.stopPropagation();
		e.preventDefault();
		const orig = originalSizeRef.current;
		if (!orig.width || !orig.height) return;
		setSize(orig);
		setScale(1);
		setNewWidth(orig.width);
		editor.update(() => {
			try {
				node.setWidth(orig.width);
				node.setMaxWidth(orig.width);
			} catch {}
		});
	}, []);
	const handleMouseEnter = useCallback(() => {
		setIsHovered(true);
	}, []);
	const handleMouseLeave = useCallback(() => {
		if (isResizing) return;
		setIsHovered(false);
	}, [isResizing]);
	const children = useMemo(() => {
		switch (node.status) {
			case "error": return /* @__PURE__ */ jsx(BrokenImage, {});
			case "uploaded":
			case "loading": return /* @__PURE__ */ jsx(Suspense, {
				fallback: lastLoadedSrcRef.current ? /* @__PURE__ */ jsx("img", {
					alt: node.altText,
					className: cx(styles$6.lazyImage, className || void 0),
					draggable: "false",
					src: lastLoadedSrcRef.current,
					style: { width: "100%" }
				}) : null,
				children: /* @__PURE__ */ jsx(LazyImage, {
					className,
					enableImagePreview,
					newWidth,
					node,
					onLoad: (loadedSize) => {
						lastLoadedSrcRef.current = node.src;
						originalSizeRef.current.width = loadedSize.width;
						originalSizeRef.current.height = loadedSize.height;
						setSize(loadedSize);
					},
					onPreviewOpen: () => setSelected(true)
				})
			});
			default: return null;
		}
	}, [
		node.status,
		className,
		node,
		newWidth,
		enableImagePreview
	]);
	const handleResizeEnd = useCallback((deltaX) => {
		setIsResizing(false);
		if (!originalSizeRef.current.width || !originalSizeRef.current.height) return;
		if (!imageRef.current) return;
		const maxWidth = imageRef.current.parentElement?.clientWidth || window.innerWidth;
		const adjustedDeltaX = deltaX * 2;
		const finalWidth = Math.max(50, Math.min(startWidthRef.current + adjustedDeltaX, maxWidth));
		setSize((prev) => ({
			height: finalWidth / (originalSizeRef.current.width / originalSizeRef.current.height),
			width: finalWidth
		}));
		setNewWidth(finalWidth);
		setScale(finalWidth / originalSizeRef.current.width);
		const editor = editorRef.current;
		if (!editor) return;
		editor.update(() => {
			try {
				node.setWidth(finalWidth);
				node.setMaxWidth(finalWidth);
			} catch {}
		});
	}, [node]);
	return /* @__PURE__ */ jsx(ImageEditPopover, {
		handleUpload,
		node,
		onPickFile,
		children: /* @__PURE__ */ jsxs("div", {
			className: cx(styles$6.imageContainer, {
				loading: node.status === "loading",
				selected: isSelected
			}),
			draggable: false,
			onClick: handleClick,
			onDoubleClick: handleDoubleClick,
			onMouseEnter: handleMouseEnter,
			onMouseLeave: handleMouseLeave,
			ref: imageRef,
			style: { width: size.width || "auto" },
			children: [
				children,
				node.status === "loading" && /* @__PURE__ */ jsx("div", {
					className: styles$6.loadingIcon,
					children: /* @__PURE__ */ jsx(Icon, {
						icon: LoaderCircleIcon,
						size: 24,
						spin: true
					})
				}),
				showScaleInfo && isSelected && scale !== 1 && /* @__PURE__ */ jsxs("div", {
					className: styles$6.scaleInfo,
					children: [Math.round(scale * 100), "%"]
				}),
				isSelected && node.status === "uploaded" && node.src && /* @__PURE__ */ jsx(ActionIcon, {
					className: styles$6.downloadButton,
					icon: DownloadIcon,
					onClick: handleDownload,
					size: "small",
					title: t("image.download")
				}),
				(isHovered || isSelected || isResizing) && node.status === "uploaded" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(ResizeHandle, {
					imageRef,
					isBlock,
					onResize: handleResize,
					onResizeEnd: handleResizeEnd,
					onResizeStart: handleResizeStart,
					position: "left"
				}), /* @__PURE__ */ jsx(ResizeHandle, {
					imageRef,
					isBlock,
					onResize: handleResize,
					onResizeEnd: handleResizeEnd,
					onResizeStart: handleResizeStart,
					position: "right"
				})] })
			]
		})
	});
});
Image$2.displayName = "Image";
//#endregion
//#region src/plugins/image/react/ReactImagePlugin.tsx
const defaultUpload = (file) => {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve({ url: URL.createObjectURL(file) });
		}, 1e3);
	});
};
const ReactImagePlugin = ({ theme, className, enableImagePreview = true, defaultBlockImage, handleUpload, needRehost, handleRehost, onPickFile }) => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(UploadPlugin);
		editor.registerPlugin(ImagePlugin, {
			defaultBlockImage,
			handleRehost,
			handleUpload: handleUpload || defaultUpload,
			needRehost,
			renderImage: (node) => {
				return /* @__PURE__ */ jsx(Image$2, {
					className,
					enableImagePreview,
					handleUpload: handleUpload || defaultUpload,
					node,
					onPickFile
				});
			},
			theme: theme || styles$15
		});
	}, []);
	return null;
};
ReactImagePlugin.displayName = "ReactImagePlugin";
//#endregion
//#region src/plugins/link/command/index.ts
const INSERT_LINK_COMMAND = createCommand("INSERT_LINK_COMMAND");
const UPDATE_LINK_TEXT_COMMAND = createCommand("UPDATE_LINK_TEXT_COMMAND");
function registerLinkCommand(editor) {
	return mergeRegister(editor.registerCommand(INSERT_LINK_COMMAND, (payload) => {
		const { url, title = url } = payload;
		editor.update(() => {
			const linkNode = $createLinkNode(url, { title });
			const textNode = $createTextNode(title);
			linkNode.append(textNode);
			$insertNodes([linkNode]);
		});
		return false;
	}, COMMAND_PRIORITY_EDITOR), editor.registerCommand(UPDATE_LINK_TEXT_COMMAND, (payload) => {
		const { key, text } = payload;
		editor.update(() => {
			const linkNode = $getNodeByKey(key);
			if (linkNode) {
				const newLinkNode = $createLinkNode(linkNode.getURL(), { title: text });
				const textNode = $createTextNode(text);
				newLinkNode.append(textNode);
				linkNode?.replace(newLinkNode);
				newLinkNode.select(1);
			}
		});
		return false;
	}, COMMAND_PRIORITY_EDITOR));
}
//#endregion
//#region src/plugins/link/service/i-link-service.ts
const ILinkService = genServiceId("LinkService");
var LinkService = class extends EventEmitter {
	constructor(..._args) {
		super(..._args);
		this._enableLinkToolbar = true;
	}
	get enableLinkToolbar() {
		return this._enableLinkToolbar;
	}
	setLinkToolbar(enable) {
		this._enableLinkToolbar = enable;
		this.emit("linkToolbarChange", enable);
	}
};
//#endregion
//#region src/plugins/link/plugin/paste-autolink.ts
const BARE_HTTP_URL = /^https?:\/\/\S+$/i;
function normalizePasteText(raw) {
	return raw.replaceAll(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
}
/**
* When clipboard is plain text that is a single http(s) URL (e.g. browser address bar),
* insert a LinkNode instead of leaving bare text.
*/
function registerPasteAutoLink(editor, options) {
	const linkRegex = options?.linkRegex ?? BARE_HTTP_URL;
	return editor.registerCommand(PASTE_COMMAND, (event) => {
		if (!event || typeof event !== "object" || !("clipboardData" in event)) return false;
		const clipboardEvent = event;
		if (isPasteTargetNativeFormControl(clipboardEvent)) return false;
		if (isPasteTargetCodeEditor(clipboardEvent)) return false;
		const clipboardData = clipboardEvent.clipboardData;
		if (!clipboardData) return false;
		const html = clipboardData.getData("text/html");
		if (html && /<a\s[^>]*href\s*=/i.test(html)) return false;
		const text = normalizePasteText(clipboardData.getData("text/plain") || "");
		if (!text || !linkRegex.test(text)) return false;
		if (options?.validateUrl && !options.validateUrl(text)) return false;
		if (editor.getEditorState().read(() => $isSelectionInCodeContext())) return false;
		clipboardEvent.preventDefault();
		editor.update(() => {
			if (!$isRangeSelection($getSelection())) return;
			const linkNode = $createLinkNode(text, options?.attributes);
			linkNode.append($createTextNode(text));
			$insertNodes([linkNode]);
		});
		return true;
	}, COMMAND_PRIORITY_HIGH);
}
//#endregion
//#region src/plugins/link/plugin/registry.ts
init_hotkey();
function registerLinkCommands(editor, kernel, options) {
	const { validateUrl, attributes, enableHotkey = true } = options || {};
	const state = { isLink: false };
	const registrations = [editor.registerUpdateListener(() => {
		const selection = editor.getEditorState().read(() => $getSelection());
		if (!selection) return;
		if ($isRangeSelection(selection)) editor.getEditorState().read(() => {
			const node = getSelectedNode(selection);
			state.isLink = $isLinkNode(node.getParent()) || $isLinkNode(node);
		});
		else state.isLink = false;
	}), editor.registerCommand(TOGGLE_LINK_COMMAND, (payload) => {
		if (payload === null) {
			$toggleLink(payload);
			return true;
		} else if (typeof payload === "string") {
			if (validateUrl === void 0 || validateUrl(payload)) {
				$toggleLink(payload, attributes);
				return true;
			}
			return false;
		} else {
			const { url, target, rel, title } = payload;
			$toggleLink(url, {
				...attributes,
				rel,
				target,
				title
			});
			return true;
		}
	}, COMMAND_PRIORITY_LOW)];
	registrations.push(kernel.registerHotkey(HotkeyEnum.Link, () => {
		if (state.isLink) {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
			return;
		}
		let nextUrl = sanitizeUrl("https://");
		let expandTo = null;
		editor.getEditorState().read(() => {
			const selection = $getSelection();
			if ($isRangeSelection(selection)) if (!selection.isCollapsed()) {
				const maybeUrl = formatUrl(selection.getTextContent().trim());
				if (validateUrl?.(maybeUrl)) nextUrl = maybeUrl;
			} else {
				const found = extractUrlFromText(selection.anchor.getNode().getTextContent());
				if (found && validateUrl?.(formatUrl(found.url))) {
					nextUrl = formatUrl(found.url);
					expandTo = {
						index: found.index,
						length: found.length
					};
				}
			}
		});
		editor.update(() => {
			if (expandTo) {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) {
					const anchorNode = selection.anchor.getNode();
					selection.anchor.set(anchorNode.getKey(), expandTo.index, "text");
					selection.focus.set(anchorNode.getKey(), expandTo.index + expandTo.length, "text");
				}
			}
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, nextUrl);
		});
	}, {
		enabled: enableHotkey,
		preventDefault: true,
		stopPropagation: true
	}));
	return mergeRegister(...registrations);
}
//#endregion
//#region src/plugins/link/plugin/index.ts
init_helper();
init_plugin();
const LinkPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "LinkPlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		this.linkRegex = /^https?:\/\/\S+$/;
		this.service = new LinkService();
		kernel.registerNodes([LinkNode, AutoLinkNode]);
		kernel.registerService(ILinkService, this.service);
		if (config?.theme) kernel.registerThemes(config.theme);
		if (config?.linkRegex) this.linkRegex = config.linkRegex;
	}
	onInit(editor) {
		this.register(registerLinkCommand(editor));
		this.register(registerLinkCommands(editor, this.kernel, {
			attributes: this.config?.attributes,
			enableHotkey: this.config?.enableHotkey,
			validateUrl: this.config?.validateUrl
		}));
		this.register(registerPasteAutoLink(editor, {
			attributes: this.config?.attributes,
			linkRegex: this.linkRegex,
			validateUrl: this.config?.validateUrl
		}));
		this.registerMarkdown();
	}
	registerMarkdown() {
		this.kernel.requireService(IMarkdownShortCutService)?.registerMarkdownShortCut({
			regExp: /(?<!!)\[([^[]*)]\(([^\s()]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?\)\s?$/,
			replace: (textNode, match) => {
				const [, linkText, linkUrl, linkTitle] = match;
				const linkNode = $createLinkNode(linkUrl, { title: linkTitle });
				const linkTextNode = $createTextNode(linkText || linkUrl);
				linkTextNode.setFormat(textNode.getFormat());
				linkNode.append(linkTextNode);
				textNode.replace(linkNode);
				return linkTextNode;
			},
			trigger: ")",
			type: "text-match"
		});
		this.kernel.requireService(IMarkdownShortCutService)?.registerMarkdownWriter(LinkNode.getType(), (ctx, node) => {
			if ($isLinkNode(node)) ctx.wrap("[", `](${node.getURL()})`);
		});
		this.kernel.requireService(IMarkdownShortCutService)?.registerMarkdownReader("link", (node, children) => {
			return [INodeHelper.createElementNode("link", {
				children,
				direction: "ltr",
				format: "",
				indent: 0,
				title: node.title || void 0,
				type: "link",
				url: node.url || "",
				version: 1
			})];
		});
	}
};
//#endregion
//#region src/editor-kernel/react/useAnchor.ts
const useAnchor = () => {
	const [editor] = useLexicalComposerContext();
	return useMemo(() => {
		if (typeof document === "undefined" || !editor) return;
		const root = editor.getRootElement();
		const anchor = root ? root.parentElement : null;
		if (anchor) return anchor;
		return document.querySelector(`#${LOBE_THEME_APP_ID}`) || document.body;
	}, [editor]);
};
//#endregion
//#region src/editor-kernel/react/PortalAnchor.tsx
const PortalAnchor = ({ children }) => {
	const targetElement = useAnchor();
	if (!targetElement) return null;
	return createPortal(children, targetElement);
};
PortalAnchor.displayName = "PortalAnchor";
//#endregion
//#region src/utils/updatePosition.ts
const updatePosition = ({ floating, placement = "bottom-start", reference, offset: offsetNumber = 8, callback }) => {
	if (!reference || !floating) return;
	return computePosition(reference, floating, {
		middleware: [
			offset(offsetNumber),
			flip(),
			shift()
		],
		placement
	}).then((props) => {
		if (!floating) return false;
		const { x, y } = props;
		floating.style.left = `${x}px`;
		floating.style.top = `${y}px`;
		callback?.(props);
	});
};
const cleanPosition = (floating) => {
	if (!floating) return false;
	floating.style.left = "-9999px";
	floating.style.top = "-9999px";
};
//#endregion
//#region src/plugins/link/react/style.ts
const styles$5 = createStaticStyles(({ css, cssVar }) => {
	const position = css`
    position: absolute;
    z-index: 999;
    inset-block-start: -9999px;
    inset-inline-start: -9999px;
  `;
	return {
		link: css`
      cursor: pointer;

      margin-block: 1em;
      margin-inline: 0;
      padding: 2px;
      border: none;
    `,
		linkEdit: cx(position, css`
        min-width: 320px;
        max-width: 100%;
        background: ${cssVar.colorBgElevated};
      `),
		linkEditFooter: css`
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
      background: ${cssVar.colorFillQuaternary};
    `,
		linkToolbar: cx(position, css`
        background: ${cssVar.colorBgElevated};
      `)
	};
});
//#endregion
//#region src/plugins/link/react/components/LinkEdit.tsx
const LinkEdit = ({ editor }) => {
	const divRef = useRef(null);
	const linkNodeRef = useRef(null);
	const linkInputRef = useRef(null);
	const linkTextInputRef = useRef(null);
	const [linkUrl, setLinkUrl] = useState("");
	const [linkText, setLinkText] = useState("");
	const [linkDom, setLinkDom] = useState(null);
	const linkDomRef = useRef(null);
	const { editable } = useEditable();
	const t = useTranslation();
	const handleCancel = useCallback(() => {
		if (!editor) return;
		editor.focus();
		cleanPosition(divRef.current);
		linkNodeRef.current = null;
		linkDomRef.current = null;
		setLinkUrl("");
		setLinkText("");
		setLinkDom(null);
	}, [editor]);
	const handleSubmit = useCallback(() => {
		if (!linkNodeRef.current || !linkInputRef.current || !linkTextInputRef.current || !editor) return;
		const linkNode = linkNodeRef.current;
		const inputDOM = linkInputRef.current.input;
		const textInputDOM = linkTextInputRef.current.input;
		if (editor.getEditorState().read(() => linkNode.getURL()) !== inputDOM.value) editor.update(() => {
			linkNode.setURL(inputDOM.value);
		});
		if (editor.getEditorState().read(() => linkNode.getTextContent()) !== textInputDOM.value) editor.dispatchCommand(UPDATE_LINK_TEXT_COMMAND, {
			key: linkNode.getKey(),
			text: textInputDOM.value
		});
		editor.focus();
		handleCancel();
	}, [
		editor,
		linkNodeRef,
		linkInputRef,
		linkTextInputRef,
		handleCancel
	]);
	const handleKeyDown = useCallback((event) => {
		if (!linkNodeRef.current || !linkInputRef.current || !linkTextInputRef.current || !editor) return;
		const linkNode = linkNodeRef.current;
		const inputDOM = linkInputRef.current.input;
		const textInputDOM = linkTextInputRef.current.input;
		switch (event.key) {
			case "Enter":
				event.preventDefault();
				if (event.currentTarget === textInputDOM) if (editor.getEditorState().read(() => linkNode.getTextContent()) !== textInputDOM.value) {
					editor.dispatchCommand(UPDATE_LINK_TEXT_COMMAND, {
						key: linkNode.getKey(),
						text: textInputDOM.value
					});
					inputDOM.focus();
				} else inputDOM.focus();
				else if (event.currentTarget === inputDOM) handleSubmit();
				return;
			case "Tab":
				event.preventDefault();
				if (event.currentTarget === textInputDOM) inputDOM.focus();
				else editor.focus();
				return;
			case "Escape":
				event.preventDefault();
				handleCancel();
				return;
		}
	}, [
		linkNodeRef,
		linkInputRef,
		handleSubmit,
		handleCancel
	]);
	useEffect(() => {
		if (linkDom) updatePosition({
			floating: divRef.current,
			reference: linkDom
		});
		else cleanPosition(divRef.current);
	}, [linkDom]);
	useEffect(() => {
		const handlePointerDown = (event) => {
			if (!divRef.current) return;
			const target = event.target;
			if (!target) return;
			if (divRef.current.contains(target)) return;
			if (linkDom) handleCancel();
		};
		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("touchstart", handlePointerDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("touchstart", handlePointerDown);
		};
	}, [linkDom]);
	useLexicalEditor((editor) => {
		return mergeRegister(editor.registerCommand(EDIT_LINK_COMMAND, (payload) => {
			if (!payload.linkNode || !payload.linkNodeDOM) {
				handleCancel();
				return false;
			}
			if (linkNodeRef.current?.getKey() === payload.linkNode.getKey() && linkDomRef.current === payload.linkNodeDOM) return true;
			linkNodeRef.current = payload.linkNode;
			linkDomRef.current = payload.linkNodeDOM;
			setLinkUrl(payload.linkNode.getURL());
			setLinkText(payload.linkNode.getTextContent());
			setLinkDom(payload.linkNodeDOM);
			return true;
		}, COMMAND_PRIORITY_EDITOR), editor.registerCommand(KEY_ESCAPE_COMMAND, () => {
			handleCancel();
			return true;
		}, COMMAND_PRIORITY_EDITOR), editor.registerCommand(KEY_TAB_COMMAND, (payload) => {
			if (linkNodeRef.current && linkTextInputRef.current) {
				payload.stopImmediatePropagation();
				payload.preventDefault();
				linkTextInputRef.current.focus();
				return true;
			}
			return false;
		}, COMMAND_PRIORITY_NORMAL));
	}, [editor, handleCancel]);
	if (!linkNodeRef.current || !editable) return null;
	return /* @__PURE__ */ jsxs(Block, {
		className: styles$5.linkEdit,
		ref: divRef,
		shadow: true,
		variant: "outlined",
		children: [/* @__PURE__ */ jsxs(Flexbox, {
			gap: 8,
			padding: 12,
			children: [
				/* @__PURE__ */ jsx(Text, {
					weight: 500,
					children: t("link.editTextTitle")
				}),
				/* @__PURE__ */ jsx(Input, {
					onChange: (e) => {
						setLinkText(e.target.value);
					},
					onKeyDown: handleKeyDown,
					prefix: /* @__PURE__ */ jsx(Icon, {
						color: cssVar.colorTextDescription,
						icon: BaselineIcon
					}),
					ref: linkTextInputRef,
					suffix: /* @__PURE__ */ jsx(CopyButton, {
						content: linkText,
						onClick: () => {
							if (linkText) message.success(t("link.copyTextSuccess"));
						},
						size: "small",
						title: t("link.copyText")
					}),
					value: linkText
				}),
				/* @__PURE__ */ jsx(Text, {
					weight: 500,
					children: t("link.editLinkTitle")
				}),
				/* @__PURE__ */ jsx(Input, {
					onChange: (e) => {
						setLinkUrl(e.target.value);
					},
					onKeyDown: handleKeyDown,
					placeholder: "https://enter-link-url",
					prefix: /* @__PURE__ */ jsx(Icon, {
						color: cssVar.colorTextDescription,
						icon: LinkIcon
					}),
					ref: linkInputRef,
					suffix: /* @__PURE__ */ jsx(CopyButton, {
						content: linkUrl,
						onClick: () => {
							if (linkUrl) message.success(t("link.copyUrlSuccess"));
						},
						size: "small",
						title: t("link.copyUrl")
					}),
					value: linkUrl
				})
			]
		}), /* @__PURE__ */ jsx(Flexbox, {
			className: styles$5.linkEditFooter,
			horizontal: true,
			justify: "flex-end",
			padding: 4,
			width: "100%",
			children: /* @__PURE__ */ jsxs(Button, {
				onClick: (e) => {
					e.preventDefault();
					handleSubmit();
				},
				size: "small",
				type: "text",
				variant: "filled",
				children: [t("confirm"), /* @__PURE__ */ jsx(Hotkey, {
					compact: true,
					keys: "enter",
					variant: "borderless"
				})]
			})
		})]
	});
};
LinkEdit.displayName = "LinkEdit";
//#endregion
//#region src/plugins/link/react/components/LinkToolbar.tsx
async function writeClipboard(value) {
	try {
		await navigator.clipboard.writeText(value);
	} catch {
		const textarea = document.createElement("textarea");
		textarea.value = value;
		textarea.setAttribute("readonly", "");
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		document.body.append(textarea);
		textarea.focus();
		textarea.select();
		document.execCommand("copy");
		textarea.remove();
	}
}
const LinkToolbar = memo(({ editor, enable }) => {
	const divRef = useRef(null);
	const LinkRef = useRef(null);
	const [linkNode, setLinkNode] = useState(null);
	const [copiedKey, setCopiedKey] = useState(null);
	const state = useRef({ isLink: false });
	const copiedTimerRef = useRef(-1);
	const t = useTranslation();
	const clearTimerRef = useRef(-1);
	const { editable } = useEditable();
	const handleEdit = useCallback(() => {
		if (!linkNode) return;
		editor.dispatchCommand(EDIT_LINK_COMMAND, {
			linkNode,
			linkNodeDOM: editor.getElementByKey(linkNode.getKey())
		});
	}, [editor, linkNode]);
	const handleCancel = useCallback(() => {
		clearTimeout(clearTimerRef.current);
		cleanPosition(divRef.current);
	}, []);
	const handleRemove = useCallback(() => {
		if (!linkNode) return;
		editor.update(() => {
			const node = $getNodeByKey(linkNode.getKey());
			if (!$isLinkNode(node)) return;
			let selection = $getSelection();
			if (!selection || !$isRangeSelection(selection)) {
				$setSelection($createRangeSelection());
				selection = $getSelection();
			}
			const first = node.getFirstDescendant();
			const last = node.getLastDescendant();
			if (selection && $isRangeSelection(selection) && $isTextNode(first) && $isTextNode(last)) {
				selection.anchor.set(first.getKey(), 0, "text");
				selection.focus.set(last.getKey(), last.getTextContentSize(), "text");
				editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
				return;
			}
			const children = node.getChildren();
			for (const child of children) node.insertBefore(child);
			node.remove();
		});
	}, [editor, linkNode]);
	const handleOpenLink = useCallback(() => {
		if (!linkNode) return;
		const url = editor.getEditorState().read(() => {
			const node = $getNodeByKey(linkNode.getKey());
			return $isLinkNode(node) ? node.getURL() : "";
		});
		if (url) window.open(url, "_blank");
	}, [editor, linkNode]);
	const flashCopied = useCallback((key) => {
		clearTimeout(copiedTimerRef.current);
		setCopiedKey(key);
		copiedTimerRef.current = setTimeout(() => setCopiedKey(null), 1500);
	}, []);
	const handleCopyText = useCallback(async () => {
		if (!linkNode) return;
		clearTimeout(clearTimerRef.current);
		const text = editor.getEditorState().read(() => {
			const node = $getNodeByKey(linkNode.getKey());
			return $isLinkNode(node) ? node.getTextContent() : "";
		});
		if (!text) return;
		try {
			await writeClipboard(text);
			flashCopied("copyText");
			message.success(t("link.copyTextSuccess"));
		} catch {
			message.error(t("link.copyFailed"));
		}
	}, [
		editor,
		flashCopied,
		linkNode,
		t
	]);
	const handleCopyUrl = useCallback(async () => {
		if (!linkNode) return;
		clearTimeout(clearTimerRef.current);
		const url = editor.getEditorState().read(() => {
			const node = $getNodeByKey(linkNode.getKey());
			return $isLinkNode(node) ? node.getURL() : "";
		});
		if (!url) return;
		try {
			await writeClipboard(url);
			flashCopied("copyUrl");
			message.success(t("link.copyUrlSuccess"));
		} catch {
			message.error(t("link.copyFailed"));
		}
	}, [
		editor,
		flashCopied,
		linkNode,
		t
	]);
	useLexicalEditor((editor) => {
		if (!editable) return;
		return mergeRegister(editor.registerUpdateListener(() => {
			const selection = editor.getEditorState().read(() => $getSelection());
			if (!selection) return;
			if ($isRangeSelection(selection)) editor.getEditorState().read(() => {
				const node = getSelectedNode(selection);
				const isLink = $isLinkNode(node.getParent()) || $isLinkNode(node);
				if (isLink === state.current.isLink) return;
				state.current.isLink = isLink;
				if (!isLink) editor.dispatchCommand(EDIT_LINK_COMMAND, {
					linkNode: null,
					linkNodeDOM: null
				});
			});
			else {
				if (!state.current.isLink) return;
				state.current.isLink = false;
				editor.dispatchCommand(EDIT_LINK_COMMAND, {
					linkNode: null,
					linkNodeDOM: null
				});
			}
		}), editor.registerCommand(HOVER_LINK_COMMAND, (payload) => {
			if (!enable) return false;
			if (!payload.event.target || divRef.current === null) return false;
			clearTimeout(clearTimerRef.current);
			setLinkNode(payload.linkNode);
			updatePosition({
				callback: () => {
					LinkRef.current = payload.event.target;
				},
				floating: divRef.current,
				offset: 4,
				placement: "top-start",
				reference: payload.event.target
			});
			return false;
		}, COMMAND_PRIORITY_NORMAL), editor.registerCommand(HOVER_OUT_LINK_COMMAND, () => {
			clearTimerRef.current = setTimeout(handleCancel, 300);
			return true;
		}, COMMAND_PRIORITY_NORMAL));
	}, [enable, editable]);
	return /* @__PURE__ */ jsx(ActionIconGroup, {
		className: styles$5.linkToolbar,
		items: [
			{
				icon: EditIcon,
				key: "edit",
				label: t("link.edit"),
				onClick: handleEdit
			},
			{
				icon: copiedKey === "copyText" ? CheckIcon : CopyIcon,
				key: "copyText",
				label: t("link.copyText"),
				onClick: handleCopyText
			},
			{
				icon: copiedKey === "copyUrl" ? CheckIcon : ClipboardCopyIcon,
				key: "copyUrl",
				label: t("link.copyUrl"),
				onClick: handleCopyUrl
			},
			{
				icon: ExternalLinkIcon,
				key: "openLink",
				label: t("link.open"),
				onClick: handleOpenLink
			},
			{
				icon: UnlinkIcon,
				key: "unlink",
				label: t("link.unlink"),
				onClick: () => {
					handleRemove();
					handleCancel();
				}
			}
		],
		onMouseEnter: () => {
			clearTimeout(clearTimerRef.current);
		},
		onMouseLeave: () => {
			if (copiedKey) return;
			handleCancel();
		},
		ref: divRef,
		shadow: true,
		size: {
			blockSize: 32,
			size: 16
		},
		variant: "outlined"
	});
});
LinkToolbar.displayName = "LinkToolbar";
//#endregion
//#region src/plugins/link/react/ReactLinkPlugin.tsx
const ReactLinkPlugin = ({ theme, enableHotkey = true, validateUrl, attributes }) => {
	const [enableToolbar, setEnableToolbar] = useState(false);
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(MarkdownPlugin);
		editor.registerPlugin(LinkPlugin, {
			attributes,
			enableHotkey,
			theme: theme || styles$5,
			validateUrl
		});
	}, [
		attributes,
		enableHotkey,
		styles$5,
		theme,
		validateUrl
	]);
	useLexicalEditor(() => {
		const linkService = editor.requireService(ILinkService);
		setEnableToolbar(linkService.enableLinkToolbar);
		const handleChange = () => {
			setEnableToolbar(linkService.enableLinkToolbar);
		};
		linkService.on("linkToolbarChange", handleChange);
		return () => {
			linkService.off("linkToolbarChange", handleChange);
		};
	}, []);
	return /* @__PURE__ */ jsxs(PortalAnchor, { children: [/* @__PURE__ */ jsx(LinkToolbar, {
		editor: editor.getLexicalEditor(),
		enable: enableToolbar
	}), /* @__PURE__ */ jsx(LinkEdit, { editor: editor.getLexicalEditor() })] });
};
ReactLinkPlugin.displayName = "ReactLinkPlugin";
//#endregion
//#region src/plugins/link-highlight/plugin/registry.ts
init_hotkey();
function registerLinkHighlight(editor, kernel, options) {
	const { enableHotkey = true } = options || {};
	return mergeRegister(editor.registerUpdateListener(({ mutatedNodes }) => {
		const keys = (mutatedNodes?.get(LinkHighlightNode))?.keys() || [];
		const needAddBefore = /* @__PURE__ */ new Set();
		editor.getEditorState().read(() => {
			for (const key of keys) {
				const node = $getNodeByKey(key);
				if (!node) return;
				if (node.getParent()?.getFirstChild() === node) needAddBefore.add(node);
			}
		});
		if (needAddBefore.size > 0) editor.update(() => {
			needAddBefore.forEach((node) => {
				if (!node.getPreviousSibling()) node.insertBefore($createCursorNode());
			});
		});
	}), kernel.registerHotkey(HotkeyEnum.Link, () => editor.dispatchCommand(INSERT_LINK_HIGHLIGHT_COMMAND, void 0), {
		enabled: enableHotkey,
		preventDefault: true,
		stopPropagation: true
	}));
}
//#endregion
//#region src/plugins/link-highlight/plugin/index.ts
init_helper();
init_plugin();
init_debug();
const LinkHighlightPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "LinkHighlightPlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		this.logger = createDebugLogger("plugin", "link-highlight");
		kernel.registerNodes([LinkHighlightNode]);
		kernel.registerThemes({ linkHighlight: config?.theme || "editor-link-highlight" });
		this.urlRegex = config?.urlRegex || /^(?:https?:\/\/|mailto:|tel:)[^\s"<>[\\\]^`{|}]+|^www\.[^\s"<>[\\\]^`{|}]+/i;
		this.logger.debug("LinkHighlightPlugin initialized");
	}
	onInit(editor) {
		this.register(registerLinkHighlightCommand(editor));
		this.register(registerLinkHighlight(editor, this.kernel, { enableHotkey: this.config?.enableHotkey }));
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!markdownService) return;
		markdownService.registerMarkdownWriter(LinkHighlightNode.getType(), (ctx, node) => {
			ctx.appendLine(node.getTextContent());
			return true;
		});
		markdownService.registerMarkdownShortCut({
			regExp: /<((?:https?:\/\/|mailto:|tel:|www\.)[^\s"<>[\\\]^`{|}]+)>\s?$/,
			replace: (textNode, match) => {
				const [, url] = match;
				if (!url || !isValidUrl(url)) return;
				this.logger.debug("Converting markdown auto-link to LinkHighlightNode:", url);
				const linkHighlightNode = $createLinkHighlightNode();
				const textNodeContent = $createTextNode(url);
				linkHighlightNode.append(textNodeContent);
				textNode.replace(linkHighlightNode);
			},
			trigger: ">",
			type: "text-match"
		});
		markdownService.registerMarkdownReader("html", (node) => {
			const match = (node.value || "").match(/^<((?:https?:\/\/|mailto:|tel:|www\.)[^\s"<>[\\\]^`{|}]+)>$/);
			if (match) {
				const url = match[1].replaceAll(/[\u200B-\u200D\u2060\uFEFF]/g, "");
				this.logger.debug("Converting HTML auto-link to LinkHighlightNode:", url);
				return INodeHelper.createElementNode("linkHighlight", {
					children: [INodeHelper.createTextNode(url, {})],
					direction: "ltr",
					format: "",
					indent: 0,
					type: "linkHighlight",
					version: 1
				});
			}
			return false;
		}, 1);
		markdownService.registerMarkdownReader("link", (node, children) => {
			const url = node.url || "";
			if (!children || children.length === 0) return false;
			if (children.filter((child) => child.type === "text").map((child) => child.text || "").join("") === url) {
				this.logger.debug("Converting markdown auto-link to LinkHighlightNode:", url);
				return INodeHelper.createElementNode("linkHighlight", {
					children: [INodeHelper.createTextNode(url, {})],
					direction: "ltr",
					format: "",
					indent: 0,
					type: "linkHighlight",
					version: 1
				});
			}
			return false;
		}, 1);
		this.logger.debug("LinkHighlightPlugin initialized with markdown support");
	}
};
//#endregion
//#region src/plugins/link-highlight/react/style.ts
const styles$4 = createStaticStyles(({ css }) => {
	return { linkHighlight: css`
      cursor: unset;

      margin-block: 1em;
      margin-inline: 0;
      padding: 2px;
      border: none;
    ` };
});
//#endregion
//#region src/plugins/link-highlight/react/ReactLinkHighlightPlugin.tsx
const ReactLinkHighlightPlugin = ({ className, enableHotkey = true, enablePasteAutoHighlight = true }) => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(MarkdownPlugin);
		editor.registerPlugin(LinkHighlightPlugin, {
			enableHotkey,
			enablePasteAutoHighlight,
			theme: cx(styles$4.linkHighlight, className)
		});
	}, [
		className,
		cx,
		enableHotkey,
		enablePasteAutoHighlight,
		editor,
		styles$4.linkHighlight
	]);
	return null;
};
ReactLinkHighlightPlugin.displayName = "ReactLinkHighlightPlugin";
//#endregion
//#region src/plugins/list/react/ReactListPlugin.tsx
const ReactListPlugin = ({ enableHotkey = true }) => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(MarkdownPlugin);
		editor.registerPlugin(ListPlugin, {
			enableHotkey,
			theme: styles$16
		});
	}, [enableHotkey, styles$16]);
	return null;
};
ReactListPlugin.displayName = "ReactListPlugin";
//#endregion
//#region src/plugins/markmap/node/index.ts
var MarkmapNode = class MarkmapNode extends DecoratorNode {
	static getType() {
		return "markmap";
	}
	static clone(node) {
		return new MarkmapNode(node.__markdown, node.__key);
	}
	static importJSON(serializedNode) {
		return new MarkmapNode(serializedNode.markdown);
	}
	constructor(markdown = "", key, autoOpenEditor = false) {
		super(key);
		this.__markdown = markdown;
		this.__autoOpenEditor = autoOpenEditor;
	}
	clearAutoOpenEditor() {
		const w = this.getWritable();
		w.__autoOpenEditor = false;
	}
	createDOM(config) {
		const element = document.createElement("div");
		addClassNamesToElement(element, config.theme.markmap ?? "editor-markmap");
		return element;
	}
	decorate(editor) {
		const decorator = getKernelFromEditor(editor)?.getDecorator(MarkmapNode.getType());
		if (!decorator) return null;
		if (typeof decorator === "function") return decorator(this, editor);
		return {
			queryDOM: decorator.queryDOM,
			render: decorator.render(this, editor)
		};
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			markdown: this.__markdown
		};
	}
	getTextContent() {
		return `---markmap---\n${this.__markdown}\n---/markmap---\n`;
	}
	isInline() {
		return false;
	}
	updateMarkdown(markdown) {
		const writer = this.getWritable();
		writer.__markdown = markdown;
	}
	updateDOM() {
		return false;
	}
};
function $createMarkmapNode(markdown = "", options) {
	return $applyNodeReplacement(new MarkmapNode(markdown, void 0, options?.autoOpenEditor ?? false));
}
function $isMarkmapNode(node) {
	return node instanceof MarkmapNode;
}
//#endregion
//#region src/plugins/markmap/command/index.ts
const INSERT_MARKMAP_COMMAND = createCommand("INSERT_MARKMAP_COMMAND");
function registerMarkmapCommand(editor) {
	return editor.registerCommand(INSERT_MARKMAP_COMMAND, () => {
		editor.update(() => {
			$insertNodes([$createMarkmapNode("", { autoOpenEditor: true })]);
		});
		return true;
	}, COMMAND_PRIORITY_EDITOR);
}
//#endregion
//#region src/plugins/markmap/plugin/index.ts
init_helper();
init_plugin();
const MARKMAP_SHORTCUT = /^---markmap---$/i;
const MARKMAP_DIALOG_SHORTCUT = /^&markmap&$/i;
const MARKMAP_BLOCK = /^---markmap---\n([\S\s]*?)\n---\/markmap---$/i;
function extractParagraphText$1(node) {
	return (node.children || []).map((child) => {
		if ("value" in child && typeof child.value === "string") return child.value;
		return "";
	}).join("");
}
const MarkmapPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "MarkmapPlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		kernel.registerNodes([MarkmapNode]);
		if (config?.theme) kernel.registerThemes(config.theme);
		this.registerDecorator(kernel, MarkmapNode.getType(), (node, editor) => {
			return config?.decorator ? config.decorator(node, editor) : null;
		});
	}
	onInit(editor) {
		this.register(registerMarkmapCommand(editor));
		this.registerMarkdown();
	}
	registerMarkdown() {
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!markdownService) return;
		markdownService.registerMarkdownShortCut({
			regExp: MARKMAP_SHORTCUT,
			replace: (parentNode) => {
				const node = $createMarkmapNode("", { autoOpenEditor: true });
				parentNode.replace(node);
				const selection = $createNodeSelection();
				selection.add(node.getKey());
				$setSelection(selection);
			},
			trigger: "enter",
			type: "element"
		});
		markdownService.registerMarkdownShortCut({
			regExp: MARKMAP_DIALOG_SHORTCUT,
			replace: (parentNode) => {
				const node = $createMarkmapNode("", { autoOpenEditor: true });
				parentNode.replace(node);
				const selection = $createNodeSelection();
				selection.add(node.getKey());
				$setSelection(selection);
			},
			trigger: "enter",
			type: "element"
		});
		markdownService.registerMarkdownWriter(MarkmapNode.getType(), (ctx, node) => {
			const markmapNode = node;
			ctx.appendLine("---markmap---");
			ctx.appendLine(markmapNode.__markdown || "");
			ctx.appendLine("---/markmap---");
			return true;
		});
		markdownService.registerMarkdownReader("paragraph", (node) => {
			const match = extractParagraphText$1(node).match(MARKMAP_BLOCK);
			if (!match) return false;
			const markdown = match[2]?.trim() || "";
			return INodeHelper.createTypeNode(MarkmapNode.getType(), { markdown });
		}, 1);
	}
};
//#endregion
//#region src/plugins/markmap/react/MarkmapPreview.tsx
const MIN_SCALE = .2;
const MAX_SCALE = 5;
const SCALE_STEP = .2;
function MarkmapPreview({ markdown }) {
	const containerRef = useRef(null);
	const markmapRef = useRef(null);
	const [scale, setScale] = useState(1);
	useEffect(() => {
		if (!containerRef.current || !markdown.trim()) return;
		try {
			const { root } = new Transformer().transform(markdown);
			if (!root) return;
			const container = containerRef.current;
			container.innerHTML = "";
			const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svgElement.style.width = "100%";
			svgElement.style.height = "100%";
			container.append(svgElement);
			if (markmapRef.current) markmapRef.current.destroy();
			const markmap = new Markmap(svgElement);
			markmapRef.current = markmap;
			if (countNodes(root) > 30) setFoldAll(root, true);
			markmap.setData(root);
			requestAnimationFrame(() => {
				markmap.fit();
			});
		} catch {}
		return () => {
			if (markmapRef.current) {
				markmapRef.current.destroy();
				markmapRef.current = null;
			}
		};
	}, [markdown]);
	const zoomIn = useCallback(() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP)), []);
	const zoomOut = useCallback(() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP)), []);
	const resetZoom = useCallback(() => setScale(1), []);
	const expandAll = useCallback(() => {
		if (!markmapRef.current) return;
		const data = markmapRef.current.state.data;
		if (!data) return;
		setFoldAll(data, false);
		markmapRef.current.renderData(data);
	}, []);
	const collapseAll = useCallback(() => {
		if (!markmapRef.current) return;
		const data = markmapRef.current.state.data;
		if (!data) return;
		setFoldAll(data, true);
		markmapRef.current.renderData(data);
	}, []);
	const btnBase = {
		alignItems: "center",
		background: "none",
		border: "1px solid #d9d9d9",
		borderRadius: 4,
		color: "#595959",
		cursor: "pointer",
		display: "flex",
		fontSize: 14,
		height: 28,
		justifyContent: "center",
		padding: "0 8px"
	};
	if (!markdown.trim()) return /* @__PURE__ */ jsx("div", {
		style: {
			alignItems: "center",
			color: "#bfbfbf",
			display: "flex",
			fontSize: 14,
			height: "100%",
			justifyContent: "center"
		},
		children: "在左侧输入 Markdown 标题语法生成思维导图"
	});
	return /* @__PURE__ */ jsxs("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			height: "100%",
			position: "relative",
			width: "100%"
		},
		children: [/* @__PURE__ */ jsxs("div", {
			style: {
				alignItems: "center",
				borderBottom: "1px solid #f0f0f0",
				display: "flex",
				gap: 4,
				padding: "8px 12px"
			},
			children: [/* @__PURE__ */ jsx("span", {
				style: {
					color: "#8c8c8c",
					fontSize: 12
				},
				children: "预览"
			}), /* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					gap: 4,
					marginLeft: "auto"
				},
				children: [
					/* @__PURE__ */ jsx("button", {
						onClick: expandAll,
						style: btnBase,
						title: "展开全部节点",
						type: "button",
						children: "⟱ 展开"
					}),
					/* @__PURE__ */ jsx("button", {
						onClick: collapseAll,
						style: btnBase,
						title: "折叠全部节点",
						type: "button",
						children: "⟰ 折叠"
					}),
					/* @__PURE__ */ jsx("button", {
						disabled: scale <= MIN_SCALE,
						onClick: zoomOut,
						style: {
							...btnBase,
							opacity: scale <= MIN_SCALE ? .4 : 1
						},
						type: "button",
						children: "−"
					}),
					/* @__PURE__ */ jsxs("button", {
						onClick: resetZoom,
						style: {
							...btnBase,
							fontFamily: "monospace",
							minWidth: 48
						},
						type: "button",
						children: [Math.round(scale * 100), "%"]
					}),
					/* @__PURE__ */ jsx("button", {
						disabled: scale >= MAX_SCALE,
						onClick: zoomIn,
						style: {
							...btnBase,
							opacity: scale >= MAX_SCALE ? .4 : 1
						},
						type: "button",
						children: "+"
					})
				]
			})]
		}), /* @__PURE__ */ jsx("div", {
			style: {
				flex: 1,
				overflow: "auto"
			},
			children: /* @__PURE__ */ jsx("div", {
				ref: containerRef,
				style: {
					height: "100%",
					minHeight: 300,
					transform: `scale(${scale})`,
					transformOrigin: "top left",
					width: "100%"
				}
			})
		})]
	});
}
//#endregion
//#region src/plugins/markmap/react/MarkmapEditor.tsx
function MarkmapEditor({ markdown, onSave, onClose }) {
	const [value, setValue] = useState(markdown);
	const handleSave = useCallback(() => {
		onSave(value);
		onClose();
	}, [
		onSave,
		onClose,
		value
	]);
	return /* @__PURE__ */ jsxs("div", {
		style: {
			background: "#fff",
			display: "flex",
			flexDirection: "column",
			inset: 0,
			position: "fixed",
			zIndex: 9999
		},
		children: [/* @__PURE__ */ jsxs("div", {
			style: {
				alignItems: "center",
				background: "#fafafa",
				borderBottom: "1px solid #f0f0f0",
				display: "flex",
				justifyContent: "space-between",
				padding: "12px 16px"
			},
			children: [/* @__PURE__ */ jsx("span", {
				style: {
					fontSize: 14,
					fontWeight: 500
				},
				children: "Markmap 思维导图"
			}), /* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					gap: 8
				},
				children: [/* @__PURE__ */ jsx("button", {
					onClick: onClose,
					style: {
						background: "none",
						border: "1px solid #d9d9d9",
						borderRadius: 4,
						cursor: "pointer",
						fontSize: 13,
						padding: "4px 12px"
					},
					type: "button",
					children: "取消"
				}), /* @__PURE__ */ jsx("button", {
					onClick: handleSave,
					style: {
						background: "#1677ff",
						border: "none",
						borderRadius: 4,
						color: "#fff",
						cursor: "pointer",
						fontSize: 13,
						padding: "4px 16px"
					},
					type: "button",
					children: "保存"
				})]
			})]
		}), /* @__PURE__ */ jsxs("div", {
			style: {
				display: "flex",
				flex: 1,
				overflow: "hidden"
			},
			children: [/* @__PURE__ */ jsxs("div", {
				style: {
					borderRight: "1px solid #f0f0f0",
					display: "flex",
					flexDirection: "column",
					width: "50%"
				},
				children: [/* @__PURE__ */ jsx("div", {
					style: {
						background: "#fafafa",
						borderBottom: "1px solid #f0f0f0",
						color: "#8c8c8c",
						fontSize: 12,
						padding: "8px 12px"
					},
					children: "Markdown 编辑器"
				}), /* @__PURE__ */ jsx("textarea", {
					onChange: (e) => setValue(e.target.value),
					placeholder: "# 根节点\n## 分支 1\n### 子节点\n## 分支 2",
					style: {
						border: "none",
						flex: 1,
						fontFamily: "monospace",
						fontSize: 14,
						lineHeight: 1.6,
						outline: "none",
						padding: 16,
						resize: "none"
					},
					value
				})]
			}), /* @__PURE__ */ jsx("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					width: "50%"
				},
				children: /* @__PURE__ */ jsx(MarkmapPreview, { markdown: value })
			})]
		})]
	});
}
//#endregion
//#region src/plugins/markmap/react/index.tsx
function MarkmapDecorator({ className, editor: lexicalEditor, node }) {
	const [editing, setEditing] = useState(false);
	const markdown = node.__markdown;
	useLayoutEffect(() => {
		const key = node.getKey();
		let shouldOpen = false;
		lexicalEditor.getEditorState().read(() => {
			const latest = $getNodeByKey(key);
			if (latest && $isMarkmapNode(latest) && latest.__autoOpenEditor) shouldOpen = true;
		});
		if (shouldOpen) {
			setEditing(true);
			lexicalEditor.update(() => {
				const latest = $getNodeByKey(key);
				if (latest && $isMarkmapNode(latest) && latest.__autoOpenEditor) latest.clearAutoOpenEditor();
			});
		}
	}, [lexicalEditor, node.getKey()]);
	const handleDelete = useCallback(() => {
		lexicalEditor.update(() => {
			const latest = node.getLatest();
			const next = latest.getNextSibling();
			const prev = latest.getPreviousSibling();
			latest.remove();
			if (next) {
				next.selectStart();
				return;
			}
			if (prev) prev.selectEnd();
		});
	}, [lexicalEditor, node]);
	const handleSave = useCallback((newMarkdown) => {
		lexicalEditor.update(() => {
			node.updateMarkdown(newMarkdown);
		});
		setEditing(false);
	}, [lexicalEditor, node]);
	if (editing) return /* @__PURE__ */ jsx("div", {
		className,
		children: /* @__PURE__ */ jsx(MarkmapEditor, {
			markdown,
			onClose: () => setEditing(false),
			onSave: handleSave
		})
	});
	return /* @__PURE__ */ jsxs("div", {
		className,
		style: {
			margin: "8px 0",
			position: "relative"
		},
		children: [/* @__PURE__ */ jsxs("div", {
			style: {
				bottom: 8,
				display: "flex",
				gap: 4,
				position: "absolute",
				right: 8,
				zIndex: 10
			},
			children: [/* @__PURE__ */ jsx("button", {
				onClick: () => setEditing(true),
				style: {
					background: "rgba(0,0,0,0.5)",
					border: "none",
					borderRadius: 4,
					color: "#fff",
					cursor: "pointer",
					fontSize: 12,
					padding: "4px 8px"
				},
				type: "button",
				children: "编辑"
			}), /* @__PURE__ */ jsx("button", {
				onClick: handleDelete,
				style: {
					background: "rgba(255,77,79,0.7)",
					border: "none",
					borderRadius: 4,
					color: "#fff",
					cursor: "pointer",
					fontSize: 12,
					padding: "4px 8px"
				},
				type: "button",
				children: "删除"
			})]
		}), /* @__PURE__ */ jsx("div", {
			style: {
				border: "1px solid #f0f0f0",
				borderRadius: 8,
				height: 350
			},
			children: /* @__PURE__ */ jsx(MarkmapPreview, { markdown })
		})]
	});
}
function ReactMarkmapPlugin({ className, theme }) {
	const [editor] = useLexicalComposerContext();
	const decorator = useCallback((node, lexicalEditor) => {
		return /* @__PURE__ */ jsx(MarkmapDecorator, {
			className,
			editor: lexicalEditor,
			node
		});
	}, [className]);
	const registeredRef = useRef(false);
	if (!registeredRef.current) {
		registeredRef.current = true;
		editor.registerPlugin(MarkmapPlugin, {
			decorator,
			theme
		});
	}
	return null;
}
//#endregion
//#region src/plugins/math/command/index.ts
const INSERT_MATH_COMMAND = createCommand("INSERT_MATH_COMMAND");
const UPDATE_MATH_COMMAND = createCommand("UPDATE_MATH_COMMAND");
const SELECT_MATH_SIDE_COMMAND = createCommand("SELECT_MATH_SIDE_COMMAND");
function registerMathCommand(editor) {
	return mergeRegister(editor.registerCommand(INSERT_MATH_COMMAND, (payload) => {
		const { code } = payload;
		editor.update(() => {
			const mathNode = $createMathInlineNode(code);
			$insertNodes([mathNode]);
			if ($isRootOrShadowRoot(mathNode.getParentOrThrow())) $wrapNodeInElement(mathNode, $createParagraphNode).selectEnd();
		});
		return true;
	}, COMMAND_PRIORITY_HIGH), editor.registerCommand(UPDATE_MATH_COMMAND, (payload) => {
		const { code, key } = payload;
		editor.update(() => {
			const mathCode = $getNodeByKey(key);
			if (mathCode) {
				mathCode.updateCode(code);
				mathCode.selectNext();
			}
		});
		return true;
	}, COMMAND_PRIORITY_HIGH), editor.registerCommand(SELECT_MATH_SIDE_COMMAND, (payload) => {
		const { key, prev } = payload;
		editor.update(() => {
			const mathNode = $getNodeByKey(key);
			if (mathNode) if (prev) mathNode.selectPrevious();
			else mathNode.selectNext();
		});
		return true;
	}, COMMAND_PRIORITY_HIGH));
}
//#endregion
//#region src/plugins/math/utils/index.ts
/**
* Heuristic: does the content between `$...$` look like a math formula?
*
* Positive signals (any one → math):
*  - LaTeX commands        \alpha  \frac  …
*  - Structural chars      ^ _ { } ( )
*  - Operators / relations  + - * / = < > | ! ,
*  - Digits                0-9
*  - Single ASCII letter   x  y  n  (common math variable)
*
* Everything else (multi-char words, CJK, spaced plain text) → not math.
*/
function isLikelyMathContent(content) {
	const trimmed = content.trim();
	if (!trimmed) return false;
	if (/\\[A-Za-z]/.test(trimmed)) return true;
	if (/[\d!()*+,/<=>^_{|}-]/.test(trimmed)) return true;
	if (/^[A-Za-z]$/.test(trimmed)) return true;
	return false;
}
//#endregion
//#region src/plugins/math/plugin/index.ts
init_helper();
init_plugin();
init_debug();
const MathPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "MathPlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		this.logger = createDebugLogger("plugin", "math");
		kernel.registerNodes([MathInlineNode, MathBlockNode]);
		if (config?.theme) kernel.registerThemes(config?.theme);
		this.registerDecorator(kernel, MathInlineNode.getType(), (node, editor) => {
			return config?.decorator ? config.decorator(node, editor) : null;
		});
		this.registerDecorator(kernel, MathBlockNode.getType(), (node, editor) => {
			return config?.decorator ? config.decorator(node, editor) : null;
		});
	}
	onInit(editor) {
		this.register(registerMathCommand(editor));
		this.registerMarkdown();
	}
	registerMarkdown() {
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		markdownService?.registerMarkdownShortCut({
			regExp: /\$([^\s$](?:[^$]*[^\s$])?)\$\s?$/,
			replace: (textNode, match) => {
				const [, code] = match;
				if (!isLikelyMathContent(code)) return;
				const mathNode = $createMathInlineNode(code);
				this.logger.debug("Math node inserted:", mathNode);
				textNode.insertBefore(mathNode);
				textNode.setTextContent("");
				textNode.select();
			},
			trigger: "$",
			type: "text-match"
		});
		markdownService?.registerMarkdownShortCut({
			regExp: /^(\$\$)$/,
			replace: (parentNode, _1, _2, isImport) => {
				const node = $createMathBlockNode();
				if (isImport || parentNode.getNextSibling()) parentNode.replace(node);
				else parentNode.insertBefore(node);
				const sel = $createNodeSelection();
				sel.add(node.getKey());
				$setSelection(sel);
			},
			trigger: "enter",
			type: "element"
		});
		markdownService?.registerMarkdownWriter(MathInlineNode.getType(), (ctx, node) => {
			ctx.appendLine(node.getTextContent());
			return true;
		});
		markdownService?.registerMarkdownWriter(MathBlockNode.getType(), (ctx, node) => {
			ctx.appendLine(node.getTextContent());
			return true;
		});
		markdownService?.registerMarkdownReader("inlineMath", (node) => {
			return INodeHelper.createElementNode("math", {
				code: node.value,
				version: 1
			});
		});
		markdownService?.registerMarkdownReader("math", (node) => {
			return INodeHelper.createElementNode("mathBlock", {
				code: node.value,
				version: 1
			});
		});
	}
};
//#endregion
//#region src/plugins/math/react/components/MathEditorContainer.tsx
const MathEditorContainer = memo(({ children, isBlockMode, mathDOM, onFocus, prev }) => {
	const anchorRef = useRef(null);
	const [blockWidth, setBlockWidth] = useState(void 0);
	const lastBlockWidthRef = useRef(void 0);
	const setBlockWidthIfNeeded = useCallback((nextWidth) => {
		const normalizedWidth = typeof nextWidth === "number" ? Math.round(nextWidth) : void 0;
		if (lastBlockWidthRef.current === normalizedWidth) return;
		lastBlockWidthRef.current = normalizedWidth;
		setBlockWidth(normalizedWidth);
	}, []);
	const updateBlockWidth = useCallback(() => {
		if (!isBlockMode) {
			setBlockWidthIfNeeded(void 0);
			return;
		}
		const editorContainer = mathDOM?.closest("[contenteditable=\"true\"]");
		if (editorContainer) setBlockWidthIfNeeded(editorContainer.getBoundingClientRect().width);
	}, [
		isBlockMode,
		mathDOM,
		setBlockWidthIfNeeded
	]);
	const updateAnchorPosition = useCallback(() => {
		return updatePosition({
			callback: () => {
				if (!anchorRef.current || !mathDOM) return;
				onFocus?.();
				updateBlockWidth();
			},
			floating: anchorRef.current,
			placement: isBlockMode ? "bottom-start" : "bottom",
			reference: mathDOM
		});
	}, [
		isBlockMode,
		mathDOM,
		onFocus,
		updateBlockWidth
	]);
	const handleAnchorClick = useCallback(() => {
		if (!mathDOM) return;
		updateAnchorPosition();
	}, [mathDOM, updateAnchorPosition]);
	useEffect(() => {
		if (!mathDOM || !anchorRef.current) return;
		const floating = anchorRef.current;
		const resizeObserver = new ResizeObserver(() => {
			updateBlockWidth();
		});
		resizeObserver.observe(floating);
		let editorContainer = null;
		if (isBlockMode) {
			editorContainer = mathDOM.closest("[contenteditable=\"true\"]");
			if (editorContainer) resizeObserver.observe(editorContainer);
		}
		updateAnchorPosition();
		window.addEventListener("resize", updateAnchorPosition);
		return () => {
			resizeObserver.disconnect();
			window.removeEventListener("resize", updateAnchorPosition);
		};
	}, [
		mathDOM,
		prev,
		isBlockMode,
		updateAnchorPosition
	]);
	useEffect(() => {
		if (mathDOM || !anchorRef.current) return;
		cleanPosition(anchorRef.current);
	}, [mathDOM]);
	return /* @__PURE__ */ jsx(Popover, {
		arrow: false,
		content: /* @__PURE__ */ jsx(Flexbox, {
			className: styles$17.mathEditor,
			"data-math-editor-container": true,
			style: blockWidth ? { width: blockWidth } : void 0,
			children
		}),
		open: !!mathDOM,
		placement: isBlockMode ? "bottomLeft" : "bottom",
		styles: { content: {
			borderRadius: "6px",
			padding: 0
		} },
		children: /* @__PURE__ */ jsx("span", {
			className: styles$17.mathEditorAnchor,
			onClick: handleAnchorClick,
			ref: anchorRef
		})
	});
});
MathEditorContainer.displayName = "MathEditorContainer";
//#endregion
//#region src/plugins/math/react/components/MathEditorContent.tsx
init_sys();
const MathEditorContent = memo(({ focusRef, mathNode, onArrowLeft, onArrowRight, onCancel, onDelete, onSubmit, onValidationChange, onValueChange, value }) => {
	const t = useTranslation();
	const textareaRef = useRef(null);
	const [latexError, setLatexError] = useState("");
	useEffect(() => {
		focusRef?.(textareaRef.current);
	}, [focusRef]);
	useEffect(() => {
		if (!mathNode) return;
		if (!value.trim()) {
			setLatexError("");
			onValidationChange?.(true);
			return;
		}
		const timeoutId = setTimeout(() => {
			try {
				renderToString(value, {
					displayMode: true,
					throwOnError: true
				});
				setLatexError("");
				onValidationChange?.(true);
			} catch (error) {
				setLatexError(error instanceof Error ? error.message : "LaTeX Parse Error");
				onValidationChange?.(false);
			}
		}, 50);
		return () => clearTimeout(timeoutId);
	}, [
		value,
		mathNode,
		onValidationChange
	]);
	const handleKeyDown = useCallback((e) => {
		if (!mathNode) return;
		if (isModifierMatch(e, CONTROL_OR_META) && e.key === "Enter") {
			e.preventDefault();
			onSubmit();
			return;
		}
		if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
			return;
		}
		if (e.key === "Backspace" && !value.trim()) {
			e.preventDefault();
			onDelete();
			return;
		}
		if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) {
			e.preventDefault();
			onArrowLeft();
		}
		if (e.key === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length) {
			e.preventDefault();
			onArrowRight();
		}
	}, [
		mathNode,
		onSubmit,
		onCancel,
		onDelete,
		onArrowLeft,
		onArrowRight,
		value
	]);
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx(TextArea, {
			autoFocus: true,
			autoSize: {
				maxRows: 6,
				minRows: 1
			},
			className: styles$17.mathEditorTextArea,
			onChange: (e) => {
				onValueChange(e.target.value);
			},
			onKeyDown: handleKeyDown,
			placeholder: `${t("math.placeholder")}...`,
			ref: textareaRef,
			resize: false,
			value,
			variant: "borderless"
		}),
		latexError && /* @__PURE__ */ jsx(Flexbox, {
			className: styles$17.mathEditorFooter,
			horizontal: true,
			paddingBlock: 4,
			paddingInline: 12,
			width: "100%",
			children: /* @__PURE__ */ jsx(Text, {
				fontSize: 13,
				type: "danger",
				children: latexError
			})
		}),
		/* @__PURE__ */ jsx(Flexbox, {
			className: styles$17.mathEditorFooter,
			horizontal: true,
			justify: "flex-end",
			padding: 4,
			width: "100%",
			children: /* @__PURE__ */ jsxs(Button, {
				onClick: (e) => {
					e.preventDefault();
					onSubmit();
				},
				size: "small",
				type: "text",
				variant: "filled",
				children: [t("confirm"), /* @__PURE__ */ jsx(Hotkey, {
					compact: true,
					keys: "mod+enter",
					variant: "borderless"
				})]
			})
		})
	] });
});
MathEditorContent.displayName = "MathEditorContent";
//#endregion
//#region src/plugins/math/react/components/MathEditor.tsx
init_utils();
const MathEdit = memo(({ renderComp }) => {
	const textareaRef = useRef(null);
	const isUpdatingRef = useRef(false);
	const [mathNode, setMathNode] = useState(null);
	const [value, setValue] = useState("");
	const lastValidRef = useRef("");
	const isInputValidRef = useRef(true);
	const [mathDOM, setMathDOM] = useState(null);
	const [prev, setPrev] = useState(false);
	const [isBlockMode, setIsBlockMode] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [editor] = useLexicalComposerContext();
	useEffect(() => {
		if (!mathNode) return;
		if (!isInputValidRef.current) return;
		const timeoutId = setTimeout(() => {
			const lexicalEditor = editor.getLexicalEditor();
			if (lexicalEditor && !isUpdatingRef.current) {
				const currentCode = mathNode.code;
				if (value && currentCode && currentCode === value) return;
				isUpdatingRef.current = true;
				lexicalEditor.update(() => {
					if (lexicalEditor.getEditorState().read(() => {
						return lexicalEditor.getElementByKey(mathNode.getKey());
					})) {
						const writableNode = mathNode.getWritable();
						writableNode.__code = value;
					}
				});
				setTimeout(() => {
					isUpdatingRef.current = false;
				}, 50);
			}
		}, 50);
		return () => clearTimeout(timeoutId);
	}, [
		value,
		mathNode,
		editor
	]);
	const handleSubmit = useCallback(() => {
		if (!mathNode) return;
		const lexicalEditor = editor.getLexicalEditor();
		if (lexicalEditor) {
			const codeToCommit = isInputValidRef.current ? value : lastValidRef.current;
			lexicalEditor.dispatchCommand(UPDATE_MATH_COMMAND, {
				code: codeToCommit,
				key: mathNode.getKey()
			});
		}
	}, [
		editor,
		mathNode,
		value
	]);
	const handleCancel = useCallback(() => {
		if (!mathNode) return;
		const lexicalEditor = editor.getLexicalEditor();
		if (lexicalEditor) {
			lexicalEditor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, {
				key: mathNode.getKey(),
				prev: false
			});
			lexicalEditor.focus();
		}
	}, [mathNode, editor]);
	const handleDelete = useCallback(() => {
		if (!mathNode) return;
		const lexicalEditor = editor.getLexicalEditor();
		if (lexicalEditor) lexicalEditor.update(() => {
			mathNode.remove();
		});
	}, [mathNode, editor]);
	const handleArrowLeft = useCallback(() => {
		if (!mathNode) return;
		editor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, {
			key: mathNode.getKey(),
			prev: true
		});
	}, [mathNode, editor]);
	const handleArrowRight = useCallback(() => {
		if (!mathNode) return;
		editor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, {
			key: mathNode.getKey(),
			prev: false
		});
	}, [mathNode, editor]);
	const handleFocus = useCallback(() => {
		textareaRef.current?.focus();
		if (prev) textareaRef.current?.resizableTextArea?.textArea?.setSelectionRange(0, 0);
	}, [prev]);
	const setTextareaRef = useCallback((ref) => {
		textareaRef.current = ref;
	}, []);
	useLexicalEditor((editor) => {
		return mergeRegister(editor.registerUpdateListener(({ prevEditorState }) => {
			if (isUpdatingRef.current) return;
			const canEdit = editor.getEditorState().read(() => {
				const selection = $getSelection();
				if (!$isNodeSelection(selection)) return false;
				const node = selection.getNodes()[0];
				if (!$isMathNode(node)) return false;
				const isSameNode = mathNode && mathNode.getKey() === node.getKey();
				setMathNode(node);
				if (!isSameNode && node.code !== value) {
					setValue(node.code);
					lastValidRef.current = node.code;
					isInputValidRef.current = true;
				}
				setMathDOM(editor.getElementByKey(node.getKey()));
				setIsBlockMode(node instanceof MathBlockNode);
				return node;
			});
			if (canEdit) {
				const anchorNodeKey = prevEditorState.read(() => {
					const sel = prevEditorState._selection;
					if (!$isRangeSelection(sel)) return false;
					return sel.anchor.key;
				});
				editor.getEditorState().read(() => {
					const anchorNode = anchorNodeKey ? $getNodeByKey(anchorNodeKey) : null;
					if (anchorNode && compareNodeOrder(anchorNode, canEdit) < 0) setPrev(true);
					else setPrev(false);
				});
				setIsOpen(true);
			}
			if (!canEdit) {
				setMathNode(null);
				setMathDOM(null);
				setValue("");
				lastValidRef.current = "";
				isInputValidRef.current = true;
				setIsBlockMode(false);
				setIsOpen(false);
			}
		}));
	}, [mathNode, value]);
	const mathEditorContent = /* @__PURE__ */ jsx(MathEditorContent, {
		focusRef: setTextareaRef,
		mathNode,
		onArrowLeft: handleArrowLeft,
		onArrowRight: handleArrowRight,
		onCancel: handleCancel,
		onDelete: handleDelete,
		onSubmit: handleSubmit,
		onValidationChange: (isValid) => {
			isInputValidRef.current = isValid;
			if (isValid) lastValidRef.current = value;
		},
		onValueChange: setValue,
		value
	});
	useEffect(() => {
		if (!isOpen) return;
		const handlePointerDown = (event) => {
			const target = event.target;
			if (!target) return;
			if (Array.from(document.querySelectorAll("[data-math-editor-container]")).some((el) => el && el.contains(target))) return;
			handleCancel();
		};
		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("touchstart", handlePointerDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("touchstart", handlePointerDown);
		};
	}, [isOpen, handleCancel]);
	if (renderComp) return /* @__PURE__ */ jsx(Fragment, { children: renderComp({
		children: /* @__PURE__ */ jsx("div", {
			"data-math-editor-container": true,
			children: mathEditorContent
		}),
		open: isOpen
	}) });
	return /* @__PURE__ */ jsx(PortalAnchor, { children: /* @__PURE__ */ jsx(MathEditorContainer, {
		isBlockMode,
		mathDOM,
		onFocus: handleFocus,
		prev,
		children: mathEditorContent
	}) });
});
//#endregion
//#region src/plugins/math/react/components/Placeholder.tsx
const Placeholder = ({ mathBlock }) => {
	const t = useTranslation();
	const node = /* @__PURE__ */ jsx(Text, {
		as: "span",
		className: cx("katex", styles$17.mathPlaceholder),
		fontSize: mathBlock ? "1.2em" : "1em",
		type: "secondary",
		children: t("math.placeholder")
	});
	if (!mathBlock) return node;
	return /* @__PURE__ */ jsx(Center, {
		padding: 18,
		width: "100%",
		children: node
	});
};
//#endregion
//#region src/plugins/math/react/components/MathInline.tsx
init_debug();
const logger = createDebugLogger("plugin", "math");
const MathInline = ({ editor, node, className }) => {
	const ref = useRef(null);
	const [isSelected, setIsSelected, clearSelected] = useLexicalNodeSelection(node.getKey());
	const [isEditing, setIsEditing] = useState(false);
	const isMathBlock = node instanceof MathBlockNode;
	useEffect(() => {
		if (ref.current && node.code) katex.render(node.code, ref.current, {
			displayMode: node instanceof MathBlockNode,
			throwOnError: false
		});
	}, [node.code]);
	useEffect(() => {
		const parent = editor.getElementByKey(node.getKey());
		if (parent) {
			const timeoutId = setTimeout(() => {
				if (isEditing) {
					addClassNamesToElement(parent, "editing");
					removeClassNamesFromElement(parent, "selected");
				} else if (isSelected) {
					addClassNamesToElement(parent, "selected");
					removeClassNamesFromElement(parent, "editing");
				} else {
					removeClassNamesFromElement(parent, "selected");
					removeClassNamesFromElement(parent, "editing");
				}
			}, 10);
			return () => clearTimeout(timeoutId);
		}
	}, [
		isSelected,
		isEditing,
		editor,
		node
	]);
	useLexicalEditor((editor) => {
		return editor.registerUpdateListener(() => {
			editor.getEditorState().read(() => {
				const selection = $getSelection();
				if (!$isNodeSelection(selection)) {
					setIsEditing(false);
					return;
				}
				const selectedNode = selection.getNodes()[0];
				if (!$isMathNode(selectedNode)) {
					setIsEditing(false);
					return;
				}
				if (selectedNode.getKey() === node.getKey()) setIsEditing(true);
				else setIsEditing(false);
			});
		});
	}, [node]);
	return /* @__PURE__ */ jsx("span", {
		className,
		onClick: useCallback((e) => {
			logger.debug("📊 Math click event:", e.target === ref.current);
			e.preventDefault();
			e.stopPropagation();
			if (isSelected) clearSelected();
			setIsSelected(true);
			editor.focus();
		}, [
			clearSelected,
			editor,
			isSelected,
			setIsSelected
		]),
		ref,
		children: node.code ? node.code : /* @__PURE__ */ jsx(Placeholder, { mathBlock: isMathBlock })
	});
};
//#endregion
//#region src/plugins/math/react/index.tsx
const ReactMathPlugin = ({ className, renderComp, theme }) => {
	const [editor] = useLexicalComposerContext();
	useLayoutEffect(() => {
		editor.registerPlugin(MarkdownPlugin);
		editor.registerPlugin(MathPlugin, {
			decorator: (node, editor) => {
				return /* @__PURE__ */ jsx(MathInline, {
					className,
					editor,
					node
				});
			},
			theme: theme || styles$17
		});
	}, [
		editor,
		className,
		theme,
		styles$17
	]);
	return /* @__PURE__ */ jsx(MathEdit, { renderComp });
};
ReactMathPlugin.displayName = "ReactMathPlugin";
//#endregion
//#region src/plugins/meta2d/node/index.ts
var Meta2dNode = class Meta2dNode extends DecoratorNode {
	static getType() {
		return "meta2d";
	}
	static clone(node) {
		return new Meta2dNode(node.__diagram, node.__svg, node.__key, node.__autoOpenEditor);
	}
	static importJSON(serializedNode) {
		return new Meta2dNode(serializedNode.diagram, serializedNode.svg);
	}
	constructor(diagram = "", svg = "", key, autoOpenEditor = false) {
		super(key);
		this.__diagram = diagram;
		this.__svg = svg;
		this.__autoOpenEditor = autoOpenEditor;
	}
	clearAutoOpenEditor() {
		const w = this.getWritable();
		w.__autoOpenEditor = false;
	}
	createDOM(config) {
		const element = document.createElement("div");
		addClassNamesToElement(element, config.theme.meta2d ?? "editor-meta2d");
		return element;
	}
	decorate(editor) {
		const decorator = getKernelFromEditor(editor)?.getDecorator(Meta2dNode.getType());
		if (!decorator) return null;
		if (typeof decorator === "function") return decorator(this, editor);
		return {
			queryDOM: decorator.queryDOM,
			render: decorator.render(this, editor)
		};
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			diagram: this.__diagram,
			svg: this.__svg
		};
	}
	getTextContent() {
		return `---meta2d---\n${this.__diagram}\n---/meta2d---\n`;
	}
	isInline() {
		return false;
	}
	updateDiagram(diagram, svg) {
		const writer = this.getWritable();
		writer.__diagram = diagram;
		writer.__svg = svg;
	}
	updateDOM() {
		return false;
	}
};
function $createMeta2dNode(diagram = "", svg = "", options) {
	return $applyNodeReplacement(new Meta2dNode(diagram, svg, void 0, options?.autoOpenEditor ?? false));
}
function $isMeta2dNode(node) {
	return node instanceof Meta2dNode;
}
//#endregion
//#region src/plugins/meta2d/command/index.ts
const INSERT_META2D_COMMAND = createCommand("INSERT_META2D_COMMAND");
function registerMeta2dCommand(editor) {
	return editor.registerCommand(INSERT_META2D_COMMAND, (payload) => {
		editor.update(() => {
			$insertNodes([$createMeta2dNode(payload?.diagram?.trim() || EMPTY_META2D_DIAGRAM_JSON, payload?.svg !== void 0 && payload.svg.trim() !== "" ? payload.svg : EMPTY_META2D_PLACEHOLDER_SVG, { autoOpenEditor: payload?.autoOpenEditor ?? true })]);
		});
		return true;
	}, COMMAND_PRIORITY_EDITOR);
}
//#endregion
//#region src/plugins/meta2d/plugin/index.ts
init_helper();
init_plugin();
const META2D_SHORTCUT = /^---meta2d---$/i;
const META2D_BLOCK = /---meta2d---(\\n?)([\S\s]*?)\n?---\/meta2d---/i;
function extractParagraphText(node) {
	return (node.children || []).map((child) => {
		if ("value" in child && typeof child.value === "string") return child.value;
		return "";
	}).join("");
}
const Meta2dPlugin = class extends KernelPlugin {
	static {
		this.pluginName = "Meta2dPlugin";
	}
	constructor(kernel, config) {
		super();
		this.kernel = kernel;
		this.config = config;
		kernel.registerNodes([Meta2dNode]);
		if (config?.theme) kernel.registerThemes(config.theme);
		this.registerDecorator(kernel, Meta2dNode.getType(), (node, editor) => {
			return config?.decorator ? config.decorator(node, editor) : null;
		});
	}
	onInit(editor) {
		this.register(registerMeta2dCommand(editor));
		this.registerMarkdown();
	}
	registerMarkdown() {
		const markdownService = this.kernel.requireService(IMarkdownShortCutService);
		if (!markdownService) return;
		markdownService.registerMarkdownShortCut({
			regExp: META2D_SHORTCUT,
			replace: (parentNode) => {
				const node = $createMeta2dNode(EMPTY_META2D_DIAGRAM_JSON, EMPTY_META2D_PLACEHOLDER_SVG, { autoOpenEditor: true });
				parentNode.replace(node);
				const selection = $createNodeSelection();
				selection.add(node.getKey());
				$setSelection(selection);
			},
			trigger: "enter",
			type: "element"
		});
		markdownService.registerMarkdownWriter(Meta2dNode.getType(), (ctx, node) => {
			const meta2dNode = node;
			ctx.appendLine("---meta2d---");
			ctx.appendLine(meta2dNode.__diagram || EMPTY_META2D_DIAGRAM_JSON);
			ctx.appendLine("---/meta2d---");
			return true;
		});
		markdownService.registerMarkdownReader("paragraph", (node) => {
			const match = extractParagraphText(node).match(META2D_BLOCK);
			if (!match) return false;
			const diagram = match[2]?.trim() || EMPTY_META2D_DIAGRAM_JSON;
			return INodeHelper.createTypeNode(Meta2dNode.getType(), {
				diagram,
				svg: initialSvgForDiagram(diagram)
			});
		}, 1);
	}
};
//#endregion
//#region src/plugins/meta2d/utils/meta2dManager.ts
let enginePromise = null;
function loadEngine() {
	enginePromise ??= import("./meta2dEngine-BD2XbzaV.js");
	return enginePromise;
}
async function generateSvgFromDiagram(diagramJson) {
	return (await loadEngine()).generateSvgFromDiagram(diagramJson);
}
//#endregion
//#region src/plugins/meta2d/react/DiagramPreview.tsx
/** Canvas2svg emits a large fixed width/height; without this the card clips to the top-left (overflow hidden). */
function injectPreviewSvgLayout(svg) {
	const t = svg.trimStart();
	if (!t.startsWith("<svg")) return svg;
	return t.replace(/^<svg\b/, "<svg style=\"max-width:100%;height:auto;display:block;margin:0 auto\" ");
}
function HudButton({ color, label, onClick, title }) {
	return /* @__PURE__ */ jsx("button", {
		onClick: (event) => {
			event.preventDefault();
			event.stopPropagation();
			onClick();
		},
		style: {
			alignItems: "center",
			background: "#fff",
			border: "1px solid #e5e5e5",
			borderRadius: 6,
			color,
			cursor: "pointer",
			display: "inline-flex",
			height: 28,
			justifyContent: "center",
			width: 28
		},
		title,
		type: "button",
		children: label
	});
}
function DiagramPreviewInner({ diagram, onDelete, onEdit, onSvgReady, svg }) {
	const [generating, setGenerating] = useState(false);
	const [generationError, setGenerationError] = useState(null);
	const [hovered, setHovered] = useState(false);
	const [generationFailed, setGenerationFailed] = useState(false);
	/** 避免 diagram 已更新但节点仍保留旧 svg 时缩略图不刷新；与上次成功生成预览的 diagram 一致时可跳过 */
	const previewSyncedForDiagramRef = useRef(null);
	useEffect(() => {
		setGenerationError(null);
		setGenerationFailed(false);
	}, [diagram]);
	useEffect(() => {
		if (!diagram || generationFailed || generating) return;
		if (svg) {
			previewSyncedForDiagramRef.current = diagram;
			return;
		}
		let active = true;
		const timeoutId = window.setTimeout(() => {
			if (!active) return;
			setGenerationError("Preview timeout (still loading). Double-click to open editor.");
			setGenerationFailed(true);
			setGenerating(false);
		}, 5e3);
		setGenerating(true);
		generateSvgFromDiagram(diagram).then((nextSvg) => {
			if (!active) return;
			window.clearTimeout(timeoutId);
			if (nextSvg) {
				previewSyncedForDiagramRef.current = diagram;
				onSvgReady(nextSvg);
				return;
			}
			setGenerationError("Preview generation failed. Double-click to open editor.");
			setGenerationFailed(true);
		}).finally(() => {
			if (active) setGenerating(false);
		});
		return () => {
			active = false;
			window.clearTimeout(timeoutId);
		};
	}, [
		diagram,
		generationFailed,
		onSvgReady,
		svg
	]);
	return /* @__PURE__ */ jsxs("div", {
		onDoubleClick: (event) => {
			event.stopPropagation();
			onEdit();
		},
		onMouseEnter: () => setHovered(true),
		onMouseLeave: () => setHovered(false),
		style: {
			background: "#fff",
			border: "1px solid #efefef",
			borderRadius: 10,
			cursor: "pointer",
			minHeight: 140,
			overflow: "hidden",
			padding: 10,
			position: "relative"
		},
		children: [hovered && !!svg && /* @__PURE__ */ jsxs("div", {
			style: {
				display: "flex",
				gap: 8,
				position: "absolute",
				right: 10,
				top: 10,
				zIndex: 1
			},
			children: [/* @__PURE__ */ jsx(HudButton, {
				color: "#1677ff",
				label: "✎",
				onClick: onEdit,
				title: "Edit diagram"
			}), /* @__PURE__ */ jsx(HudButton, {
				color: "#ff4d4f",
				label: "🗑",
				onClick: onDelete,
				title: "Delete diagram"
			})]
		}), svg ? /* @__PURE__ */ jsx("div", {
			style: {
				alignItems: "center",
				display: "flex",
				justifyContent: "center",
				maxHeight: 400,
				overflow: "auto",
				width: "100%"
			},
			children: /* @__PURE__ */ jsx("div", {
				dangerouslySetInnerHTML: { __html: injectPreviewSvgLayout(svg) },
				style: {
					lineHeight: 0,
					maxWidth: "100%",
					width: "100%"
				}
			})
		}) : /* @__PURE__ */ jsx("div", {
			style: {
				alignItems: "center",
				color: generationError ? "#cf1322" : "#999",
				display: "flex",
				justifyContent: "center",
				minHeight: 120,
				textAlign: "center"
			},
			children: generating ? "Generating preview..." : generationError || "Double-click to edit diagram"
		})]
	});
}
const DiagramPreview = memo(DiagramPreviewInner);
//#endregion
//#region src/plugins/meta2d/react/index.tsx
const DiagramEditor = lazy(async () => {
	return { default: (await import("./DiagramEditor-NtNY3sZL.js")).DiagramEditor };
});
function Meta2dDecorator({ className, editor: lexicalEditor, node }) {
	const [editing, setEditing] = useState(false);
	const diagram = node.__diagram;
	const svg = node.__svg;
	useLayoutEffect(() => {
		const key = node.getKey();
		let shouldOpen = false;
		lexicalEditor.getEditorState().read(() => {
			const latest = $getNodeByKey(key);
			if (latest && $isMeta2dNode(latest) && latest.__autoOpenEditor) shouldOpen = true;
		});
		if (shouldOpen) setEditing(true);
		if (shouldOpen) lexicalEditor.update(() => {
			const latest = $getNodeByKey(key);
			if (latest && $isMeta2dNode(latest) && latest.__autoOpenEditor) latest.clearAutoOpenEditor();
		});
	}, [lexicalEditor, node.getKey()]);
	const handleDelete = useCallback(() => {
		lexicalEditor.update(() => {
			const latest = node.getLatest();
			const next = latest.getNextSibling();
			const prev = latest.getPreviousSibling();
			latest.remove();
			if (next) {
				next.selectStart();
				return;
			}
			if (prev) prev.selectEnd();
		});
	}, [lexicalEditor, node]);
	const handleSave = useCallback((newDiagram, newSvg) => {
		lexicalEditor.update(() => {
			node.updateDiagram(newDiagram, newSvg);
		});
		setEditing(false);
	}, [lexicalEditor, node]);
	return /* @__PURE__ */ jsxs("div", {
		className,
		style: { margin: 0 },
		children: [/* @__PURE__ */ jsx(DiagramPreview, {
			diagram,
			onDelete: handleDelete,
			onEdit: () => setEditing(true),
			onSvgReady: useCallback((newSvg) => {
				lexicalEditor.update(() => {
					node.updateDiagram(node.__diagram, newSvg);
				});
			}, [lexicalEditor, node]),
			svg
		}), editing && /* @__PURE__ */ jsx(Suspense, {
			fallback: null,
			children: /* @__PURE__ */ jsx(DiagramEditor, {
				diagram,
				onClose: () => setEditing(false),
				onSave: handleSave
			})
		})]
	});
}
function ReactMeta2dPlugin({ className, theme }) {
	const [editor] = useLexicalComposerContext();
	const decorator = useCallback((node, lexicalEditor) => {
		return /* @__PURE__ */ jsx(Meta2dDecorator, {
			className,
			editor: lexicalEditor,
			node
		});
	}, [className]);
	useLayoutEffect(() => {
		editor.registerPlugin(Meta2dPlugin, {
			decorator,
			theme
		});
	}, [
		decorator,
		editor,
		theme
	]);
	return null;
}
//#endregion
//#region src/plugins/outline/react/OutlineContext.tsx
const OutlineVisibilityContext = createContext(null);
/** Supplies visibility state for {@link OutlineToolbar}, {@link useOutlineActionItem}, and {@link OutlinePanel}. */
const OutlineProvider = ({ children, defaultVisible = true }) => {
	const [visible, setVisible] = useState(defaultVisible);
	const toggle = useCallback(() => setVisible((v) => !v), []);
	const value = useMemo(() => ({
		setVisible,
		toggle,
		visible
	}), [toggle, visible]);
	return /* @__PURE__ */ jsx(OutlineVisibilityContext.Provider, {
		value,
		children
	});
};
OutlineProvider.displayName = "OutlineProvider";
/** @returns Context value when inside {@link OutlineProvider}, otherwise `null`. */
function useOutlineVisibilityContext() {
	return useContext(OutlineVisibilityContext);
}
/**
* Reads outline visibility inside {@link OutlineProvider}.
* @throws When used outside of a provider.
*/
function useOutlineVisibility() {
	const v = useOutlineVisibilityContext();
	if (!v) throw new Error("useOutlineVisibility must be used within <OutlineProvider>.");
	return v;
}
/**
* Resolves toggling from optional controlled props vs {@link OutlineProvider}.
* Use inside {@link OutlineToolbar} / {@link useOutlineActionItem}.
*/
function useOutlineVisibilityToggle(controlled) {
	const ctx = useOutlineVisibilityContext();
	const isControlled = controlled?.visible !== void 0 && controlled?.onVisibleChange !== void 0;
	return useMemo(() => {
		if (isControlled && controlled?.onVisibleChange) return {
			ready: true,
			toggle: () => controlled.onVisibleChange(!controlled.visible),
			visible: controlled.visible
		};
		if (ctx) return {
			ready: true,
			toggle: ctx.toggle,
			visible: ctx.visible
		};
		return { ready: false };
	}, [
		controlled?.onVisibleChange,
		controlled?.visible,
		ctx,
		isControlled
	]);
}
//#endregion
//#region src/plugins/outline/react/OutlinePanel.tsx
init_utils();
const OutlinePanel = ({ editor, visible: controlledVisible }) => {
	const visibilityCtx = useOutlineVisibilityContext();
	const outlineVisible = useMemo(() => {
		if (controlledVisible !== void 0) return controlledVisible;
		return visibilityCtx?.visible ?? true;
	}, [controlledVisible, visibilityCtx?.visible]);
	const [headings, setHeadings] = useState([]);
	const $buildHeadings = useCallback(() => {
		const items = [];
		const root = $getRoot();
		const walk = (nodes) => {
			for (const node of nodes) {
				if ($isHeadingNode(node)) {
					const text = node.getTextContent().trim();
					if (text) items.push({
						key: node.getKey(),
						level: parseInt(node.getTag()[1], 10),
						text
					});
				}
				if ($isElementNode(node)) {
					const children = node.getChildren();
					if (children.length > 0) walk(children);
				}
			}
		};
		walk(root.getChildren());
		setHeadings(items);
	}, []);
	useEffect(() => {
		const lexicalEditor = editor.getLexicalEditor();
		let cleanup = noop;
		const handleLexicalEditor = (lexicalEditor) => {
			cleanup = lexicalEditor.registerUpdateListener(({ editorState }) => {
				editorState.read($buildHeadings);
			});
			lexicalEditor.getEditorState().read($buildHeadings);
			return cleanup;
		};
		if (lexicalEditor) return handleLexicalEditor(lexicalEditor);
		editor.on("initialized", handleLexicalEditor);
		return () => {
			cleanup();
			editor.off("initialized", handleLexicalEditor);
		};
	}, [editor, $buildHeadings]);
	const handleClick = useCallback((key) => {
		const lexicalEditor = editor.getLexicalEditor();
		if (!lexicalEditor) return;
		lexicalEditor.update(() => {
			const selection = $createNodeSelection();
			selection.add(key);
			$setSelection(selection);
		});
		requestAnimationFrame(() => {
			const element = lexicalEditor.getElementByKey(key);
			if (element) element.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
		});
	}, [editor]);
	if (!outlineVisible || headings.length === 0) return null;
	return /* @__PURE__ */ jsxs("div", {
		style: {
			borderLeft: "1px solid rgba(0, 0, 0, 0.08)",
			paddingLeft: 12
		},
		children: [/* @__PURE__ */ jsx("div", {
			style: {
				color: "rgba(0,0,0,0.45)",
				fontSize: 12,
				fontWeight: 600,
				marginBottom: 8
			},
			children: "OUTLINE"
		}), headings.map((h) => /* @__PURE__ */ jsx("div", {
			onClick: () => handleClick(h.key),
			onMouseEnter: (e) => {
				e.currentTarget.style.background = "rgba(0,0,0,0.04)";
			},
			onMouseLeave: (e) => {
				e.currentTarget.style.background = "transparent";
			},
			style: {
				borderRadius: 4,
				color: "rgba(0,0,0,0.75)",
				cursor: "pointer",
				fontSize: 13,
				lineHeight: "28px",
				overflow: "hidden",
				paddingLeft: (h.level - 1) * 16 + 8,
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			},
			children: h.text
		}, h.key))]
	});
};
//#endregion
//#region src/plugins/outline/react/OutlineToolbar.tsx
const defaultCollapseTitle$1 = "Hide outline";
const defaultExpandTitle$1 = "Show outline";
/**
* Toolbar control that toggles outline visibility.
* Prefer {@link useOutlineActionItem} when merging into a ChatInputActions item list (see toolbar demo).
*
* Either wrap the tree with {@link OutlineProvider}, or pass `visible` / `onVisibleChange`
* together with the same props on {@link OutlinePanel}.
*/
const OutlineToolbar = ({ className, collapseTitle = defaultCollapseTitle$1, expandTitle = defaultExpandTitle$1, visible: controlledVisible, onVisibleChange, style }) => {
	const toggleApi = useOutlineVisibilityToggle(controlledVisible !== void 0 && onVisibleChange !== void 0 ? {
		onVisibleChange,
		visible: controlledVisible
	} : void 0);
	const handleClick = useCallback(() => {
		if (toggleApi.ready) toggleApi.toggle();
	}, [toggleApi]);
	const canToggle = toggleApi.ready;
	const visible = toggleApi.ready ? toggleApi.visible : false;
	return /* @__PURE__ */ jsx(Flexbox, {
		align: "center",
		className,
		"data-outline-toolbar": "outline",
		horizontal: true,
		style,
		children: /* @__PURE__ */ jsx(ActionIcon, {
			disabled: !canToggle,
			icon: visible ? PanelRightCloseIcon : ListTreeIcon,
			onClick: handleClick,
			size: {
				blockSize: 36,
				size: 20
			},
			title: visible ? collapseTitle : expandTitle,
			tooltipProps: { placement: "top" }
		})
	});
};
OutlineToolbar.displayName = "OutlineToolbar";
//#endregion
//#region src/plugins/outline/react/useOutlineActionItem.ts
const defaultCollapseTitle = "Hide outline";
const defaultExpandTitle = "Show outline";
const outlineActionKey = "outline";
/**
* Returns a {@link ChatInputActions} toolbar item that toggles outline visibility
* via {@link OutlineProvider} or `visible` + `onVisibleChange`.
* Returns `null` when no provider/control is configured — omit from `items`.
*/
function useOutlineActionItem(props) {
	const { collapseTitle = defaultCollapseTitle, expandTitle = defaultExpandTitle, onVisibleChange, visible: controlledVisible } = props ?? {};
	const toggleApi = useOutlineVisibilityToggle(controlledVisible !== void 0 && onVisibleChange !== void 0 ? {
		onVisibleChange,
		visible: controlledVisible
	} : void 0);
	return useMemo(() => {
		if (!toggleApi.ready) return null;
		const { toggle, visible } = toggleApi;
		return {
			active: visible,
			icon: visible ? PanelRightCloseIcon : ListTreeIcon,
			key: outlineActionKey,
			label: visible ? collapseTitle : expandTitle,
			onClick: toggle
		};
	}, [
		collapseTitle,
		expandTitle,
		toggleApi
	]);
}
//#endregion
//#region src/plugins/table/utils/index.ts
init_utils();
function $forEachTableCell(grid, cb) {
	const { domRows } = grid;
	for (const [y, row] of domRows.entries()) {
		if (!row) continue;
		for (const [x, cell] of row.entries()) {
			if (!cell) continue;
			const lexicalNode = $getNearestNodeFromDOMNode$1(cell.elem);
			if (lexicalNode !== null) cb(cell, lexicalNode, {
				x,
				y
			});
		}
	}
}
function $addHighlightToDOM(editor, cell) {
	const element = cell.elem;
	const editorThemeClasses = editor._config.theme;
	assert($isTableCellNode($getNearestNodeFromDOMNode$1(element)), "Expected to find LexicalNode from Table Cell DOMNode");
	addClassNamesToElement(element, editorThemeClasses.tableCellSelected);
}
function $removeHighlightFromDOM(editor, cell) {
	const element = cell.elem;
	assert($isTableCellNode($getNearestNodeFromDOMNode$1(element)), "Expected to find LexicalNode from Table Cell DOMNode");
	const editorThemeClasses = editor._config.theme;
	removeClassNamesFromElement(element, editorThemeClasses.tableCellSelected);
}
function $updateDOMForSelection(editor, table, selection) {
	const selectedCellNodes = new Set(selection ? selection.getNodes() : []);
	$forEachTableCell(table, (cell, lexicalNode) => {
		const elem = cell.elem;
		if (selectedCellNodes.has(lexicalNode)) {
			cell.highlighted = true;
			$addHighlightToDOM(editor, cell);
		} else {
			cell.highlighted = false;
			$removeHighlightFromDOM(editor, cell);
			if (!elem.getAttribute("style")) elem.removeAttribute("style");
		}
	});
}
//#endregion
//#region src/plugins/table/react/TableActionMenu/utils.ts
function computeSelectionCount(selection) {
	const selectionShape = selection.getShape();
	return {
		columns: selectionShape.toX - selectionShape.fromX + 1,
		rows: selectionShape.toY - selectionShape.fromY + 1
	};
}
function $canUnmerge() {
	const selection = $getSelection();
	if ($isRangeSelection(selection) && !selection.isCollapsed() || $isTableSelection(selection) && !selection.anchor.is(selection.focus) || !$isRangeSelection(selection) && !$isTableSelection(selection)) return false;
	const [cell] = $getNodeTriplet(selection.anchor);
	return cell.__colSpan > 1 || cell.__rowSpan > 1;
}
function $selectLastDescendant(node) {
	const lastDescendant = node.getLastDescendant();
	if ($isTextNode(lastDescendant)) lastDescendant.select();
	else if ($isElementNode(lastDescendant)) lastDescendant.selectEnd();
	else if (lastDescendant !== null) lastDescendant.selectNext();
}
function currentCellBackgroundColor(editor) {
	return editor.getEditorState().read(() => {
		const selection = $getSelection();
		if ($isRangeSelection(selection) || $isTableSelection(selection)) {
			const [cell] = $getNodeTriplet(selection.anchor);
			if ($isTableCellNode(cell)) return cell.getBackgroundColor();
		}
		return null;
	});
}
//#endregion
//#region src/plugins/table/react/TableActionMenu/ActionMenu.tsx
/**
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*
*/
const TableActionMenu$1 = memo(({ editor, tableCellNode: _tableCellNode, cellMerge, children }) => {
	const [tableCellNode, updateTableCellNode] = useState(_tableCellNode);
	const [selectionCounts, updateSelectionCounts] = useState({
		columns: 1,
		rows: 1
	});
	const [canMergeCells, setCanMergeCells] = useState(false);
	const [canUnmergeCell, setCanUnmergeCell] = useState(false);
	const [, setBackgroundColor] = useState(() => currentCellBackgroundColor(editor) || "");
	const t = useTranslation();
	useEffect(() => {
		return editor.registerMutationListener(TableCellNode, (nodeMutations) => {
			if (nodeMutations.get(tableCellNode.getKey()) === "updated") {
				editor.getEditorState().read(() => {
					updateTableCellNode(tableCellNode.getLatest());
				});
				setBackgroundColor(currentCellBackgroundColor(editor) || "");
			}
		}, { skipInitialization: true });
	}, [editor, tableCellNode]);
	useEffect(() => {
		editor.getEditorState().read(() => {
			const selection = $getSelection();
			if ($isTableSelection(selection)) {
				const currentSelectionCounts = computeSelectionCount(selection);
				updateSelectionCounts(computeSelectionCount(selection));
				setCanMergeCells(currentSelectionCounts.columns > 1 || currentSelectionCounts.rows > 1);
			}
			setCanUnmergeCell($canUnmerge());
		});
	}, [editor]);
	const clearTableSelection = useCallback(() => {
		editor.update(() => {
			if (tableCellNode.isAttached()) {
				const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
				const tableElement = getTableElement(tableNode, editor.getElementByKey(tableNode.getKey()));
				if (tableElement === null) throw new Error("TableActionMenu: Expected to find tableElement in DOM");
				const tableObserver = getTableObserverFromTableElement(tableElement);
				if (tableObserver !== null) tableObserver.$clearHighlight();
				tableNode.markDirty();
				updateTableCellNode(tableCellNode.getLatest());
			}
			$setSelection(null);
		});
	}, [editor, tableCellNode]);
	const mergeTableCellsAtSelection = () => {
		editor.update(() => {
			const selection = $getSelection();
			if (!$isTableSelection(selection)) return;
			const targetCell = $mergeCells(selection.getNodes().filter($isTableCellNode));
			if (targetCell) $selectLastDescendant(targetCell);
		});
	};
	const unmergeTableCellsAtSelection = () => {
		editor.update(() => {
			$unmergeCell();
		});
	};
	const insertTableRowAtSelection = useCallback((shouldInsertAfter) => {
		editor.update(() => {
			for (let i = 0; i < selectionCounts.rows; i++) $insertTableRowAtSelection(shouldInsertAfter);
		});
	}, [editor, selectionCounts.rows]);
	const insertTableColumnAtSelection = useCallback((shouldInsertAfter) => {
		editor.update(() => {
			for (let i = 0; i < selectionCounts.columns; i++) $insertTableColumnAtSelection(shouldInsertAfter);
		});
	}, [editor, selectionCounts.columns]);
	const deleteTableRowAtSelection = useCallback(() => {
		editor.update(() => {
			$deleteTableRowAtSelection();
		});
	}, [editor]);
	const deleteTableAtSelection = useCallback(() => {
		editor.update(() => {
			$getTableNodeFromLexicalNodeOrThrow(tableCellNode).remove();
			clearTableSelection();
		});
	}, [
		editor,
		tableCellNode,
		clearTableSelection
	]);
	const deleteTableColumnAtSelection = useCallback(() => {
		editor.update(() => {
			$deleteTableColumnAtSelection();
		});
	}, [editor]);
	const toggleTableRowIsHeader = useCallback(() => {
		editor.update(() => {
			const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
			const tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
			const [gridMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
			const rowCells = /* @__PURE__ */ new Set();
			const newStyle = tableCellNode.getHeaderStyles() ^ TableCellHeaderStates.ROW;
			for (let col = 0; col < gridMap[tableRowIndex].length; col++) {
				const mapCell = gridMap[tableRowIndex][col];
				if (!mapCell?.cell) continue;
				if (!rowCells.has(mapCell.cell)) {
					rowCells.add(mapCell.cell);
					mapCell.cell.setHeaderStyles(newStyle, TableCellHeaderStates.ROW);
				}
			}
			clearTableSelection();
		});
	}, [
		editor,
		tableCellNode,
		clearTableSelection
	]);
	const toggleTableColumnIsHeader = useCallback(() => {
		editor.update(() => {
			const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
			const tableColumnIndex = $getTableColumnIndexFromTableCellNode(tableCellNode);
			const [gridMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
			const columnCells = /* @__PURE__ */ new Set();
			const newStyle = tableCellNode.getHeaderStyles() ^ TableCellHeaderStates.COLUMN;
			for (const element of gridMap) {
				const mapCell = element[tableColumnIndex];
				if (!mapCell?.cell) continue;
				if (!columnCells.has(mapCell.cell)) {
					columnCells.add(mapCell.cell);
					mapCell.cell.setHeaderStyles(newStyle, TableCellHeaderStates.COLUMN);
				}
			}
			clearTableSelection();
		});
	}, [
		editor,
		tableCellNode,
		clearTableSelection
	]);
	return /* @__PURE__ */ jsx(Dropdown, {
		menu: { items: useMemo(() => {
			return [
				{
					icon: PanelTopCloseIcon,
					key: "table-insert-row-above",
					label: t(`table.insertRowAbove`, { count: selectionCounts.rows }),
					onClick: () => insertTableRowAtSelection(false)
				},
				{
					icon: PanelBottomCloseIcon,
					key: "table-insert-row-below",
					label: t(`table.insertRowBelow`, { count: selectionCounts.rows }),
					onClick: () => insertTableRowAtSelection(true)
				},
				{ type: "divider" },
				{
					icon: PanelLeftCloseIcon,
					key: "table-insert-column-before",
					label: t(`table.insertColumnLeft`, { count: selectionCounts.columns }),
					onClick: () => insertTableColumnAtSelection(false)
				},
				{
					icon: PanelRightCloseIcon,
					key: "table-insert-column-after",
					label: t(`table.insertColumnRight`, { count: selectionCounts.columns }),
					onClick: () => insertTableColumnAtSelection(true)
				},
				{ type: "divider" },
				{
					icon: TableColumnsSplitIcon,
					key: "table-delete-columns",
					label: t(`table.deleteColumn`),
					onClick: () => deleteTableColumnAtSelection()
				},
				{
					icon: TableRowsSplitIcon,
					key: "table-delete-rows",
					label: t(`table.deleteRow`),
					onClick: () => deleteTableRowAtSelection()
				},
				{ type: "divider" },
				{
					icon: Grid2X2XIcon,
					key: "table-delete",
					label: t(`table.delete`),
					onClick: () => deleteTableAtSelection()
				}
			];
		}, [
			cellMerge,
			canMergeCells,
			canUnmergeCell,
			selectionCounts.rows,
			selectionCounts.columns,
			tableCellNode.__headerState,
			mergeTableCellsAtSelection,
			unmergeTableCellsAtSelection,
			insertTableRowAtSelection,
			insertTableColumnAtSelection,
			deleteTableColumnAtSelection,
			deleteTableRowAtSelection,
			deleteTableAtSelection,
			toggleTableRowIsHeader,
			toggleTableColumnIsHeader
		]) },
		children
	});
});
TableActionMenu$1.displayName = "TableActionMenu";
//#endregion
//#region src/plugins/table/react/TableActionMenu/style.ts
const styles$3 = createStaticStyles(({ css }) => ({
	actionIcon: css`
    transform: translateX(2px);
  `,
	root: css`
    will-change: transform;

    position: absolute;
    z-index: 3;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform: translateY(100%);

    padding: 2px;
  `
}));
//#endregion
//#region src/plugins/table/react/TableActionMenu/index.tsx
/**
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*
*/
const TableActionMenu = memo(({ cellMerge, editor }) => {
	const anchorElem = useAnchor();
	const menuButtonRef = useRef(null);
	const [tableCellNode, setTableMenuCellNode] = useState(null);
	const checkTableCellOverflow = useCallback((tableCellParentNodeDOM) => {
		const scrollableContainer = tableCellParentNodeDOM.closest(".PlaygroundEditorTheme__tableScrollableWrapper");
		if (scrollableContainer) {
			const containerRect = scrollableContainer.getBoundingClientRect();
			const actionButtonRight = tableCellParentNodeDOM.getBoundingClientRect().right - 5;
			const actionButtonLeft = actionButtonRight - 28;
			if (actionButtonRight > containerRect.right || actionButtonLeft < containerRect.left) return true;
		}
		return false;
	}, []);
	const $moveMenu = useCallback(() => {
		const menu = menuButtonRef.current;
		const selection = $getSelection();
		const nativeSelection = getDOMSelection(editor._window);
		const activeElement = typeof document !== "undefined" ? document.activeElement : null;
		function disable() {
			if (menu) {
				menu.classList.remove("table-cell-action-button-container--active");
				menu.classList.add("table-cell-action-button-container--inactive");
			}
			setTableMenuCellNode(null);
		}
		if (!selection || !menu) return disable();
		const rootElement = editor.getRootElement();
		let tableObserver = null;
		let tableCellParentNodeDOM = null;
		if ($isRangeSelection(selection) && rootElement !== null && nativeSelection !== null && rootElement.contains(nativeSelection.anchorNode)) {
			const tableCellNodeFromSelection = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
			if (!tableCellNodeFromSelection) return disable();
			tableCellParentNodeDOM = editor.getElementByKey(tableCellNodeFromSelection.getKey());
			if (!tableCellParentNodeDOM || !tableCellNodeFromSelection.isAttached()) return disable();
			if (checkTableCellOverflow(tableCellParentNodeDOM)) return disable();
			const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNodeFromSelection);
			const tableElement = getTableElement(tableNode, editor.getElementByKey(tableNode.getKey()));
			if (tableElement === null) throw new Error("TableActionMenu: Expected to find tableElement in DOM");
			tableObserver = getTableObserverFromTableElement(tableElement);
			setTableMenuCellNode(tableCellNodeFromSelection);
		} else if ($isTableSelection(selection)) {
			const anchorNode = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
			if (!$isTableCellNode(anchorNode)) throw new Error("TableSelection anchorNode must be a TableCellNode");
			const tableNode = $getTableNodeFromLexicalNodeOrThrow(anchorNode);
			const tableElement = getTableElement(tableNode, editor.getElementByKey(tableNode.getKey()));
			if (tableElement === null) throw new Error("TableActionMenu: Expected to find tableElement in DOM");
			tableObserver = getTableObserverFromTableElement(tableElement);
			tableCellParentNodeDOM = editor.getElementByKey(anchorNode.getKey());
			if (tableCellParentNodeDOM === null) return disable();
			if (checkTableCellOverflow(tableCellParentNodeDOM)) return disable();
		} else if (!activeElement) return disable();
		if (tableObserver === null || tableCellParentNodeDOM === null) return disable();
		const enabled = !tableObserver || !tableObserver.isSelecting;
		menu.classList.toggle("table-cell-action-button-container--active", enabled);
		menu.classList.toggle("table-cell-action-button-container--inactive", !enabled);
		if (enabled) updatePosition({
			floating: menu,
			offset: 0,
			placement: "top-end",
			reference: tableCellParentNodeDOM
		});
		else cleanPosition(menu);
	}, [
		editor,
		anchorElem,
		checkTableCellOverflow
	]);
	useEffect(() => {
		let timeoutId = void 0;
		const callback = () => {
			timeoutId = void 0;
			editor.getEditorState().read($moveMenu);
		};
		const delayedCallback = () => {
			if (timeoutId === void 0) timeoutId = setTimeout(callback, 0);
			return false;
		};
		return mergeRegister(editor.registerUpdateListener(delayedCallback), editor.registerCommand(SELECTION_CHANGE_COMMAND, delayedCallback, COMMAND_PRIORITY_CRITICAL), editor.registerRootListener((rootElement, prevRootElement) => {
			if (prevRootElement) prevRootElement.removeEventListener("pointerup", delayedCallback);
			if (rootElement) {
				rootElement.addEventListener("pointerup", delayedCallback);
				delayedCallback();
			}
		}), () => clearTimeout(timeoutId));
	});
	const prevTableCellDOM = useRef(tableCellNode);
	useEffect(() => {
		prevTableCellDOM.current = tableCellNode;
	}, [prevTableCellDOM, tableCellNode]);
	return /* @__PURE__ */ jsx("div", {
		className: styles$3.root,
		ref: menuButtonRef,
		children: tableCellNode && /* @__PURE__ */ jsx(TableActionMenu$1, {
			cellMerge,
			editor,
			tableCellNode,
			children: /* @__PURE__ */ jsx(ActionIcon, {
				className: styles$3.actionIcon,
				glass: true,
				icon: ChevronDown,
				size: 12,
				variant: "filled"
			})
		})
	});
});
//#endregion
//#region src/plugins/table/react/TableHoverActions/style.ts
const styles$2 = createStaticStyles(({ css }) => {
	return {
		tableAddColumns: css`
      position: absolute;
    `,
		tableAddRows: css`
      position: absolute;
    `
	};
});
//#endregion
//#region src/plugins/table/react/TableHoverActions/utils.ts
function getThemeSelector(iEditor, name) {
	const className = iEditor.getTheme()?.[name];
	if (typeof className !== "string") throw new Error(`getThemeClass: required theme property ${name} not defined`);
	return className.split(/\s+/g).map((cls) => `.${cls}`).join(",");
}
function getMouseInfo(event, iEditor) {
	const target = event.target;
	const tableCellClass = getThemeSelector(iEditor, "tableCell");
	if (isHTMLElement(target)) {
		const tableDOMNode = target.closest(`td${tableCellClass}, th${tableCellClass}`);
		return {
			isOutside: !(tableDOMNode || target.closest(`div.tableAddRows`) || target.closest(`div.tableAddColumns`) || target.closest("div.TableCellResizer__resizer")),
			tableDOMNode
		};
	} else return {
		isOutside: true,
		tableDOMNode: null
	};
}
function useDebounce(fn, ms, maxWait) {
	const funcRef = useRef(null);
	funcRef.current = fn;
	return useMemo(() => debounce((...args) => {
		if (funcRef.current) funcRef.current(...args);
	}, ms, { maxWait }), [ms, maxWait]);
}
//#endregion
//#region src/plugins/table/react/TableHoverActions/index.tsx
const TableHoverActions = memo(({ editor }) => {
	const anchorElem = useAnchor();
	const [iEditor] = useLexicalComposerContext();
	const [isShownRow, setShownRow] = useState(false);
	const [isShownColumn, setShownColumn] = useState(false);
	const [shouldListenMouseMove, setShouldListenMouseMove] = useState(false);
	const [position, setPosition] = useState({});
	const tableSetRef = useRef(/* @__PURE__ */ new Set());
	const tableCellDOMNodeRef = useRef(null);
	const debouncedOnMouseMove = useDebounce((event) => {
		const { isOutside, tableDOMNode } = getMouseInfo(event, iEditor);
		if (isOutside) {
			setShownRow(false);
			setShownColumn(false);
			return;
		}
		if (!tableDOMNode) return;
		tableCellDOMNodeRef.current = tableDOMNode;
		let hoveredRowNode = null;
		let hoveredColumnNode = null;
		let tableDOMElement = null;
		editor.getEditorState().read(() => {
			const maybeTableCell = $getNearestNodeFromDOMNode$1(tableDOMNode);
			if ($isTableCellNode(maybeTableCell)) {
				const table = $findMatchingParent(maybeTableCell, (node) => $isTableNode(node));
				if (!$isTableNode(table)) return;
				tableDOMElement = getTableElement(table, editor.getElementByKey(table.getKey()));
				if (tableDOMElement) {
					const rowCount = table.getChildrenSize();
					const colCount = table.getChildAtIndex(0)?.getChildrenSize();
					const rowIndex = $getTableRowIndexFromTableCellNode(maybeTableCell);
					const colIndex = $getTableColumnIndexFromTableCellNode(maybeTableCell);
					if (rowIndex === rowCount - 1) hoveredRowNode = maybeTableCell;
					else if (colIndex === colCount - 1) hoveredColumnNode = maybeTableCell;
				}
			}
		}, { editor });
		if (tableDOMElement && anchorElem) {
			const { y: tableElemY, right: tableElemRight, left: tableElemLeft, bottom: tableElemBottom } = tableDOMElement.getBoundingClientRect();
			const parentElement = tableDOMElement.parentElement;
			let tableHasScroll = false;
			if (parentElement && parentElement.classList.contains("PlaygroundEditorTheme__tableScrollableWrapper")) tableHasScroll = parentElement.scrollWidth > parentElement.clientWidth;
			const { y: editorElemY, left: editorElemLeft } = anchorElem.getBoundingClientRect();
			if (hoveredRowNode) {
				setShownColumn(false);
				setShownRow(true);
				setPosition({
					left: tableHasScroll && parentElement ? parentElement.offsetLeft : tableElemLeft - editorElemLeft,
					top: tableElemBottom - editorElemY + 5
				});
			} else if (hoveredColumnNode) {
				setShownColumn(true);
				setShownRow(false);
				setPosition({
					left: tableElemRight - editorElemLeft + 5,
					top: tableElemY - editorElemY
				});
			}
		}
	}, 50, 250);
	const tableResizeObserver = useMemo(() => {
		return new ResizeObserver(() => {
			setShownRow(false);
			setShownColumn(false);
		});
	}, []);
	useEffect(() => {
		if (!shouldListenMouseMove) return;
		if (typeof document !== "undefined") document.addEventListener("mousemove", debouncedOnMouseMove);
		return () => {
			setShownRow(false);
			setShownColumn(false);
			if (typeof document !== "undefined") document.removeEventListener("mousemove", debouncedOnMouseMove);
		};
	}, [shouldListenMouseMove, debouncedOnMouseMove]);
	useEffect(() => {
		return mergeRegister(editor.registerMutationListener(TableNode, (mutations) => {
			editor.getEditorState().read(() => {
				let resetObserver = false;
				for (const [key, type] of mutations) switch (type) {
					case "created":
						tableSetRef.current.add(key);
						resetObserver = true;
						break;
					case "destroyed":
						tableSetRef.current.delete(key);
						resetObserver = true;
						break;
					default: break;
				}
				if (resetObserver) {
					tableResizeObserver.disconnect();
					for (const tableKey of tableSetRef.current) {
						const { tableElement } = $getTableAndElementByKey(tableKey);
						tableResizeObserver.observe(tableElement);
					}
					setShouldListenMouseMove(tableSetRef.current.size > 0);
				}
			}, { editor });
		}, { skipInitialization: false }));
	}, [editor, tableResizeObserver]);
	const insertAction = (insertRow) => {
		editor.update(() => {
			if (tableCellDOMNodeRef.current) {
				$getNearestNodeFromDOMNode$1(tableCellDOMNodeRef.current)?.selectEnd();
				if (insertRow) {
					$insertTableRowAtSelection();
					setShownRow(false);
				} else {
					$insertTableColumnAtSelection();
					setShownColumn(false);
				}
			}
		});
	};
	return /* @__PURE__ */ jsxs("div", { children: [isShownRow && /* @__PURE__ */ jsx(ActionIcon, {
		className: cx("tableAddRows", styles$2.tableAddRows),
		icon: PlusIcon,
		onClick: () => insertAction(isShownRow),
		size: "small",
		style: { ...position },
		variant: "filled"
	}), isShownColumn && /* @__PURE__ */ jsx(ActionIcon, {
		className: cx("tableAddColumns", styles$2.tableAddColumns),
		icon: PlusIcon,
		onClick: () => insertAction(false),
		size: "small",
		style: { ...position },
		variant: "filled"
	})] });
});
TableHoverActions.displayName = "TableHoverActions";
//#endregion
//#region src/plugins/table/react/TableResize/style.ts
const styles$1 = createStaticStyles(({ css, cssVar }) => {
	return css`
    touch-action: none;
    position: absolute;
    z-index: 1;

    @media (pointer: coarse) {
      background-color: ${cssVar.colorPrimary};
      mix-blend-mode: color;
    }
  `;
});
//#endregion
//#region src/plugins/table/react/TableResize/utils.ts
const getCellColumnIndex = (tableCellNode, tableMap) => {
	for (const element of tableMap) for (const [column, element_] of element.entries()) if (element_.cell === tableCellNode) return column;
};
const getCellNodeHeight = (cell, activeEditor) => {
	return activeEditor.getElementByKey(cell.getKey())?.clientHeight;
};
//#endregion
//#region src/plugins/table/react/TableResize/index.tsx
const TableCellResize = memo(({ editor, eventEmitter }) => {
	const targetRef = useRef(null);
	const resizerRef = useRef(null);
	const tableRectRef = useRef(null);
	const [hasTable, setHasTable] = useState(false);
	const pointerStartPosRef = useRef(null);
	const [pointerCurrentPos, updatePointerCurrentPos] = useState(null);
	const [activeCell, updateActiveCell] = useState(null);
	const [draggingDirection, updateDraggingDirection] = useState(null);
	const resetState = useCallback(() => {
		updateActiveCell(null);
		targetRef.current = null;
		updateDraggingDirection(null);
		pointerStartPosRef.current = null;
		tableRectRef.current = null;
	}, []);
	useEffect(() => {
		const tableKeys = /* @__PURE__ */ new Set();
		return mergeRegister(editor.registerMutationListener(TableNode, (nodeMutations) => {
			for (const [nodeKey, mutation] of nodeMutations) if (mutation === "destroyed") tableKeys.delete(nodeKey);
			else tableKeys.add(nodeKey);
			setHasTable(tableKeys.size > 0);
		}), editor.registerNodeTransform(TableNode, (tableNode) => {
			if (tableNode.getColWidths()) return tableNode;
			const numColumns = tableNode.getColumnCount();
			tableNode.setColWidths(new Array(numColumns).fill(92));
			return tableNode;
		}));
	}, [editor]);
	useEffect(() => {
		if (!hasTable) return;
		const onPointerMove = (event) => {
			const target = event.target;
			if (!isHTMLElement(target)) return;
			if (draggingDirection) {
				event.preventDefault();
				event.stopPropagation();
				updatePointerCurrentPos({
					x: event.clientX,
					y: event.clientY
				});
				return;
			}
			if (resizerRef.current && resizerRef.current.contains(target)) return;
			if (targetRef.current !== target) {
				targetRef.current = target;
				const cell = getDOMCellFromTarget(target);
				if (cell && activeCell !== cell) editor.getEditorState().read(() => {
					const tableCellNode = $getNearestNodeFromDOMNode$1(cell.elem);
					if (!tableCellNode) throw new Error("TableCellResizer: Table cell node not found.");
					const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
					const tableElement = getTableElement(tableNode, editor.getElementByKey(tableNode.getKey()));
					if (!tableElement) throw new Error("TableCellResizer: Table element not found.");
					targetRef.current = target;
					tableRectRef.current = tableElement.getBoundingClientRect();
					updateActiveCell(cell);
				}, { editor });
				else if (!cell) resetState();
			}
		};
		const onPointerDown = (event) => {
			if (event.pointerType === "touch") onPointerMove(event);
		};
		const resizerContainer = resizerRef.current;
		resizerContainer?.addEventListener("pointermove", onPointerMove, { capture: true });
		const removeRootListener = editor.registerRootListener((rootElement, prevRootElement) => {
			prevRootElement?.removeEventListener("pointermove", onPointerMove);
			prevRootElement?.removeEventListener("pointerdown", onPointerDown);
			rootElement?.addEventListener("pointermove", onPointerMove);
			rootElement?.addEventListener("pointerdown", onPointerDown);
		});
		return () => {
			removeRootListener();
			resizerContainer?.removeEventListener("pointermove", onPointerMove);
		};
	}, [
		activeCell,
		draggingDirection,
		editor,
		resetState,
		hasTable
	]);
	const isHeightChanging = (direction) => {
		if (direction === "bottom") return true;
		return false;
	};
	const updateRowHeight = useCallback((heightChange) => {
		if (!activeCell) throw new Error("TableCellResizer: Expected active cell.");
		editor.update(() => {
			const tableCellNode = $getNearestNodeFromDOMNode$1(activeCell.elem);
			if (!$isTableCellNode(tableCellNode)) throw new Error("TableCellResizer: Table cell node not found.");
			const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
			const baseRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
			const tableRows = tableNode.getChildren();
			const tableRowIndex = tableCellNode.getColSpan() === tableNode.getColumnCount() ? baseRowIndex : baseRowIndex + tableCellNode.getRowSpan() - 1;
			if (tableRowIndex >= tableRows.length || tableRowIndex < 0) throw new Error("Expected table cell to be inside of table row.");
			const tableRow = tableRows[tableRowIndex];
			if (!$isTableRowNode(tableRow)) throw new Error("Expected table row");
			let height = tableRow.getHeight();
			if (height === void 0) {
				const rowCells = tableRow.getChildren();
				height = Math.min(...rowCells.map((cell) => getCellNodeHeight(cell, editor) ?? Infinity));
			}
			const newHeight = Math.max(height + heightChange, 33);
			tableRow.setHeight(newHeight);
			eventEmitter.emit("table:resize", {
				heightChange,
				newHeight
			});
		}, { tag: SKIP_SCROLL_INTO_VIEW_TAG });
	}, [activeCell, editor]);
	const updateColumnWidth = useCallback((widthChange) => {
		if (!activeCell) throw new Error("TableCellResizer: Expected active cell.");
		editor.update(() => {
			const tableCellNode = $getNearestNodeFromDOMNode$1(activeCell.elem);
			if (!$isTableCellNode(tableCellNode)) throw new Error("TableCellResizer: Table cell node not found.");
			const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
			const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
			const columnIndex = getCellColumnIndex(tableCellNode, tableMap);
			if (columnIndex === void 0) throw new Error("TableCellResizer: Table column not found.");
			const colWidths = tableNode.getColWidths();
			if (!colWidths) return;
			const width = colWidths[columnIndex];
			if (width === void 0) return;
			const newColWidths = [...colWidths];
			newColWidths[columnIndex] = Math.max(width + widthChange, 92);
			tableNode.setColWidths(newColWidths);
			requestAnimationFrame(() => {
				eventEmitter.emit("table:resize", { newColWidths });
			});
		}, { tag: SKIP_SCROLL_INTO_VIEW_TAG });
	}, [activeCell, editor]);
	const pointerUpHandler = useCallback((direction) => {
		const handler = (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (!activeCell) throw new Error("TableCellResizer: Expected active cell.");
			if (pointerStartPosRef.current) {
				const { x, y } = pointerStartPosRef.current;
				if (activeCell === null) return;
				const zoom = calculateZoomLevel(event.target);
				if (isHeightChanging(direction)) updateRowHeight((event.clientY - y) / zoom);
				else updateColumnWidth((event.clientX - x) / zoom);
				resetState();
				if (typeof document !== "undefined") document.removeEventListener("pointerup", handler);
			}
		};
		return handler;
	}, [
		activeCell,
		resetState,
		updateColumnWidth,
		updateRowHeight
	]);
	const toggleResize = useCallback((direction) => (event) => {
		event.preventDefault();
		event.stopPropagation();
		if (!activeCell) throw new Error("TableCellResizer: Expected active cell.");
		pointerStartPosRef.current = {
			x: event.clientX,
			y: event.clientY
		};
		updatePointerCurrentPos(pointerStartPosRef.current);
		updateDraggingDirection(direction);
		if (typeof document !== "undefined") document.addEventListener("pointerup", pointerUpHandler(direction));
	}, [activeCell, pointerUpHandler]);
	const resizerStyles = useCallback(() => {
		if (activeCell) {
			const { height, width, top, left } = activeCell.elem.getBoundingClientRect();
			const zoom = calculateZoomLevel(activeCell.elem);
			const zoneWidth = 16;
			const scrollX = typeof window !== "undefined" ? window.scrollX : 0;
			const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
			const styles = {
				bottom: {
					backgroundColor: "none",
					cursor: "row-resize",
					height: `${zoneWidth}px`,
					left: `${scrollX + left}px`,
					top: `${scrollY + top + height - zoneWidth / 2}px`,
					width: `${width}px`
				},
				right: {
					backgroundColor: "none",
					cursor: "col-resize",
					height: `${height}px`,
					left: `${scrollX + left + width - zoneWidth / 2}px`,
					top: `${scrollY + top}px`,
					width: `${zoneWidth}px`
				}
			};
			const tableRect = tableRectRef.current;
			if (draggingDirection && pointerCurrentPos && tableRect) {
				if (isHeightChanging(draggingDirection)) {
					styles[draggingDirection].left = `${scrollX + tableRect.left}px`;
					styles[draggingDirection].top = `${scrollY + pointerCurrentPos.y / zoom}px`;
					styles[draggingDirection].height = "3px";
					styles[draggingDirection].width = `${tableRect.width}px`;
				} else {
					styles[draggingDirection].top = `${scrollY + tableRect.top}px`;
					styles[draggingDirection].left = `${scrollX + pointerCurrentPos.x / zoom}px`;
					styles[draggingDirection].width = "3px";
					styles[draggingDirection].height = `${tableRect.height}px`;
				}
				styles[draggingDirection].backgroundColor = cssVar.colorPrimary;
				styles[draggingDirection].mixBlendMode = "unset";
			}
			return styles;
		}
		return {
			bottom: null,
			left: null,
			right: null,
			top: null
		};
	}, [
		activeCell,
		draggingDirection,
		pointerCurrentPos
	])();
	return /* @__PURE__ */ jsx("div", {
		ref: resizerRef,
		children: activeCell && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
			className: cx(styles$1, "TableCellResizer__resizer", "TableCellResizer__ui"),
			onPointerDown: toggleResize("right"),
			style: resizerStyles.right || void 0
		}), /* @__PURE__ */ jsx("div", {
			className: cx(styles$1, "TableCellResizer__resizer", "TableCellResizer__ui"),
			onPointerDown: toggleResize("bottom"),
			style: resizerStyles.bottom || void 0
		})] })
	});
});
var TableResize_default = memo(({ editor, eventEmitter }) => {
	if (typeof document === "undefined") return null;
	const container = document.querySelector(".ant-app") || document.body;
	return createPortal(/* @__PURE__ */ jsx(TableCellResize, {
		editor,
		eventEmitter
	}), container);
});
//#endregion
//#region src/plugins/table/react/index.tsx
const ReactTablePlugin = ({ className, locale }) => {
	const [editor] = useLexicalComposerContext();
	const [lexicalEditor, setLexicalEditor] = useState(null);
	const eventEmitter = useMemo(() => {
		return new EventEmitter();
	}, []);
	useLayoutEffect(() => {
		if (locale) editor.registerLocale(locale);
		editor.registerPlugin(TablePlugin, { theme: cx(styles$18, className) });
	}, []);
	useLexicalEditor((editor) => {
		setLexicalEditor(editor);
		editor.registerUpdateListener(() => {
			editor.read(() => {
				const selection = $getSelection();
				if (!$isTableSelection(selection) && !$isRangeSelection(selection)) return null;
				const tableNode = $findTableNode(selection.anchor.getNode());
				if (!tableNode) return null;
				$updateDOMForSelection(editor, $getElementForTableNode(editor, tableNode), selection);
			});
		});
		return () => {
			setLexicalEditor(null);
		};
	}, []);
	return lexicalEditor && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(TableResize_default, {
		editor: lexicalEditor,
		eventEmitter
	}), /* @__PURE__ */ jsxs(PortalAnchor, { children: [/* @__PURE__ */ jsx(TableActionMenu, { editor: lexicalEditor }), /* @__PURE__ */ jsx(TableHoverActions, { editor: lexicalEditor })] })] });
};
//#endregion
//#region src/plugins/toolbar/command/index.ts
const HIDE_TOOLBAR_COMMAND = createCommand();
const SHOW_TOOLBAR_COMMAND = createCommand();
function registerToolbarCommand(editor, options) {
	const { onHide, onShow } = options || {};
	return mergeRegister(editor.registerCommand(HIDE_TOOLBAR_COMMAND, () => {
		onHide?.();
		return true;
	}, COMMAND_PRIORITY_LOW), editor.registerCommand(SHOW_TOOLBAR_COMMAND, () => {
		onShow?.();
		return true;
	}, COMMAND_PRIORITY_LOW));
}
//#endregion
//#region src/plugins/toolbar/utils/getDOMRangeRect.ts
/**
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*
*/
function getDOMRangeRect(nativeSelection, rootElement) {
	const domRange = nativeSelection.getRangeAt(0);
	let rect;
	if (nativeSelection.anchorNode === rootElement) {
		let inner = rootElement;
		while (inner.firstElementChild !== null) inner = inner.firstElementChild;
		rect = inner.getBoundingClientRect();
	} else rect = domRange.getBoundingClientRect();
	return rect;
}
//#endregion
//#region src/plugins/toolbar/utils/setFloatingElemPosition.ts
/**
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*
*/
const VERTICAL_GAP = 4;
const HORIZONTAL_OFFSET = 0;
function getScrollParent(element) {
	let parent = element.parentElement;
	while (parent) {
		const { overflow, overflowY, overflowX } = window.getComputedStyle(parent);
		if (/(auto|scroll)/.test(overflow + overflowY + overflowX)) return parent;
		parent = parent.parentElement;
	}
	return document.documentElement;
}
function setFloatingElemPosition(targetRect, floatingElem, anchorElem, isLink = false, verticalGap = VERTICAL_GAP, horizontalOffset = HORIZONTAL_OFFSET) {
	const scrollerElem = getScrollParent(anchorElem);
	if (targetRect === null || !scrollerElem) {
		floatingElem.style.opacity = "0";
		floatingElem.style.transform = "translate(-10000px, -10000px)";
		return;
	}
	const floatingElemRect = floatingElem.getBoundingClientRect();
	const anchorElementRect = anchorElem.getBoundingClientRect();
	const editorScrollerRect = scrollerElem.getBoundingClientRect();
	let top = targetRect.top - floatingElemRect.height - verticalGap;
	let left = targetRect.left - horizontalOffset;
	const selection = window.getSelection();
	if (selection && selection.rangeCount > 0) {
		const textNode = selection.getRangeAt(0).startContainer;
		if (textNode.nodeType === Node.ELEMENT_NODE || textNode.parentElement) {
			const textElement = textNode.nodeType === Node.ELEMENT_NODE ? textNode : textNode.parentElement;
			const textAlign = window.getComputedStyle(textElement).textAlign;
			if (textAlign === "right" || textAlign === "end") left = targetRect.right - floatingElemRect.width + horizontalOffset;
		}
	}
	if (top < editorScrollerRect.top) top += floatingElemRect.height + targetRect.height + verticalGap * (isLink ? 9 : 2);
	if (left + floatingElemRect.width > editorScrollerRect.right) left = editorScrollerRect.right - floatingElemRect.width - horizontalOffset;
	if (left < editorScrollerRect.left) left = editorScrollerRect.left + horizontalOffset;
	top -= anchorElementRect.top + 12;
	left -= anchorElementRect.left;
	floatingElem.style.opacity = "1";
	floatingElem.style.transform = `translate(${left}px, ${top}px)`;
}
//#endregion
//#region src/plugins/toolbar/react/style.ts
const styles = createStaticStyles(({ css, cssVar }) => ({
	anchor: css`
    position: relative;
  `,
	toolbarDark: css`
    will-change: transform;

    position: absolute;
    z-index: 10;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform: translate(-10000px, -10000px);

    display: flex;

    border-color: ${cssVar.colorFillSecondary};

    vertical-align: middle;

    opacity: 0;
    background: ${cssVar.colorBgElevated};
    box-shadow:
      0 14px 28px -6px color-mix(in srgb, #000 18.75%, transparent),
      0 2px 4px -1px color-mix(in srgb, #000 12.19%, transparent);

    transition: opacity 0.12s ${cssVar.motionEaseOut};
  `,
	toolbarLight: css`
    will-change: transform;

    position: absolute;
    z-index: 10;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform: translate(-10000px, -10000px);

    display: flex;

    border-color: ${cssVar.colorFillSecondary};

    vertical-align: middle;

    opacity: 0;
    background: ${cssVar.colorBgElevated};
    box-shadow:
      0 14px 28px -6px color-mix(in srgb, #000 10.2%, transparent),
      0 2px 4px -1px color-mix(in srgb, #000 5.88%, transparent);

    transition: opacity 0.12s ${cssVar.motionEaseOut};
  `
}));
//#endregion
//#region src/plugins/toolbar/react/index.tsx
init_debug();
const ReactToolbarPlugin = ({ className, children }) => {
	const popupCharStylesEditorRef = useRef(null);
	const anchorElemRef = useRef(null);
	const [kernelEditor] = useLexicalComposerContext();
	const { isDarkMode } = useThemeMode();
	const isMouseDownRef = useRef(false);
	const logger = createDebugLogger("plugin", "toolbar");
	const $updateTextFormatFloatingToolbar = useCallback((editor) => {
		if (!anchorElemRef.current) return;
		const selection = $getSelection();
		const popupCharStylesEditorElem = popupCharStylesEditorRef.current;
		const nativeSelection = getDOMSelection(editor._window);
		if (popupCharStylesEditorElem === null) return;
		const rootElement = editor.getRootElement();
		if (selection !== null && nativeSelection !== null && !nativeSelection.isCollapsed && rootElement !== null && rootElement.contains(nativeSelection.anchorNode)) {
			const rangeRect = getDOMRangeRect(nativeSelection, rootElement);
			logger.debug("🔍 rangeRect", rangeRect);
			setFloatingElemPosition(rangeRect, popupCharStylesEditorElem, anchorElemRef.current, false);
		} else {
			popupCharStylesEditorElem.style.opacity = "0";
			popupCharStylesEditorElem.style.transform = "translate(-10000px, -10000px)";
		}
	}, [anchorElemRef]);
	const $hideFloatingToolbar = useCallback(() => {
		if (!anchorElemRef.current) return;
		const popupCharStylesEditorElem = popupCharStylesEditorRef.current;
		if (popupCharStylesEditorElem === null) return;
		popupCharStylesEditorElem.style.opacity = "0";
		popupCharStylesEditorElem.style.transform = "translate(-10000px, -10000px)";
	}, [anchorElemRef]);
	const handleMouseDownFactory = useCallback((updateToolbar) => (e) => {
		if (e.button === 0) {
			isMouseDownRef.current = true;
			updateToolbar();
		}
	}, []);
	const handleMouseUpFactory = useCallback((updateToolbar) => (e) => {
		if (e.button === 0) {
			isMouseDownRef.current = false;
			updateToolbar();
		}
	}, []);
	useLexicalEditor(() => {
		const service = kernelEditor.requireService(ILinkService);
		if (service) {
			service.setLinkToolbar(false);
			return () => {
				service.setLinkToolbar(true);
			};
		}
	}, []);
	useLexicalEditor((editor) => {
		const handleMouseDown = handleMouseDownFactory(() => {
			editor.dispatchCommand(HIDE_TOOLBAR_COMMAND, void 0);
		});
		const handleMouseUp = handleMouseUpFactory(() => {
			editor.update(() => {
				$updateTextFormatFloatingToolbar(editor);
			});
		});
		const rootElement = editor.getRootElement();
		if (rootElement) {
			rootElement.addEventListener("mousedown", handleMouseDown);
			document.addEventListener("mouseup", handleMouseUp);
		}
		return mergeRegister(registerToolbarCommand(editor, { onHide: $hideFloatingToolbar }), editor.registerUpdateListener(({ editorState }) => {
			if (!isMouseDownRef.current) editorState.read(() => {
				$updateTextFormatFloatingToolbar(editor);
			});
		}), editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
			if (!isMouseDownRef.current) $updateTextFormatFloatingToolbar(editor);
			return false;
		}, COMMAND_PRIORITY_LOW), () => {
			if (rootElement) {
				rootElement.removeEventListener("mousedown", handleMouseDown);
				document.removeEventListener("mouseup", handleMouseUp);
			}
		});
	});
	return /* @__PURE__ */ jsx("div", {
		className: styles.anchor,
		ref: anchorElemRef,
		children: /* @__PURE__ */ jsx(Block, {
			className: cx(isDarkMode ? styles.toolbarDark : styles.toolbarLight, className),
			padding: 4,
			ref: popupCharStylesEditorRef,
			variant: "outlined",
			children
		})
	});
};
//#endregion
//#region src/index.ts
init_hotkey();
init_debug();
init_kernel();
/**
* Enable hot reload mode globally for all editor instances
* Call this in your app's entry point during development
*/
function enableHotReload() {
	if (typeof window !== "undefined") {
		const { Kernel } = (init_kernel(), __toCommonJS(kernel_exports));
		const { debugLoggers } = (init_debug(), __toCommonJS(debug_exports));
		Kernel.setGlobalHotReloadMode(true);
		debugLoggers.kernel.info("[LobeHub Editor] Hot reload mode enabled globally");
	}
}
/**
* Disable hot reload mode globally
*/
function disableHotReload() {
	if (typeof window !== "undefined") {
		const { Kernel } = (init_kernel(), __toCommonJS(kernel_exports));
		const { debugLoggers } = (init_debug(), __toCommonJS(debug_exports));
		Kernel.setGlobalHotReloadMode(false);
		debugLoggers.kernel.info("[LobeHub Editor] Hot reload mode disabled globally");
	}
}
//#endregion
export { $closest, $closestNodeType, $createCursorNode, $createDiffChromeNode, $createDiffHunkNode, $createMarkmapNode, $createMeta2dNode, $getNearestNodeFromDOMNode, $getNodeFromDOMNode, $isCardLikeElementNode, $isCursorNode, $isDiffChromeNode, $isDiffHunkNode, $isMarkmapNode, $isMeta2dNode, ACCEPT_DIFF_OP_COMMAND, APPLY_DIFF_OP_COMMAND, AutoCompletePlugin, CardLikeElementNode, CodePlugin, CodeblockPlugin, CodemirrorPlugin, CommonPlugin, DEFAULT_HEADLESS_EDITOR_PLUGINS, DOM_DOCUMENT_FRAGMENT_TYPE, DOM_DOCUMENT_TYPE, DOM_ELEMENT_TYPE, DOM_TEXT_TYPE, DataSource, DiffChromeNode, DiffHunkNode, DiffPlugin, EDITOR_THEME_KEY, FilePlugin, GET_MARKDOWN_SELECTION_COMMAND, HIDE_TOOLBAR_COMMAND, HOVER_COMMAND, HRPlugin, HeadlessEditor, HotkeyEnum, HotkeyScopeEnum, ILinkService, IMarkdownShortCutService, INSERT_CHECK_LIST_COMMAND, INSERT_CODEINLINE_COMMAND, INSERT_CODEMIRROR_COMMAND, INSERT_FILE_COMMAND, INSERT_HEADING_COMMAND, INSERT_HORIZONTAL_RULE_COMMAND, INSERT_IMAGE_COMMAND, INSERT_LINK_COMMAND, INSERT_LINK_HIGHLIGHT_COMMAND, INSERT_MARKDOWN_COMMAND, INSERT_MARKMAP_COMMAND, INSERT_MATH_COMMAND, INSERT_MENTION_COMMAND, INSERT_META2D_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_QUOTE_COMMAND, INSERT_TABLE_COMMAND, INSERT_UNORDERED_LIST_COMMAND, INodePlugin, INodeService, IUploadService, ImagePlugin, Kernel, KeyEnum, LexicalErrorBoundary, LexicalPortalContainer, LinkHighlightPlugin, LinkPlugin, ListPlugin, MARKDOWN_READER_LEVEL_HIGH, MARKDOWN_READER_LEVEL_NORMAL, MARKDOWN_WRITER_LEVEL_MAX, MarkdownPlugin, MarkmapNode, MarkmapPlugin, MarkmapWithErrorBoundary, MathPlugin, MentionPlugin, MermaidWithErrorBoundary, Meta2dNode, Meta2dPlugin, OutlinePanel, OutlineProvider, OutlineToolbar, REJECT_DIFF_OP_COMMAND, REMOVE_LIST_COMMAND, ReactAutoCompletePlugin, ReactCodePlugin, ReactCodeblockPlugin, ReactCodemirrorPlugin, ReactDiffPlugin, ReactEditor, ReactEditorContent, ReactFilePlugin, ReactHRPlugin, ReactImagePlugin, ReactLinkHighlightPlugin, ReactLinkPlugin, ReactListPlugin, ReactMarkdownPlugin, ReactMarkmapPlugin, ReactMathPlugin, ReactMentionPlugin, ReactMeta2dPlugin, ReactNodePlugin, ReactPlainText, ReactSlashOption, ReactSlashPlugin, ReactTablePlugin, ReactToolbarPlugin, SELECT_AFTER_CODEMIRROR_COMMAND, SELECT_BEFORE_CODEMIRROR_COMMAND, SELECT_TABLE_COMMAND, SHOW_TOOLBAR_COMMAND, SUPPORTED_SHIKI_LANGUAGE_IDS, SlashMenu, SlashPlugin, TablePlugin, UPDATE_CODEBLOCK_LANG, UPDATE_LIST_START_COMMAND, UPLOAD_PRIORITY_HIGH, UPLOAD_PRIORITY_LOW, UPLOAD_PRIORITY_MEDIUM, UploadPlugin, acceptAllDiffOps, acceptDiffHunkByKey, acceptDiffOp, assert, assertCanPublish, blockPlainText, browserDebug, supportedLanguagesInfo as bundledLanguagesInfo, supportedLanguagesInfo, compareNodeOrder, countNodes, createDebugLogger, createEmptyEditorState, createHeadlessEditor, cursorNodeSerialized, debugLogger, debugLoggers, detectCodeLanguage, detectLanguage, devConsole, disableHotReload, enUS, enableHotReload, flattenCanonicalState, genServiceId, generateEditorId, getCanonicalEditorState, getHotkeyById, getKernelFromEditor, getKernelFromEditorConfig, getNodeKeyFromDOMNode, getParentElement, hasPendingDiff, insertAfterSlot, isDOMNode, isDocumentFragment, isPunctuationChar, isPureUrl, isValidUrl, looksLikeMermaidDiagramSyntax, makeParagraphBlock, materializeCanonical, moment, noop, overwriteAll, overwriteAllFromState, prodSafeLogger, reconcileDecorator, registerEditorKernel, registerLinkHighlightCommand, registerToolbarCommand, rejectAllDiffOps, rejectDiffHunkByKey, rejectDiffOp, removeSlot, resetRandomKey, scrollIntoView, setFoldAll, unregisterEditorKernel, updateSlot, useLexicalComposerContext, useLexicalEditor, useOutlineActionItem, useOutlineVisibility, useOutlineVisibilityContext, useOutlineVisibilityToggle, zhCN };
