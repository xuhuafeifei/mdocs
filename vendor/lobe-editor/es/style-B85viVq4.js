import { C as noop, E as unregisterEditorKernel, O as __esmMin, T as registerEditorKernel, f as createEmptyEditorState, h as getKernelFromEditor, k as __exportAll, l as EDITOR_THEME_KEY, m as generateEditorId, t as $closest, u as assert, y as init_utils$1 } from "./utils-DR6xvOCh.js";
import { createHeadlessEditor } from "@lexical/headless";
import { createEmptyHistoryState } from "@lexical/history";
import { $createTableSelection, $isTableCellNode, $isTableNode, $isTableSelection } from "@lexical/table";
import { get, merge, template, templateSettings } from "es-toolkit/compat";
import EventEmitter from "eventemitter3";
import { $applyNodeReplacement, $createNodeSelection, $createRangeSelection, $createTextNode, $getNodeByKey, $getRoot, $getSelection, $isDecoratorNode, $isElementNode, $isNodeSelection, $isParagraphNode, $isRangeSelection, $isTextNode, $normalizeSelection__EXPERIMENTAL, $setSelection, COMMAND_PRIORITY_CRITICAL, COMMAND_PRIORITY_HIGH, COMMAND_PRIORITY_LOW, DecoratorNode, ElementNode, HISTORY_MERGE_TAG, KEY_ARROW_LEFT_COMMAND, KEY_ARROW_RIGHT_COMMAND, KEY_BACKSPACE_COMMAND, KEY_DOWN_COMMAND, TextNode, createCommand, createEditor, isHTMLElement, isModifierMatch, resetRandomKey } from "lexical";
import { $isQuoteNode } from "@lexical/rich-text";
import createDebug from "debug";
import { $findMatchingParent, IS_APPLE, IS_APPLE as isApple, addClassNamesToElement, isHTMLAnchorElement, mergeRegister } from "@lexical/utils";
import { createStaticStyles, cx, keyframes } from "antd-style";
//#region src/locale/zh-CN.ts
var zhCN;
var init_zh_CN = __esmMin((() => {
	zhCN = {
		bgColor: "背景颜色",
		cancel: "取消",
		codemirror: {
			copyFailed: "复制失败",
			copySuccess: "代码已复制到剪贴板",
			mermaidExpandPreview: "大图预览",
			mermaidShrinkPreview: "退出大图预览",
			selectLanguage: "选择语言",
			selectTheme: "选择主题",
			showLineNumbers: "显示行号",
			tabSize: "Tab 大小",
			theme: "主题",
			useTabs: "使用 Tab"
		},
		confirm: "确认",
		file: {
			download: "下载文件",
			error: "错误：{{message}}",
			uploading: "正在上传文件..."
		},
		image: {
			broken: "图片加载失败",
			download: "下载",
			replace: "替换"
		},
		link: {
			copyFailed: "复制失败",
			copyText: "复制文本",
			copyTextSuccess: "已复制文本",
			copyUrl: "复制网址",
			copyUrlSuccess: "已复制网址",
			edit: "编辑链接",
			editLinkTitle: "链接",
			editTextTitle: "文本",
			editableInteractiveHint: "左键单击：在链接内移动光标或编辑文本。⌘/Ctrl+单击、或鼠标中键：新标签打开。也可悬停在链接上使用工具栏「打开链接」。",
			open: "打开链接",
			placeholder: "输入链接 URL",
			unlink: "取消链接"
		},
		markdown: {
			autoFormatMessage: "Markdown 已自动转换。使用 Command/Ctrl + Z 撤销此转换。",
			autoFormatTitle: "Markdown 已转换",
			cancel: "取消",
			confirm: "确认",
			parseMessage: "转换为 Markdown 格式，现有内容将被覆盖，是否确认？（5 秒后自动关闭）",
			parseTitle: "解析 Markdown",
			pasteCancel: "保留纯文本",
			pasteConfirm: "转换",
			pasteDescription: "粘贴的内容似乎是 Markdown 格式，是否转换为富文本？",
			pasteTitle: "检测到 Markdown 格式"
		},
		math: { placeholder: "输入 TeX 公式" },
		meta2d: {
			editor: {
				close: "关闭",
				delete: "删除",
				fit: "适应",
				redo: "重做",
				save: "保存",
				saving: "保存中...",
				title: "流程图",
				undo: "撤销",
				zoom100: "100%"
			},
			palette: {
				actFinal: "结束",
				actMerge: "合并",
				actStart: "开始",
				actStep: "动作",
				andGate: "与门",
				basicEvent: "基本事件",
				circle: "圆形",
				cloud: "云形",
				cube: "立方体",
				diamond: "菱形",
				file: "文件",
				flowComment: "批注",
				flowData: "数据",
				flowDb: "数据库",
				flowDecision: "判断",
				flowDisplay: "显示",
				flowDocument: "文档",
				flowExternStorage: "外部存储",
				flowInternalStorage: "内部存储",
				flowManually: "手动输入",
				flowParallel: "并行",
				flowPrepare: "准备",
				flowProcess: "处理过程",
				flowQueue: "队列",
				flowSubprocess: "子流程",
				flowTerminal: "开始/结束",
				forkH: "水平分叉",
				forkV: "垂直分叉",
				groups: {
					activity: "活动图",
					basic: "基本形状",
					faultTree: "故障树",
					flow: "流程图",
					sequenceClass: "时序和类图"
				},
				hexagon: "六边形",
				hint: "拖拽或点击添加到画布",
				interfaceClass: "类",
				leftArrow: "左箭头",
				lifeline: "生命线",
				line: "直线",
				message: "消息框",
				orGate: "或门",
				pentagon: "五边形",
				pentagram: "星形",
				people: "角色",
				rect: "矩形",
				rightArrow: "右箭头",
				roundRect: "圆角矩形",
				sequenceFocus: "激活条",
				simpleClass: "简单类",
				square: "正方形",
				swimlaneH: "水平泳道",
				swimlaneV: "垂直泳道",
				text: "文本",
				title: "组件",
				triangle: "三角形",
				twowayArrow: "双向箭头",
				votingGate: "表决门",
				xorGate: "异或门"
			},
			props: {
				alpha: "透明度",
				appearance: "外观",
				bg: "背景",
				bottom: "置底",
				bottomAlign: "底部",
				center: "居中",
				color: "颜色",
				dash: "虚线",
				dashLine: "虚线",
				down: "下移",
				empty: "选择一个形状以编辑属性",
				h: "水平",
				layer: "图层",
				left: "左对齐",
				middle: "居中",
				position: "位置和大小",
				radius: "圆角",
				right: "右对齐",
				solid: "实线",
				text: "文本",
				textAlign: "文字对齐",
				top: "置顶",
				topAlign: "顶部",
				up: "上移",
				v: "垂直"
			}
		},
		modifier: {
			accept: "接受",
			acceptAll: "全部接受",
			reject: "拒绝",
			rejectedAll: "全部拒绝"
		},
		table: {
			delete: "删除表格",
			deleteColumn: "删除列",
			deleteRow: "删除行",
			insertColumnLeft: "左侧插入 {{count}} 列",
			insertColumnRight: "右侧插入 {{count}} 列",
			insertRowAbove: "上方插入 {{count}} 行",
			insertRowBelow: "下方插入 {{count}} 行"
		},
		textColor: "文字颜色"
	};
}));
//#endregion
//#region src/locale/index.ts
var locale, enUS;
var init_locale = __esmMin((() => {
	init_zh_CN();
	locale = {
		bgColor: "Background Color",
		cancel: "Cancel",
		codemirror: {
			copyFailed: "Copy failed",
			copySuccess: "Code copied to clipboard",
			mermaidExpandPreview: "Large diagram preview",
			mermaidShrinkPreview: "Exit large preview",
			selectLanguage: "Select language",
			selectTheme: "Select theme",
			showLineNumbers: "Show Line Numbers",
			tabSize: "Tab Size",
			theme: "Theme",
			useTabs: "Use Tabs"
		},
		confirm: "Confirm",
		file: {
			download: "Download file",
			error: "Error: {{message}}",
			uploading: "Uploading file..."
		},
		image: {
			broken: "Broken image",
			download: "Download",
			replace: "Replace"
		},
		link: {
			copyFailed: "Copy failed",
			copyText: "Copy Text",
			copyTextSuccess: "Text copied",
			copyUrl: "Copy URL",
			copyUrlSuccess: "URL copied",
			edit: "Edit Link",
			editLinkTitle: "Link",
			editTextTitle: "Text",
			editableInteractiveHint: "Click to place the caret / edit this link. ⌘ or Ctrl-click (or middle-click) opens in a new tab. You can also use the hovering toolbar “Open”.",
			open: "Open Link",
			placeholder: "Enter link URL",
			unlink: "Unlink Link"
		},
		markdown: {
			autoFormatMessage: "Markdown was converted automatically. Use Command/Ctrl + Z to undo this conversion.",
			autoFormatTitle: "Markdown Converted",
			cancel: "Cancel",
			confirm: "Confirm",
			parseMessage: "Convert to markdown format, existing content will be overwritten, confirm? (Auto close in 5 seconds)",
			parseTitle: "Parse Markdown",
			pasteCancel: "Keep Plain Text",
			pasteConfirm: "Convert",
			pasteDescription: "Pasted content appears to be Markdown. Convert to rich text?",
			pasteTitle: "Markdown Format Detected"
		},
		math: { placeholder: "Enter TeX formula" },
		meta2d: {
			editor: {
				close: "Close",
				delete: "Delete",
				fit: "Fit",
				redo: "Redo",
				save: "Save",
				saving: "Saving...",
				title: "Flow diagram",
				undo: "Undo",
				zoom100: "100%"
			},
			palette: {
				actFinal: "Final",
				actMerge: "Merge",
				actStart: "Start",
				actStep: "Action",
				andGate: "AND gate",
				basicEvent: "Basic event",
				circle: "Circle",
				cloud: "Cloud",
				cube: "Cube",
				diamond: "Diamond",
				file: "File",
				flowComment: "Comment",
				flowData: "Data",
				flowDb: "Database",
				flowDecision: "Decision",
				flowDisplay: "Display",
				flowDocument: "Document",
				flowExternStorage: "Ext. storage",
				flowInternalStorage: "Int. storage",
				flowManually: "Manual input",
				flowParallel: "Parallel",
				flowPrepare: "Prepare",
				flowProcess: "Process",
				flowQueue: "Queue",
				flowSubprocess: "Subprocess",
				flowTerminal: "Terminal",
				forkH: "Fork H",
				forkV: "Fork V",
				groups: {
					activity: "Activity",
					basic: "Basic",
					faultTree: "Fault tree",
					flow: "Flow",
					sequenceClass: "Sequence & class"
				},
				hexagon: "Hexagon",
				hint: "Drag or click to add to canvas",
				interfaceClass: "Class",
				leftArrow: "Left arrow",
				lifeline: "Lifeline",
				line: "Line",
				message: "Message",
				orGate: "OR gate",
				pentagon: "Pentagon",
				pentagram: "Star",
				people: "Actor",
				rect: "Rectangle",
				rightArrow: "Right arrow",
				roundRect: "Rounded",
				sequenceFocus: "Activation",
				simpleClass: "Simple class",
				square: "Square",
				swimlaneH: "Swimlane H",
				swimlaneV: "Swimlane V",
				text: "Text",
				title: "Components",
				triangle: "Triangle",
				twowayArrow: "Two-way",
				votingGate: "Voting gate",
				xorGate: "XOR gate"
			},
			props: {
				alpha: "Alpha",
				appearance: "Appearance",
				bg: "Bg",
				bottom: "Bottom",
				bottomAlign: "Bottom",
				center: "Center",
				color: "Color",
				dash: "Dash",
				dashLine: "Dash",
				down: "Down",
				empty: "Select a shape to edit its properties",
				h: "H",
				layer: "Layer",
				left: "Left",
				middle: "Middle",
				position: "Position & Size",
				radius: "Radius",
				right: "Right",
				solid: "Solid",
				text: "Text",
				textAlign: "Text align",
				top: "Top",
				topAlign: "Top",
				up: "Up",
				v: "V"
			}
		},
		modifier: {
			accept: "Accept",
			acceptAll: "Accept All",
			reject: "Reject",
			rejectedAll: "Reject All"
		},
		table: {
			delete: "Delete table",
			deleteColumn: "Delete column",
			deleteRow: "Delete row",
			insertColumnLeft: "Insert {{count}} column(s) to the left",
			insertColumnRight: "Insert {{count}} column(s) to the right",
			insertRowAbove: "Insert {{count}} row(s) above",
			insertRowBelow: "Insert {{count}} row(s) below"
		},
		textColor: "Text Color"
	};
	enUS = locale;
}));
//#endregion
//#region src/editor-kernel/inode/helper.ts
var BaseContent, INodeHelper;
var init_helper = __esmMin((() => {
	BaseContent = {
		direction: "ltr",
		format: "",
		indent: 0,
		type: "",
		version: 1
	};
	INodeHelper = {
		appendChild(parent, ...child) {
			if (!parent.children) parent.children = [];
			parent.children.push(...child);
		},
		createElementNode(type, attrs = {}) {
			return {
				...BaseContent,
				children: [],
				...attrs,
				type
			};
		},
		createLikeTextNode(type, text, attrs = {}) {
			return {
				...BaseContent,
				detail: 0,
				format: 0,
				mode: "normal",
				style: "",
				...attrs,
				text,
				type
			};
		},
		createParagraph(attrs = {}) {
			return {
				...BaseContent,
				children: [],
				textFormat: 0,
				textStyle: "",
				...attrs,
				type: "paragraph"
			};
		},
		createRootNode(attrs = {}) {
			return {
				...BaseContent,
				...attrs,
				children: [],
				type: "root"
			};
		},
		createTextNode(text, attrs = {}) {
			return {
				...BaseContent,
				detail: 0,
				format: 0,
				mode: "normal",
				style: "",
				...attrs,
				text,
				type: "text"
			};
		},
		createTypeNode(type, attrs = {}) {
			return {
				...BaseContent,
				...attrs,
				type
			};
		},
		isParagraphNode(node) {
			return node.type === "paragraph";
		},
		isRootNode(node) {
			return node.type === "root";
		},
		isTextNode(node) {
			return node.type === "text";
		}
	};
}));
//#endregion
//#region src/plugins/common/utils/index.ts
/**
* Returns the root's text content.
* @returns The root's text content.
*/
function $rootTextContent() {
	return $getRoot().getTextContent();
}
/**
* Determines if the root has any text content and can trim any whitespace if it does.
* @param isEditorComposing - Is the editor in composition mode due to an active Input Method Editor?
* @param trim - Should the root text have its whitespaced trimmed? Defaults to true.
* @returns true if text content is empty, false if there is text or isEditorComposing is true.
*/
function $isRootTextContentEmpty(isEditorComposing, trim = true) {
	if (isEditorComposing) return false;
	let text = $rootTextContent();
	if (trim) text = text.trim();
	return text === "";
}
/**
* Determines if the input should show the placeholder. If anything is in
* in the root the placeholder should not be shown.
* @param isComposing - Is the editor in composition mode due to an active Input Method Editor?
* @returns true if the input should show the placeholder, false otherwise.
*/
function $canShowPlaceholder(isComposing) {
	if (!$isRootTextContentEmpty(isComposing, false)) return false;
	const children = $getRoot().getChildren();
	const childrenLength = children.length;
	if (childrenLength > 1) return false;
	for (let i = 0; i < childrenLength; i++) {
		const topBlock = children[i];
		if ($isDecoratorNode(topBlock)) return false;
		if ($isElementNode(topBlock)) {
			if (!$isParagraphNode(topBlock)) return false;
			if (topBlock.__indent !== 0) return false;
			const topBlockChildren = topBlock.getChildren();
			const topBlockChildrenLength = topBlockChildren.length;
			for (let s = 0; s < topBlockChildrenLength; s++) {
				const child = topBlockChildren[i];
				if (!$isTextNode(child)) return false;
			}
		}
	}
	return true;
}
/**
* Returns a function that executes {@link $canShowPlaceholder}
* @param isEditorComposing - Is the editor in composition mode due to an active Input Method Editor?
* @returns A function that executes $canShowPlaceholder with arguments.
*/
function $canShowPlaceholderCurry(isEditorComposing) {
	return () => $canShowPlaceholder(isEditorComposing);
}
function $isCursorInTable(selection) {
	if (!$isRangeSelection(selection)) return {
		inCell: false,
		inTable: false
	};
	let currentNode = selection.focus.getNode();
	let inTable = false;
	let inCell = false;
	while (currentNode) {
		if ($isTableCellNode(currentNode)) {
			inCell = true;
			inTable = true;
			break;
		}
		if ($isTableNode(currentNode)) {
			inTable = true;
			break;
		}
		const parent = currentNode.getParent();
		if (!parent) break;
		currentNode = parent;
	}
	return {
		inCell,
		inTable
	};
}
function $isCursorInQuote(selection) {
	if (!$isRangeSelection(selection)) return false;
	let currentNode = selection.focus.getNode();
	while (currentNode) {
		if ($isQuoteNode(currentNode)) return true;
		const parent = currentNode.getParent();
		if (!parent) break;
		currentNode = parent;
	}
	return false;
}
function exportNodeToJSON(node) {
	const serializedNode = node.exportJSON();
	const nodeClass = node.constructor;
	serializedNode.id = node.getKey();
	if (serializedNode.type !== nodeClass.getType()) throw new Error(`LexicalNode: Node ${nodeClass.name} does not match the serialized type. Check if .exportJSON() is implemented and it is returning the correct type.`);
	if ($isElementNode(node)) {
		const serializedChildren = serializedNode.children;
		if (!Array.isArray(serializedChildren)) throw new Error(`LexicalNode: Node ${nodeClass.name} is an element but .exportJSON() does not have a children array.`);
		const children = node.getChildren();
		for (const child of children) {
			const serializedChildNode = exportNodeToJSON(child);
			serializedChildren.push(serializedChildNode);
		}
	}
	return serializedNode;
}
var createBlockNode;
var init_utils = __esmMin((() => {
	createBlockNode = (createNode) => {
		return (parentNode, children, match, isImport) => {
			const node = createNode(match, parentNode);
			node.append(...children);
			parentNode.replace(node);
			if (!isImport) node.select(0, 0);
		};
	};
}));
//#endregion
//#region src/utils/debug.ts
var debug_exports = /* @__PURE__ */ __exportAll({
	DebugLogger: () => DebugLogger,
	browserDebug: () => browserDebug,
	createDebugLogger: () => createDebugLogger,
	debugLogger: () => debugLogger,
	debugLoggers: () => debugLoggers,
	devConsole: () => devConsole,
	isDev: () => true,
	prodSafeLogger: () => prodSafeLogger
});
/**
* Convenience function to create a debug logger for a specific category
* @param category - Main category (e.g., 'kernel', 'plugin', 'upload')
* @param subcategory - Optional subcategory
* @returns Logger object with debug methods
*/
function createDebugLogger(category, subcategory) {
	return debugLogger.createLogger(category, subcategory);
}
var BASE_NAMESPACE, DebugLogger, debugLogger, debugLoggers, devConsole, prodSafeLogger, browserDebug;
var init_debug = __esmMin((() => {
	BASE_NAMESPACE = "lobe-editor";
	DebugLogger = class {
		constructor() {
			this.debuggers = /* @__PURE__ */ new Map();
		}
		/**
		* Get or create a debug function for a specific namespace
		* @param category - The debug category (e.g., 'kernel', 'plugin', 'upload')
		* @param subcategory - Optional subcategory for more specific debugging
		* @returns Debug function
		*/
		getDebugger(category, subcategory) {
			const namespace = subcategory ? `${BASE_NAMESPACE}:${category}:${subcategory}` : `${BASE_NAMESPACE}:${category}`;
			if (!this.debuggers.has(namespace)) this.debuggers.set(namespace, createDebug(namespace));
			return this.debuggers.get(namespace);
		}
		/**
		* Create a scoped debug logger for a specific component/service
		* @param category - Main category
		* @param subcategory - Optional subcategory
		* @returns Object with debug methods
		*/
		createLogger(category, subcategory) {
			const debug = this.getDebugger(category, subcategory);
			const warnDebugger = this.getDebugger(category, subcategory ? `${subcategory}:warn` : "warn");
			const errorDebugger = this.getDebugger(category, subcategory ? `${subcategory}:error` : "error");
			const info = this.getDebugger(category, subcategory ? `${subcategory}:info` : "info");
			const warn = (...args) => {
				if (warnDebugger.enabled) {
					const prefix = warnDebugger.namespace;
					console.warn(`${prefix}`, ...args);
				}
			};
			const error = (...args) => {
				if (errorDebugger.enabled) {
					const prefix = errorDebugger.namespace;
					console.error(`${prefix}`, ...args);
				}
			};
			return {
				/**
				* General debug logging
				*/
				debug,
				/**
				* Error level logging - uses console.error for proper browser dev tool support
				*/
				error,
				/**
				* Info level logging
				*/
				info,
				/**
				* Log function - alias for debug for compatibility
				*/
				log: debug,
				/**
				* Warning level logging - uses console.warn for proper browser dev tool support
				*/
				warn
			};
		}
		/**
		* Enable debug for specific namespaces
		* @param namespaces - Comma-separated list of namespaces to enable
		*/
		enable(namespaces) {
			createDebug.enable(namespaces);
		}
		/**
		* Disable all debug output
		*/
		disable() {
			createDebug.disable();
		}
		/**
		* Check if a namespace is enabled
		* @param namespace - The namespace to check
		* @returns Whether the namespace is enabled
		*/
		enabled(namespace) {
			return createDebug.enabled(namespace);
		}
	};
	debugLogger = new DebugLogger();
	debugLoggers = {
		demo: createDebugLogger("demo"),
		file: createDebugLogger("file"),
		image: createDebugLogger("image"),
		kernel: createDebugLogger("kernel"),
		markdown: createDebugLogger("markdown"),
		math: createDebugLogger("math"),
		mention: createDebugLogger("mention"),
		plugin: createDebugLogger("plugin"),
		react: createDebugLogger("react"),
		service: createDebugLogger("service"),
		slash: createDebugLogger("slash"),
		upload: createDebugLogger("upload")
	};
	devConsole = {
		error: (...args) => {
			console.error(...args);
		},
		info: (...args) => {
			console.info(...args);
		},
		log: (...args) => {
			console.log(...args);
		},
		warn: (...args) => {
			console.warn(...args);
		}
	};
	prodSafeLogger = {
		/**
		* Debug info - only shown when debug is enabled
		*/
		debug: debugLoggers.kernel.debug,
		/**
		* Log critical errors that should always be visible (uses console.error)
		*/
		error: (...args) => {
			console.error(...args);
		},
		/**
		* Info logging - only shown when debug is enabled
		*/
		info: debugLoggers.kernel.info,
		/**
		* Log warnings that should always be visible (uses console.warn)
		*/
		warn: (...args) => {
			console.warn(...args);
		}
	};
	browserDebug = {
		/**
		* Disable debug logging in browser environment
		*/
		disable: () => {
			if (typeof window !== "undefined") {
				localStorage.removeItem("debug");
				createDebug.disable();
				console.info("Debug disabled.");
			}
		},
		/**
		* Enable debug logging in browser environment
		* @param namespaces - Debug namespaces to enable (e.g., 'lobe-editor:*')
		*/
		enable: (namespaces = "lobe-editor:*") => {
			if (typeof window !== "undefined") {
				localStorage.debug = namespaces;
				createDebug.enable(namespaces);
				console.info(`Debug enabled: ${namespaces}`);
				console.info("Refresh the page to see debug logs from initialization.");
			}
		},
		/**
		* Get current debug configuration
		*/
		getConfig: () => {
			if (typeof window !== "undefined") {
				const envDebug = typeof process !== "undefined" ? process.env.DEBUG : void 0;
				const currentDebug = localStorage.getItem("debug");
				if (envDebug) return {
					enabled: envDebug,
					source: "environment variable (auto-applied)"
				};
				else if (currentDebug) return {
					enabled: currentDebug,
					source: "development mode (auto-applied)"
				};
				else return {
					enabled: false,
					source: "disabled"
				};
			}
			return {
				enabled: (typeof process !== "undefined" ? process.env.DEBUG : void 0) || false,
				source: "server-side"
			};
		},
		/**
		* Show available debug categories
		*/
		showCategories: () => {
			console.group("Available debug categories:");
			console.log("� lobe-editor:kernel - Core editor functionality");
			console.log("🔌 lobe-editor:plugin:* - All plugins");
			console.log("🔍 lobe-editor:service:* - All services");
			console.log("💬 lobe-editor:*:info - Info level messages");
			console.log("⚠️ lobe-editor:*:warn - Warning messages");
			console.log("❌ lobe-editor:*:error - Error messages");
			console.groupEnd();
			console.info("Usage: browserDebug.enable(\"lobe-editor:kernel,lobe-editor:plugin:*\")");
		},
		/**
		* Show current debug status and configuration
		*/
		showStatus: () => {
			const config = browserDebug.getConfig();
			console.group("� LobeHub Editor Debug Status");
			console.log(`Status: ${config.enabled ? "✅ Enabled" : "❌ Disabled"}`);
			console.log(`Configuration: ${config.enabled || "none"}`);
			console.log(`Source: ${config.source}`);
			console.groupEnd();
			if (!config.enabled) console.info("💡 Zero-config setup: Set DEBUG=lobe-editor:* in your environment");
		}
	};
}));
//#endregion
//#region src/types/hotkey.ts
var KeyEnum, HotkeyEnum, HotkeyScopeEnum;
var init_hotkey$1 = __esmMin((() => {
	KeyEnum = {
		Alt: "alt",
		Backquote: "backquote",
		Backslash: "backslash",
		Backspace: "backspace",
		BracketLeft: "bracketleft",
		BracketRight: "bracketright",
		Comma: "comma",
		Ctrl: "ctrl",
		Down: "down",
		Enter: "enter",
		Equal: "equal",
		Esc: "esc",
		Left: "left",
		LeftClick: "left-click",
		LeftDoubleClick: "left-double-click",
		Meta: "meta",
		MiddleClick: "middle-click",
		Minus: "minus",
		Mod: "mod",
		Number: "1-9",
		Period: "period",
		Plus: "equal",
		QuestionMark: "slash",
		Quote: "quote",
		Right: "right",
		RightClick: "right-click",
		RightDoubleClick: "right-double-click",
		Semicolon: "semicolon",
		Shift: "shift",
		Slash: "slash",
		Space: "space",
		Tab: "tab",
		Up: "up",
		Zero: "0"
	};
	HotkeyEnum = {
		Bold: "bold",
		BulletList: "bulletList",
		CodeInline: "codeInline",
		Italic: "italic",
		Link: "link",
		Mention: "mention",
		NumberList: "numberList",
		PasteAsPlainText: "pasteAsPlainText",
		Redo: "redo",
		Slash: "slash",
		Strikethrough: "strikethrough",
		Underline: "underline",
		Undo: "undo"
	};
	HotkeyScopeEnum = {
		Format: "format",
		Insert: "insert",
		Plugin: "plugin",
		Slash: "slash"
	};
}));
//#endregion
//#region src/const/hotkey.ts
var combineKeys, HOTKEYS_REGISTRATION;
var init_hotkey = __esmMin((() => {
	init_hotkey$1();
	combineKeys = (keys) => keys.join("+");
	HOTKEYS_REGISTRATION = [
		{
			id: HotkeyEnum.Undo,
			keys: combineKeys([KeyEnum.Mod, "z"]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Format]
		},
		{
			id: HotkeyEnum.Redo,
			keys: combineKeys([KeyEnum.Mod, "y"]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Format]
		},
		{
			id: HotkeyEnum.Bold,
			keys: combineKeys([KeyEnum.Mod, "b"]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Format]
		},
		{
			id: HotkeyEnum.Italic,
			keys: combineKeys([KeyEnum.Mod, "i"]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Format]
		},
		{
			id: HotkeyEnum.Underline,
			keys: combineKeys([KeyEnum.Mod, "u"]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Format]
		},
		{
			id: HotkeyEnum.Strikethrough,
			keys: combineKeys([
				KeyEnum.Mod,
				KeyEnum.Shift,
				"x"
			]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Format]
		},
		{
			id: HotkeyEnum.CodeInline,
			keys: combineKeys([KeyEnum.Mod, "e"]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Format, HotkeyScopeEnum.Plugin]
		},
		{
			id: HotkeyEnum.Link,
			keys: combineKeys([
				KeyEnum.Mod,
				KeyEnum.Shift,
				"k"
			]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Format, HotkeyScopeEnum.Plugin]
		},
		{
			id: HotkeyEnum.NumberList,
			keys: combineKeys([
				KeyEnum.Mod,
				KeyEnum.Shift,
				"7"
			]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Insert, HotkeyScopeEnum.Plugin]
		},
		{
			id: HotkeyEnum.BulletList,
			keys: combineKeys([
				KeyEnum.Mod,
				KeyEnum.Shift,
				"8"
			]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Insert, HotkeyScopeEnum.Plugin]
		},
		{
			id: HotkeyEnum.PasteAsPlainText,
			keys: combineKeys([
				KeyEnum.Mod,
				KeyEnum.Shift,
				"v"
			]),
			priority: COMMAND_PRIORITY_LOW,
			scopes: [HotkeyScopeEnum.Format]
		}
	];
})), nodeDetect, browserDetect, isNode, isBrowser, macOSDetect, CONTROL_OR_META;
var init_sys = __esmMin((() => {
	nodeDetect = () => {
		return typeof process !== "undefined" && process.versions && !!process.versions.node;
	};
	browserDetect = () => {
		return typeof window !== "undefined" && window.document !== void 0;
	};
	isNode = nodeDetect();
	isBrowser = browserDetect();
	macOSDetect = () => {
		if (isNode) return process.platform === "darwin";
		if (isBrowser) return window.navigator.platform.includes("Mac");
		return false;
	};
	macOSDetect();
	CONTROL_OR_META = {
		ctrlKey: !IS_APPLE,
		metaKey: IS_APPLE
	};
}));
//#endregion
//#region src/utils/hotkey/parseHotkeys.ts
function mapCode(key) {
	return (mappedKeys[key.trim()] || key.trim()).toLowerCase().replace(/key|digit|numpad/, "");
}
function parseHotkey(hotkey) {
	let keys = [];
	keys = hotkey.toLocaleLowerCase().split("+").map((k) => mapCode(k));
	const modifiers = {
		altKey: keys.includes("alt"),
		ctrlKey: keys.includes("ctrl") || keys.includes("control") || (!isApple ? keys.includes("mod") : false),
		metaKey: keys.includes("meta") || (isApple ? keys.includes("mod") : false),
		shiftKey: keys.includes("shift")
	};
	return {
		key: keys.find((k) => !reservedModifierKeywords.has(k)),
		modifiers
	};
}
var reservedModifierKeywords, mappedKeys;
var init_parseHotkeys = __esmMin((() => {
	init_sys();
	reservedModifierKeywords = new Set([
		"shift",
		"alt",
		"meta",
		"mod",
		"ctrl",
		"control"
	]);
	mappedKeys = {
		AltLeft: "alt",
		AltRight: "alt",
		ControlLeft: "ctrl",
		ControlRight: "ctrl",
		MetaLeft: "meta",
		MetaRight: "meta",
		OSLeft: "meta",
		OSRight: "meta",
		ShiftLeft: "shift",
		ShiftRight: "shift",
		down: "arrowdown",
		esc: "escape",
		left: "arrowleft",
		return: "enter",
		right: "arrowright",
		up: "arrowup"
	};
}));
//#endregion
//#region src/utils/hotkey/isHotkeyMatch.ts
var isHotkeyMatch;
var init_isHotkeyMatch = __esmMin((() => {
	init_parseHotkeys();
	isHotkeyMatch = (event, hotkey) => {
		const keys = parseHotkey(hotkey);
		if (!isModifierMatch(event, keys.modifiers)) return false;
		if (mapCode(event.code) !== keys.key) return false;
		return true;
	};
}));
//#endregion
//#region src/utils/hotkey/registerHotkey.ts
var logger$3, registerHotkey, getHotkeyById;
var init_registerHotkey = __esmMin((() => {
	init_hotkey();
	init_debug();
	init_parseHotkeys();
	init_isHotkeyMatch();
	logger$3 = createDebugLogger("hotkey");
	registerHotkey = (hotkey, callback, options = {}) => {
		return (e) => {
			if (!isHotkeyMatch(e, hotkey.keys)) return false;
			const keys = parseHotkey(hotkey.keys);
			if (options.preventDefault) e.preventDefault();
			if (options.stopPropagation) e.stopPropagation();
			callback(e, {
				keys: hotkey.keys,
				...keys,
				scopes: hotkey.scopes
			});
			logger$3.debug(`⌨️ Hotkey matched: ${hotkey.id} [${hotkey.keys}]`, hotkey);
			return true;
		};
	};
	getHotkeyById = (id) => {
		return HOTKEYS_REGISTRATION.find((hotkey) => hotkey.id === id);
	};
}));
//#endregion
//#region src/editor-kernel/event.ts
function registerEvent(editor, dom) {
	const hoverHandler = (event) => {
		editor.dispatchCommand(HOVER_COMMAND, event);
	};
	dom.addEventListener("mouseenter", hoverHandler);
	return () => {
		dom.removeEventListener("mouseenter", hoverHandler);
	};
}
var HOVER_COMMAND;
var init_event = __esmMin((() => {
	HOVER_COMMAND = createCommand();
}));
//#endregion
//#region src/editor-kernel/plugin.ts
var KernelPlugin;
var init_plugin = __esmMin((() => {
	KernelPlugin = class extends EventEmitter {
		constructor(..._args) {
			super(..._args);
			this.clears = [];
			this.registeredDecorators = /* @__PURE__ */ new Set();
		}
		register(clear) {
			this.clears.push(clear);
		}
		registerClears(...clears) {
			clears.forEach((clear) => this.register(clear));
		}
		/**
		* Register a decorator and track it for cleanup
		*/
		registerDecorator(kernel, name, decorator) {
			kernel.registerDecorator(name, decorator);
			this.registeredDecorators.add(name);
		}
		/**
		* Unregister a specific decorator
		*/
		unregisterDecorator(kernel, name) {
			const result = kernel.unregisterDecorator(name);
			if (result) this.registeredDecorators.delete(name);
			return result;
		}
		/**
		* Get all decorator names registered by this plugin
		*/
		getRegisteredDecorators() {
			return Array.from(this.registeredDecorators);
		}
		destroy() {
			this.clears.forEach((clear) => clear());
			this.registeredDecorators.clear();
		}
	};
}));
//#endregion
//#region src/editor-kernel/kernel.ts
var kernel_exports = /* @__PURE__ */ __exportAll({ Kernel: () => Kernel });
var Kernel;
var init_kernel = __esmMin((() => {
	init_locale();
	init_utils();
	init_debug();
	init_registerHotkey();
	init_event();
	init_plugin();
	init_utils$1();
	templateSettings.interpolate = /{{([\S\s]+?)}}/g;
	Kernel = class Kernel extends EventEmitter {
		static {
			this.globalHotReloadMode = void 0;
		}
		constructor() {
			super();
			this.plugins = [];
			this.pluginsConfig = /* @__PURE__ */ new Map();
			this.pluginsInstances = [];
			this.nodes = [];
			this.themes = { [EDITOR_THEME_KEY]: generateEditorId() };
			this.decorators = {};
			this.serviceMap = /* @__PURE__ */ new Map();
			this.localeMap = locale;
			this.hotReloadMode = false;
			this.logger = createDebugLogger("kernel");
			this.historyState = createEmptyHistoryState();
			this.headlessEditor = false;
			this._commands = /* @__PURE__ */ new Map();
			this._commandsClean = /* @__PURE__ */ new Map();
			this.dataTypeMap = /* @__PURE__ */ new Map();
			this.hotReloadMode = this.detectDevelopmentMode();
			this.logger.info(`🚀 Kernel initialized (hot reload: ${this.hotReloadMode})`);
		}
		getHistoryState() {
			return this.historyState;
		}
		isEditable() {
			return this.editor?.isEditable() || false;
		}
		detectDevelopmentMode() {
			if (Kernel.globalHotReloadMode !== void 0) return Kernel.globalHotReloadMode;
			if (typeof process !== "undefined" && true) return true;
			if (typeof window !== "undefined") {
				if (window.webpackHotUpdate) return true;
				if (window.__vite_plugin_react_preamble_installed__) return true;
				if (window.__NEXT_DATA__?.buildId === "development") return true;
			}
			if (typeof window !== "undefined" && window.location) {
				const hostname = window.location.hostname;
				if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) return true;
			}
			return true;
		}
		/**
		* Globally enable or disable hot reload mode for all kernel instances
		* @param enabled Whether to enable hot reload mode globally
		*/
		static setGlobalHotReloadMode(enabled) {
			Kernel.globalHotReloadMode = enabled;
		}
		/**
		* Reset global hot reload mode to automatic detection
		*/
		static resetGlobalHotReloadMode() {
			Kernel.globalHotReloadMode = void 0;
		}
		getLexicalEditor() {
			return this.editor || null;
		}
		destroy() {
			unregisterEditorKernel(this.themes[EDITOR_THEME_KEY]);
			this.logger.info(`🗑️ Destroying editor with ${this.pluginsInstances.length} plugins`);
			try {
				this.editor?.setEditorState(createEmptyEditorState());
			} catch (error) {
				this.logger.warn("Failed to reset editor state during destroy:", error);
			}
			this.dataTypeMap.clear();
			this.pluginsInstances.forEach((plugin) => {
				if (plugin.destroy) plugin.destroy();
			});
			this.pluginsInstances = [];
			this.serviceMap.clear();
			this.decorators = {};
			this.themes = {};
			this.headlessEditor = false;
			this.editor = void 0;
			this.logger.info("✅ Editor destroyed");
		}
		getRootElement() {
			if (this.headlessEditor) return null;
			return this.editor?.getRootElement() || null;
		}
		setRootElement(dom, editable = true) {
			if (this.editor) {
				if (this.headlessEditor) throw new Error("Headless editor cannot be attached to a root element.");
				this.logger.warn("[Editor] Editor is already initialized, updating root element only");
				this.editor.setRootElement(dom);
				return this.editor;
			}
			if (this.pluginsInstances.length === 0) {
				this.logger.info(`🔌 Initializing ${this.plugins.length} plugins`);
				for (const plugin of this.plugins) {
					const instance = new plugin(this, this.pluginsConfig.get(plugin));
					this.pluginsInstances.push(instance);
				}
			}
			this.logger.info(`📝 Creating editor with ${this.nodes.length} nodes`);
			registerEditorKernel(this.themes[EDITOR_THEME_KEY], this);
			const editor = this.editor = createEditor({
				__kernel: this,
				editable,
				namespace: "lobehub",
				nodes: this.nodes,
				onError: (error) => {
					this.logger.error("❌ Lexical editor error:", error);
					this.emit("error", error);
				},
				theme: this.themes
			});
			this.headlessEditor = false;
			this.editor.setRootElement(dom);
			registerEvent(editor, dom);
			this.pluginsInstances.forEach((plugin) => {
				plugin.onInit?.(editor);
			});
			this.logger.info(`✅ Editor ready with ${this.pluginsInstances.length} plugins`);
			this.emit("initialized", editor);
			return this.editor;
		}
		setEditable(editable) {
			if (!this.editor) {
				this.logger.error("❌ Editor not initialized");
				throw new Error(`Editor is not initialized.`);
			}
			this.editor.setEditable(editable);
			this.emit("editableChange", editable);
			this.logger.debug(`✏️ Editor editable set to ${editable}`);
		}
		initNodeEditor() {
			if (this.editor) return this.editor;
			if (this.pluginsInstances.length === 0) {
				this.logger.info(`🔌 Initializing ${this.plugins.length} plugins`);
				for (const plugin of this.plugins) {
					const instance = new plugin(this, this.pluginsConfig.get(plugin));
					this.pluginsInstances.push(instance);
				}
			}
			this.logger.info(`📝 Creating editor with ${this.nodes.length} nodes`);
			const editor = this.editor = createEditor({
				__kernel: this,
				namespace: "lobehub",
				nodes: this.nodes,
				onError: (error) => {
					this.logger.error("❌ Lexical editor error:", error);
					this.emit("error", error);
				},
				theme: this.themes
			});
			this.headlessEditor = false;
			this.pluginsInstances.forEach((plugin) => {
				plugin.onInit?.(editor);
			});
			this.logger.info(`✅ Editor ready with ${this.pluginsInstances.length} plugins`);
			this.emit("initialized", editor);
			return editor || null;
		}
		initHeadlessEditor() {
			if (this.editor) return this.editor;
			if (this.pluginsInstances.length === 0) {
				this.logger.info(`🔌 Initializing ${this.plugins.length} plugins`);
				for (const plugin of this.plugins) {
					const instance = new plugin(this, this.pluginsConfig.get(plugin));
					this.pluginsInstances.push(instance);
				}
			}
			this.logger.info(`📝 Creating headless editor with ${this.nodes.length} nodes`);
			const editor = this.editor = createHeadlessEditor({
				__kernel: this,
				namespace: "lobehub-headless",
				nodes: this.nodes,
				onError: (error) => {
					this.logger.error("❌ Lexical headless editor error:", error);
					this.emit("error", error);
				},
				theme: this.themes
			});
			this.headlessEditor = true;
			this.pluginsInstances.forEach((plugin) => {
				plugin.onInit?.(editor);
			});
			this.logger.info(`✅ Headless editor ready with ${this.pluginsInstances.length} plugins`);
			this.emit("initialized", editor);
			return editor || null;
		}
		setDocument(type, content, options) {
			const datasource = this.dataTypeMap.get(type);
			if (!datasource) {
				this.logger.error(`❌ DataSource for type "${type}" not found`);
				throw new Error(`DataSource for type "${type}" is not registered.`);
			}
			if (!this.editor) {
				this.logger.error("❌ Editor not initialized");
				throw new Error(`Editor is not initialized.`);
			}
			if (!options?.keepHistory) {
				this.historyState.redoStack = [];
				this.historyState.undoStack = [];
				this.historyState.current = null;
			}
			datasource.read(this.editor, content, options);
			this.emit("documentChange", type, content);
			this.logger.debug(`📥 Set ${type} document`);
		}
		setSelection(selection, opt) {
			if (!this.editor) {
				this.logger.error("❌ Editor not initialized");
				throw new Error(`Editor is not initialized.`);
			}
			const editor = this.editor;
			return new Promise((resolve) => {
				editor.update(() => {
					try {
						if (selection.type === "range") {
							const startNodeId = opt?.collapseToEnd ? selection.endNodeId : selection.startNodeId;
							const endNodeId = opt?.collapseToStart ? selection.startNodeId : selection.endNodeId;
							const startOffset = opt?.collapseToEnd ? selection.endOffset : selection.startOffset;
							const endOffset = opt?.collapseToStart ? selection.startOffset : selection.endOffset;
							const anchorNode = $getNodeByKey(startNodeId);
							const focusNode = $getNodeByKey(endNodeId);
							if (!anchorNode || !focusNode) {
								this.logger.error("❌ Nodes for selection not found");
								resolve(false);
								return;
							}
							const rng = $createRangeSelection();
							rng.anchor.set(anchorNode.getKey(), startOffset, $isElementNode(anchorNode) ? "element" : "text");
							rng.focus.set(focusNode.getKey(), endOffset, $isElementNode(focusNode) ? "element" : "text");
							$setSelection(rng);
							resolve(true);
							return;
						}
						if (selection.type === "node") {
							if (!$getNodeByKey(selection.startNodeId)) {
								this.logger.error("❌ Node for selection not found");
								resolve(false);
								return;
							}
							const nodeSel = $createNodeSelection();
							nodeSel.add(selection.startNodeId);
							$setSelection(nodeSel);
							resolve(true);
							return;
						}
						if (selection.type === "table") {
							const startNode = $getNodeByKey(selection.startNodeId);
							if (!startNode) {
								this.logger.error("❌ Node for selection not found");
								resolve(false);
								return;
							}
							const endNode = $getNodeByKey(selection.endNodeId);
							if (!endNode) {
								this.logger.error("❌ Node for selection not found");
								resolve(false);
								return;
							}
							const table1 = $closest(startNode, (n) => $isTableNode(n));
							const table2 = $closest(endNode, (n) => $isTableNode(n));
							if (!table1 || !table2 || table1 !== table2) {
								this.logger.error("❌ Table nodes for selection not found or do not match");
								resolve(false);
								return;
							}
							const rng = $createTableSelection();
							rng.set(table1.getKey(), selection.startNodeId, selection.endNodeId);
							$setSelection(rng);
							resolve(true);
							return;
						}
						resolve(false);
					} catch (error) {
						this.logger.error("❌ Error setting selection:", error);
						resolve(false);
					}
				});
			});
		}
		getSelection() {
			if (!this.editor) {
				this.logger.error("❌ Editor not initialized");
				throw new Error(`Editor is not initialized.`);
			}
			return this.editor.read(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) return {
					endNodeId: selection.focus.getNode().getKey(),
					endOffset: selection.focus.offset,
					startNodeId: selection.anchor.getNode().getKey(),
					startOffset: selection.anchor.offset,
					type: "range"
				};
				if ($isNodeSelection(selection)) return {
					endNodeId: selection.getNodes()[0].getKey(),
					endOffset: 0,
					startNodeId: selection.getNodes()[0].getKey(),
					startOffset: 0,
					type: "node"
				};
				if ($isTableSelection(selection)) {
					const [start, end] = selection.getStartEndPoints();
					return {
						endNodeId: end.getNode().getKey(),
						endOffset: end.offset,
						startNodeId: start.getNode().getKey(),
						startOffset: start.offset,
						type: "table"
					};
				}
				return null;
			});
		}
		focus() {
			if (this.headlessEditor) return;
			this.editor?.focus();
		}
		blur() {
			if (this.headlessEditor) return;
			this.editor?.blur();
		}
		getDocument(type) {
			const datasource = this.dataTypeMap.get(type);
			if (!datasource) {
				this.logger.error(`❌ DataSource for type "${type}" not found`);
				throw new Error(`DataSource for type "${type}" is not registered.`);
			}
			if (!this.editor) {
				this.logger.error("❌ Editor not initialized");
				throw new Error(`Editor is not initialized.`);
			}
			return datasource.write(this.editor);
		}
		getSelectionDocument(type) {
			const datasource = this.dataTypeMap.get(type);
			if (!datasource) throw new Error(`DataSource for type "${type}" is not registered.`);
			if (!this.editor) throw new Error(`Editor is not initialized.`);
			return datasource.write(this.editor, { selection: true });
		}
		registerDecorator(name, decorator) {
			if (this.decorators[name]) if (this.hotReloadMode) {
				this.logger.warn(`🔄 Hot reload: decorator "${name}"`);
				this.decorators[name] = decorator;
				return this;
			} else {
				if (this.decorators[name] === decorator) {
					this.logger.warn(`[Editor] Decorator "${name}" is already registered with the same function`);
					return this;
				}
				this.logger.error(`[Editor] Attempting to register duplicate decorator "${name}". Enable hot reload mode if this is intended.`);
				throw new Error(`Decorator with name "${name}" is already registered.`);
			}
			this.decorators[name] = decorator;
			this.logger.debug(`🎭 Decorator: ${name}`);
			return this;
		}
		getDecorator(name) {
			return this.decorators[name];
		}
		/**
		* Unregister a decorator
		* @param name Decorator name
		*/
		unregisterDecorator(name) {
			if (this.decorators[name]) {
				delete this.decorators[name];
				this.logger.debug(`🗑️ Removed decorator: ${name}`);
				return true;
			}
			this.logger.warn(`⚠️ Decorator "${name}" not found`);
			return false;
		}
		/**
		* Get all registered decorator names
		*/
		getRegisteredDecorators() {
			return Object.keys(this.decorators);
		}
		/**
		* Support registering target data source
		* @param dataSource Data source
		*/
		registerDataSource(dataSource) {
			this.dataTypeMap.set(dataSource.type, dataSource);
			this.logger.debug(`📄 Data source: ${dataSource.type}`);
		}
		registerThemes(themes) {
			this.themes = merge(this.themes, themes);
		}
		registerPlugin(plugin, config) {
			const findPlugin = this.plugins.find((p) => p.pluginName === plugin.pluginName);
			if (findPlugin) if (findPlugin !== plugin) if (this.hotReloadMode) {
				this.logger.warn(`🔄 Hot reload: plugin "${plugin.pluginName}"`);
				const index = this.plugins.findIndex((p) => p.pluginName === plugin.pluginName);
				if (index !== -1) {
					this.plugins.splice(index, 1);
					const instanceIndex = this.pluginsInstances.findIndex((instance) => {
						return instance.constructor.pluginName === plugin.pluginName;
					});
					if (instanceIndex !== -1) {
						const oldInstance = this.pluginsInstances[instanceIndex];
						if (oldInstance instanceof KernelPlugin) {
							const decoratorNames = oldInstance.getRegisteredDecorators();
							for (const decoratorName of decoratorNames) {
								this.unregisterDecorator(decoratorName);
								this.logger.debug(`🧨 Cleanup: decorator "${decoratorName}"`);
							}
						}
						if (oldInstance.destroy) oldInstance.destroy();
						this.pluginsInstances.splice(instanceIndex, 1);
					}
				}
			} else throw new Error(`Plugin with name "${plugin.pluginName}" is already registered with a different implementation.`);
			else {
				if (config !== void 0) this.pluginsConfig.set(plugin, config);
				return this;
			}
			this.pluginsConfig.set(plugin, config || {});
			this.plugins.push(plugin);
			this.logger.debug(`🔌 Plugin: ${plugin.pluginName}`);
			return this;
		}
		registerPlugins(plugins) {
			for (const plugin of plugins) if (Array.isArray(plugin)) this.registerPlugin(plugin[0], plugin[1]);
			else this.registerPlugin(plugin);
			this.logger.debug(`🔌 Registered ${plugins.length} plugins`);
			return this;
		}
		registerNodes(nodes) {
			const nodeTypes = nodes.map((node) => {
				if (typeof node === "function" && node.getType) return node.getType();
				else if (typeof node === "object" && node.replace && typeof node.replace === "function" && node.replace.getType) return node.replace.getType();
				return "unknown";
			}).filter((type) => type !== "unknown");
			this.nodes.push(...nodes);
			if (nodeTypes.length > 3) this.logger.debug(`🧩 Nodes: ${nodeTypes.length} types`);
			else this.logger.debug(`🧩 Nodes: ${nodeTypes.join(", ")}`);
		}
		registerService(serviceId, service) {
			const serviceIdString = serviceId.__serviceId;
			if (this.serviceMap.has(serviceIdString)) if (this.hotReloadMode) {
				this.logger.warn(`🔄 Hot reload: service "${serviceIdString}"`);
				this.serviceMap.set(serviceIdString, service);
				return;
			} else {
				if (this.serviceMap.get(serviceIdString) === service) {
					this.logger.warn(`[Editor] Service "${serviceIdString}" is already registered with the same instance`);
					return;
				}
				this.logger.error(`[Editor] Attempting to register duplicate service "${serviceIdString}". Enable hot reload mode if this is intended.`);
				throw new Error(`Service with ID "${serviceIdString}" is already registered.`);
			}
			this.serviceMap.set(serviceIdString, service);
			this.logger.debug(`🔧 Service: ${serviceIdString}`);
		}
		/**
		* Register service with hot reload support - allows overriding existing services
		* @param serviceId Service identifier
		* @param service Service instance
		*/
		registerServiceHotReload(serviceId, service) {
			this.serviceMap.set(serviceId.__serviceId, service);
			this.logger.debug(`🔄 Hot-reload service: ${serviceId.__serviceId}`);
		}
		/**
		* Enable or disable hot reload mode
		* @param enabled Whether to enable hot reload mode
		*/
		setHotReloadMode(enabled) {
			this.hotReloadMode = enabled;
		}
		/**
		* Check if hot reload mode is enabled
		*/
		isHotReloadMode() {
			return this.hotReloadMode;
		}
		/**
		* Get service
		* @param serviceId Service ID
		*/
		requireService(serviceId) {
			const service = this.serviceMap.get(serviceId.__serviceId);
			if (!service) return null;
			return service;
		}
		dispatchCommand(type, payload) {
			if (!this.editor) throw new Error("Editor is not initialized.");
			return this.editor.dispatchCommand(type, payload);
		}
		getTheme() {
			return this.themes;
		}
		updateTheme(key, value) {
			this.themes[key] = value;
		}
		registerLocale(locale) {
			const localeKeys = Object.keys(locale);
			this.localeMap = merge(this.localeMap, locale);
			this.logger.debug(`🌐 Locale: ${localeKeys.length} keys`);
		}
		setLocale(locale) {
			/** Deep-merge so nested namespaces (e.g. `meta2d.editor`) are not wiped by a partial top-level `meta2d`. */
			this.localeMap = merge({}, this.localeMap, locale);
			this.logger.debug(`🌐 Locale merged: ${Object.keys(locale).length} top-level keys`);
		}
		t(key, params) {
			let translation = get(this.localeMap, key) || key;
			if (params) translation = template(translation)(params);
			return translation;
		}
		get isEmpty() {
			if (!this.editor) return true;
			return this.editor.getEditorState().read(() => {
				return $isRootTextContentEmpty(this.editor.isComposing(), true);
			});
		}
		get isSelected() {
			if (!this.editor) return false;
			return this.editor.getEditorState().read(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) return !!selection._cachedNodes;
				return false;
			});
		}
		cleanDocument() {
			this.setDocument("text", "");
		}
		registerHotkey(hotkeyId, callback, options = {}) {
			const lexicalEditor = this.editor;
			if (!lexicalEditor) throw new Error("Editor is not initialized.");
			const hotkey = getHotkeyById(hotkeyId);
			if (!hotkey) return () => false;
			if (options.enabled === false) return () => false;
			this.logger.debug(`⌨️ Hotkey: ${hotkey.id}`);
			return lexicalEditor.registerCommand(KEY_DOWN_COMMAND, registerHotkey(hotkey, callback, options), hotkey.priority);
		}
		registerHighCommand(command, listener, priority) {
			const lexicalEditor = this.editor;
			if (!lexicalEditor) throw new Error("Editor is not initialized.");
			const commandsMap = this._commands;
			if (!commandsMap.has(command)) {
				commandsMap.set(command, [
					/* @__PURE__ */ new Set(),
					/* @__PURE__ */ new Set(),
					/* @__PURE__ */ new Set(),
					/* @__PURE__ */ new Set(),
					/* @__PURE__ */ new Set()
				]);
				this._commandsClean.set(command, lexicalEditor.registerCommand(command, (payload) => {
					for (let i = 4; i >= 0; i--) {
						const listenerInPriorityOrder = this._commands.get(command);
						if (listenerInPriorityOrder !== void 0) {
							const listenersSet = listenerInPriorityOrder[i];
							for (const listener of listenersSet) if (listener(payload, lexicalEditor)) return true;
						}
					}
					return false;
				}, COMMAND_PRIORITY_CRITICAL));
				if (!command.type?.includes("KEY")) this.logger.debug(`⚡ Command: ${command.type || "unknown"}`);
			}
			const listenersInPriorityOrder = commandsMap.get(command);
			if (listenersInPriorityOrder === void 0) return noop;
			const listeners = listenersInPriorityOrder[priority];
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
				if (listenersInPriorityOrder.every((listenersSet) => listenersSet.size === 0)) {
					commandsMap.delete(command);
					this._commandsClean.get(command)?.();
				}
			};
		}
	};
}));
//#endregion
//#region src/editor-kernel/data-source.ts
init_kernel();
var DataSource = class {
	constructor(dataType) {
		this.dataType = dataType;
	}
	get type() {
		return this.dataType;
	}
	read(editor, data, options) {}
	write(editor, options) {
		return null;
	}
};
//#endregion
//#region src/editor-kernel/index.ts
init_utils$1();
init_event();
/**
* Editor object to create an instance of the editor
*/
const Editor = { createEditor() {
	return new Kernel();
} };
//#endregion
//#region src/plugins/common/node/cursor.ts
init_debug();
const logger$2 = createDebugLogger("common", "cursor");
var CardLikeElementNode = class extends ElementNode {
	isCardLike() {
		return true;
	}
};
const cursorNodeSerialized = {
	detail: 0,
	format: 0,
	mode: "normal",
	style: "",
	text: "﻿",
	type: "cursor",
	version: 1
};
var CursorNode = class extends TextNode {
	static getType() {
		return "cursor";
	}
	isUnmergeable() {
		return true;
	}
};
function $createCursorNode() {
	return new CursorNode("﻿");
}
function $isCardLikeElementNode(node) {
	return node instanceof CardLikeElementNode;
}
function $isCursorNode(node) {
	return node instanceof CursorNode;
}
function registerCursorNode(editor) {
	return mergeRegister(editor.registerUpdateListener(({ mutatedNodes }) => {
		editor.getEditorState().read(() => {
			if (!mutatedNodes) return;
			const needAddCursor = [];
			for (const [kClass, nodeMaps] of mutatedNodes) if (DecoratorNode.prototype.isPrototypeOf(kClass.prototype)) for (const [key, mutation] of nodeMaps) {
				const node = $getNodeByKey(key);
				logger$2.debug("🎭 DecoratorNode mutated:", node?.getType(), mutation, node);
				if (mutation === "created" && node?.isInline() && node.getNextSibling() === null) needAddCursor.push(node);
			}
			if (needAddCursor.length > 0) editor.update(() => {
				needAddCursor.forEach((node) => {
					node.insertAfter($createCursorNode());
				});
			}, { tag: HISTORY_MERGE_TAG });
			return false;
		});
	}), editor.registerUpdateListener(({ mutatedNodes }) => {
		editor.getEditorState().read(() => {
			const cursorNodes = mutatedNodes?.get(CursorNode);
			const needRemove = /* @__PURE__ */ new Set();
			if (cursorNodes) {
				for (const [key, mutation] of cursorNodes) if (mutation === "updated") {
					const cursorNode = $getNodeByKey(key);
					if (cursorNode?.getIndexWithinParent() === 0) {
						const nextElement = cursorNode.getNextSibling();
						if (!$isCardLikeElementNode(nextElement) && !$isDecoratorNode(nextElement) && !$isCardLikeElementNode(cursorNode?.getParent())) needRemove.add(cursorNode);
						else continue;
					}
					const element = cursorNode?.getPreviousSibling();
					if (!$isCardLikeElementNode(element) && !$isDecoratorNode(element) && !$isCardLikeElementNode(cursorNode?.getParent())) needRemove.add(cursorNode);
				}
			}
			if (needRemove.size > 0) editor.update(() => {
				needRemove.forEach((node) => {
					node.remove();
				});
			}, { tag: HISTORY_MERGE_TAG });
			return false;
		});
	}), editor.registerUpdateListener(() => {
		editor.getEditorState().read(() => {
			const selection = $getSelection();
			if (editor.isComposing()) return false;
			if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
			const node = selection.anchor.getNode();
			if (node instanceof CursorNode) {
				if (node.__text !== "﻿") editor.update(() => {
					node.setTextContent("﻿");
					const data = node.__text.replace("﻿", "");
					if (data) {
						const textNode = $createTextNode(data);
						node.insertAfter(textNode);
						textNode.selectEnd();
					}
				}, { tag: HISTORY_MERGE_TAG });
				return false;
			}
		});
	}), editor.registerCommand(KEY_BACKSPACE_COMMAND, (event) => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
		const node = selection.anchor.getNode();
		if (node instanceof CursorNode) {
			event.preventDefault();
			const prev = node.getPreviousSibling();
			const parent = node.getParent();
			const parentPrev = parent?.getPreviousSibling();
			let needDispatch = false;
			if ($isDecoratorNode(prev)) {
				prev.selectPrevious();
				node.remove();
				prev.remove();
				event.preventDefault();
				return true;
			} else if (prev) {
				prev.selectEnd();
				needDispatch = true;
			} else if (parent) {
				if (parent.getChildrenSize() === 1) parent.remove();
				else if (parentPrev) {
					parentPrev.selectEnd();
					needDispatch = true;
				}
			}
			if (needDispatch) queueMicrotask(() => {
				editor.dispatchCommand(KEY_BACKSPACE_COMMAND, event);
			});
			return true;
		}
		return false;
	}, COMMAND_PRIORITY_HIGH), editor.registerCommand(KEY_ARROW_LEFT_COMMAND, (event) => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return false;
		const focusNode = selection.focus.getNode();
		if (!event.shiftKey) {
			if (focusNode instanceof CursorNode && !$isCardLikeElementNode(focusNode.getParent()) && !$isCardLikeElementNode(focusNode.getPreviousSibling())) focusNode.selectStart();
			return false;
		}
		const prev = focusNode.getPreviousSibling();
		if (selection.focus.offset === 0 && $isCursorNode(prev)) try {
			const { key: anchorKey, offset: anchorOffset, type: anchorType } = selection.anchor;
			const sel = prev.selectPrevious();
			const { key, offset, type } = sel.anchor;
			sel.anchor.set(anchorKey, anchorOffset, anchorType);
			sel.focus.set(key, offset, type);
			$setSelection(sel);
			return true;
		} catch (error) {
			logger$2.error("❌ Cursor selection error:", error);
		}
		else if ($isCursorNode(focusNode)) try {
			const { key: anchorKey, offset: anchorOffset, type: anchorType } = selection.anchor;
			const sel = focusNode.selectPrevious();
			const { key, offset, type } = sel.anchor;
			sel.anchor.set(anchorKey, anchorOffset, anchorType);
			sel.focus.set(key, offset, type);
			$setSelection(sel);
			return true;
		} catch (error) {
			logger$2.error("❌ Cursor navigation error:", error);
		}
		return false;
	}, COMMAND_PRIORITY_HIGH), editor.registerCommand(KEY_ARROW_RIGHT_COMMAND, (event) => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return false;
		if (!event.shiftKey) {
			const focusNode = selection.focus.getNode();
			if (focusNode instanceof CursorNode && !$isCardLikeElementNode(focusNode.getParent()) && !$isCardLikeElementNode(focusNode.getPreviousSibling())) focusNode.selectEnd();
			return false;
		}
		const { key: anchorKey, offset: anchorOffset, type: anchorType } = selection.anchor;
		const { key: focusKey, offset: focusOffset, type: focusType } = selection.focus;
		const focusNode = selection.focus.getNode();
		if (focusType === "text" && focusOffset !== focusNode.getTextContentSize() || focusType === "element" && focusOffset !== focusNode.getChildrenSize()) return false;
		const sel = focusNode.selectNext();
		if ($isCursorNode(sel.focus.getNode())) {
			sel.focus.getNode().selectNext();
			const { key, offset, type } = sel.anchor;
			sel.anchor.set(anchorKey, anchorOffset, anchorType);
			sel.focus.set(key, offset, type);
			$setSelection(sel);
			return true;
		} else {
			selection.anchor.set(anchorKey, anchorOffset, anchorType);
			selection.focus.set(focusKey, focusOffset, focusType);
		}
		return false;
	}, COMMAND_PRIORITY_HIGH));
}
//#endregion
//#region src/plugins/codemirror-block/node/CodeMirrorNode.ts
init_utils$1();
const LANGUAGE_DATA_ATTRIBUTE = "data-language";
const THEME_DATA_ATTRIBUTE = "data-theme";
const DEFAULT_OPTIONS = {
	indentWithTabs: false,
	lineNumbers: false,
	tabSize: 2
};
function hasChildDOMNodeTag(node, tagName) {
	for (const child of node.childNodes) {
		if (isHTMLElement(child) && child.tagName === tagName) return true;
		hasChildDOMNodeTag(child, tagName);
	}
	return false;
}
function isGitHubCodeTable(table) {
	return table.classList.contains("js-file-line-container");
}
function isGitHubCodeCell(cell) {
	return cell.classList.contains("js-file-line");
}
var CodeMirrorNode = class CodeMirrorNode extends DecoratorNode {
	static getType() {
		return "code";
	}
	static clone(node) {
		return new CodeMirrorNode(node.__lang, node.__code, node.__codeTheme, node.__options, node.__key);
	}
	static importJSON(serializedNode) {
		let code = serializedNode.code;
		if ("children" in serializedNode) code = serializedNode.children?.map((child) => child.text).join("") || "";
		return $createCodeMirrorNode(serializedNode.language, code, serializedNode.codeTheme, serializedNode.options).updateFromJSON(serializedNode);
	}
	static importDOM() {
		return {
			code: (node) => {
				return node.textContent !== null && (/\r?\n/.test(node.textContent) || hasChildDOMNodeTag(node, "BR")) ? {
					conversion: $convertPreElement,
					priority: 1
				} : null;
			},
			div: () => ({
				conversion: $convertDivElement,
				priority: 1
			}),
			pre: () => ({
				conversion: $convertPreElement,
				priority: 0
			}),
			table: (node) => {
				if (isGitHubCodeTable(node)) return {
					conversion: $convertTableElement,
					priority: 3
				};
				return null;
			},
			td: (node) => {
				const td = node;
				const table = td.closest("table");
				if (isGitHubCodeCell(td) || table && isGitHubCodeTable(table)) return {
					conversion: convertCodeNoop,
					priority: 3
				};
				return null;
			},
			tr: (node) => {
				const table = node.closest("table");
				if (table && isGitHubCodeTable(table)) return {
					conversion: convertCodeNoop,
					priority: 3
				};
				return null;
			}
		};
	}
	constructor(lang, code, codeTheme, options, key) {
		super(key);
		this.__lang = lang;
		this.__code = code;
		this.__codeTheme = codeTheme;
		this.__options = options;
	}
	get lang() {
		return this.__lang;
	}
	get code() {
		return this.__code;
	}
	get codeTheme() {
		return this.__codeTheme;
	}
	get options() {
		return this.__options;
	}
	exportDOM(editor) {
		const element = document.createElement("pre");
		addClassNamesToElement(element, editor._config.theme.code);
		element.setAttribute("spellcheck", "false");
		const language = this.__lang;
		if (language) element.setAttribute(LANGUAGE_DATA_ATTRIBUTE, language);
		const theme = this.__codeTheme;
		if (theme) element.setAttribute(THEME_DATA_ATTRIBUTE, theme);
		element.textContent = this.__code;
		return { element };
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			code: this.code,
			codeTheme: this.codeTheme,
			language: this.lang,
			options: this.options
		};
	}
	setLang(lang) {
		const writer = this.getWritable();
		writer.__lang = lang;
		return this;
	}
	setCode(code) {
		const writer = this.getWritable();
		writer.__code = code;
		return this;
	}
	setCodeTheme(codeTheme) {
		const writer = this.getWritable();
		writer.__codeTheme = codeTheme;
		return this;
	}
	setTabSize(tabSize) {
		const writer = this.getWritable();
		writer.__options.tabSize = tabSize;
		return this;
	}
	setIndentWithTabs(indentWithTabs) {
		const writer = this.getWritable();
		writer.__options.indentWithTabs = indentWithTabs;
		return this;
	}
	setLineNumbers(lineNumbers) {
		const writer = this.getWritable();
		writer.__options.lineNumbers = lineNumbers;
		return this;
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
		const decorator = getKernelFromEditor(editor)?.getDecorator("codemirror");
		if (!decorator) return null;
		if (typeof decorator === "function") return decorator(this, editor);
		else return decorator.render(this, editor);
	}
};
function $createCodeMirrorNode(lang, code = "", codeTheme = "default", options = DEFAULT_OPTIONS) {
	return $applyNodeReplacement(new CodeMirrorNode(lang, code, codeTheme, options));
}
function isCodeElement(div) {
	return div.style.fontFamily.match("monospace") !== null;
}
function isCodeChildElement(node) {
	let parent = node.parentElement;
	while (parent !== null) {
		if (isCodeElement(parent)) return true;
		parent = parent.parentElement;
	}
	return false;
}
function $convertDivElement(domNode) {
	const div = domNode;
	const isCode = isCodeElement(div);
	if (!isCode && !isCodeChildElement(div)) return { node: null };
	return { node: isCode ? $createCodeMirrorNode("plain", domNode.textContent || "", "") : null };
}
function $convertTableElement() {
	return { node: $createCodeMirrorNode("plain", "", "") };
}
function $convertPreElement(domNode) {
	const language = domNode.getAttribute(LANGUAGE_DATA_ATTRIBUTE);
	const codeTheme = domNode.getAttribute(THEME_DATA_ATTRIBUTE) || "";
	return { node: $createCodeMirrorNode(language || "plain", domNode.textContent || "", codeTheme) };
}
function $isCodeMirrorNode(node) {
	return node.getType() === CodeMirrorNode.getType();
}
function convertCodeNoop() {
	return { node: null };
}
//#endregion
//#region src/plugins/common/react/style.ts
const cursorBlink = keyframes`
  to {
    visibility: hidden;
  }
`;
const themeStyles = createStaticStyles(({ css, cssVar }) => ({
	quote: "editor_quote",
	textBold_false: css`
    font-weight: unset;
  `,
	textBold_true: css`
    font-weight: bold;
  `,
	textCode: "editor_code",
	textItalic_false: css`
    font-style: unset;
  `,
	textItalic_true: css`
    font-style: italic;
  `,
	textStrikethrough_false: css`
    text-decoration: unset;
  `,
	textStrikethrough_true: css`
    color: ${cssVar.colorTextDescription};
    text-decoration: line-through;
  `,
	textUnderlineStrikethrough_false: css`
    text-decoration: unset;
  `,
	textUnderlineStrikethrough_true: css`
    text-decoration: underline line-through;
  `,
	textUnderline_false: css`
    text-decoration: unset;
  `,
	textUnderline_true: css`
    text-decoration: underline;
  `
}));
const styles$1 = createStaticStyles(({ css, cssVar }) => {
	const __root = css`
    --lobe-markdown-font-size: var(--common-font-size, 16px);
    --lobe-markdown-header-multiple: var(--common-header-multiple, 1);
    --lobe-markdown-margin-multiple: var(--common-margin-multiple, 2);
    --lobe-markdown-line-height: var(--common-line-height, 1.6);
    --lobe-markdown-border-radius: ${cssVar.borderRadiusLG};
    --lobe-markdown-border-color: ${cssVar.colorFillQuaternary};

    position: relative;

    display: flex;
    flex-direction: column;

    width: 100%;
    max-width: 100%;
    height: 100%;

    font-size: var(--lobe-markdown-font-size);
    line-height: var(--lobe-markdown-line-height);
    word-break: break-word;

    [data-placeholder] {
      position: relative;
    }

    [data-placeholder]::after {
      pointer-events: none;
      content: attr(data-placeholder);
      user-select: none;

      position: absolute;
      inset-block-start: 50%;
      transform: translateY(-50%);

      padding-inline-start: 2px;

      color: ${cssVar.colorTextDescription};
      white-space: nowrap;
    }

    [data-lexical-cursor='true'] {
      pointer-events: none;
      position: absolute;
      display: block;

      &::after {
        content: '';

        position: absolute;
        inset-block-start: -2px;

        display: block;

        width: 20px;
        border-block-start: 1px solid ${cssVar.colorText};

        animation: ${cursorBlink} 1.1s steps(2, start) infinite;
      }
    }
  `;
	const header = css`
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin-block: max(
        calc(var(--lobe-markdown-header-multiple) * var(--lobe-markdown-margin-multiple) * 0.4em),
        var(--lobe-markdown-font-size)
      );
      font-weight: bold;
      line-height: 1.25;
    }

    h1 {
      font-size: calc(
        var(--lobe-markdown-font-size) * (1 + 1.5 * var(--lobe-markdown-header-multiple))
      );
    }

    h2 {
      font-size: calc(var(--lobe-markdown-font-size) * (1 + var(--lobe-markdown-header-multiple)));
    }

    h3 {
      font-size: calc(
        var(--lobe-markdown-font-size) * (1 + 0.5 * var(--lobe-markdown-header-multiple))
      );
    }

    h4 {
      font-size: calc(
        var(--lobe-markdown-font-size) * (1 + 0.25 * var(--lobe-markdown-header-multiple))
      );
    }

    h5,
    h6 {
      font-size: calc(var(--lobe-markdown-font-size) * 1);
    }
  `;
	const p = css`
    p {
      margin-block: 4px;
      line-height: var(--lobe-markdown-line-height);
      letter-spacing: 0.02em;

      &:not(:first-child) {
        margin-block-start: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      }

      &:not(:last-child) {
        margin-block-end: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      }
    }
  `;
	const blockquote = css`
    .editor_quote {
      margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
      margin-inline: 0;
      padding-block: 0;
      padding-inline: 1em;
      border-inline-start: solid 4px ${cssVar.colorBorder};

      color: ${cssVar.colorTextSecondary};
    }
  `;
	const code = css`
    .editor_code {
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
    }
  `;
	return {
		blockquote,
		code,
		editorContent: css`
    /* Grow with content so Lexical rootElement geometry matches the doc.
     * flex:1 + min-height:0 made the box viewport-tall while text overflowed
     * visibly — caret stayed glued to the bottom of the scroll port on Enter. */
    flex: 1 0 auto;
    min-height: 0;
    outline: none;

    &::selection,
    *::selection {
      color: currentcolor;
      background-color: rgba(64, 169, 255, 18%);

      -webkit-text-fill-color: currentcolor;
    }

    @media (prefers-color-scheme: dark) {
      &::selection,
      *::selection {
        color: currentcolor;
        background-color: rgba(64, 169, 255, 24%);

        -webkit-text-fill-color: currentcolor;
      }
    }
  `,
		header,
		p,
		root: __root,
		variant: cx(header, p, blockquote, code)
	};
});
//#endregion
//#region src/plugins/code/node/code.ts
var CodeNode = class CodeNode extends CardLikeElementNode {
	static getType() {
		return "codeInline";
	}
	static clone(node) {
		return new CodeNode(node.__key);
	}
	static importJSON(serializedNode) {
		return $createCodeNode().updateFromJSON(serializedNode);
	}
	createDOM(config) {
		const element = document.createElement("span");
		element.setAttribute("data-lexical-key", this.getKey());
		const childContainer = document.createElement("ne-content");
		element.append(childContainer);
		addClassNamesToElement(element, config.theme.codeInline);
		return element;
	}
	getDOMSlot(element) {
		const neContent = element.querySelector("ne-content");
		if (!neContent) throw new Error("CodeNode: ne-content not found");
		return super.getDOMSlot(element).withElement(neContent);
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
	updateDOM(prevNode, dom, config) {
		if ((prevNode ? prevNode : null) !== this) addClassNamesToElement(dom, config.theme.codeInline);
		return false;
	}
};
function $createCodeNode(textContent) {
	const codeNode = $applyNodeReplacement(new CodeNode());
	const cursorNode = $createCursorNode();
	codeNode.append(cursorNode);
	if (textContent) codeNode.append($createTextNode(textContent));
	return codeNode;
}
function $isCodeInlineNode(node) {
	return node instanceof CodeNode;
}
function getCodeInlineNode(node) {
	if ($isCursorNode(node)) {
		const parent = node.getParent();
		if ($isCodeInlineNode(parent)) return parent;
		if ($isCodeInlineNode(node.getNextSibling())) return node.getNextSibling();
		if ($isCodeInlineNode(node.getPreviousSibling())) return node.getPreviousSibling();
		return null;
	}
	if ($isCodeInlineNode(node.getParent())) return node.getParent();
	return null;
}
function $isSelectionInCodeInline(editor) {
	if (!editor) return false;
	return editor.getEditorState().read(() => {
		const selection = $getSelection();
		if (!selection) return false;
		if ($isRangeSelection(selection)) {
			const focusNode = selection.focus.getNode();
			const anchorNode = selection.anchor.getNode();
			const code = getCodeInlineNode(focusNode);
			if (code !== getCodeInlineNode(anchorNode)) return false;
			if ($isCodeInlineNode(code)) return true;
			return false;
		} else if ($isNodeSelection(selection)) {
			const nodes = selection.getNodes();
			if (nodes.length === 1 && $isCodeInlineNode(nodes[0])) return true;
		}
		return false;
	});
}
//#endregion
//#region src/plugins/codeblock/supported-shiki-languages.ts
/** Canonical ids kept for syntax highlighting (aliases documented in each entry). */
const SUPPORTED_SHIKI_LANGUAGE_IDS = [
	"markdown",
	"mdx",
	"javascript",
	"typescript",
	"jsx",
	"tsx",
	"html",
	"css",
	"scss",
	"less",
	"vue",
	"svelte",
	"json",
	"jsonc",
	"yaml",
	"toml",
	"xml",
	"ini",
	"python",
	"java",
	"kotlin",
	"go",
	"rust",
	"c",
	"cpp",
	"csharp",
	"ruby",
	"php",
	"swift",
	"lua",
	"shellscript",
	"shellsession",
	"powershell",
	"docker",
	"nginx",
	"make",
	"cmake",
	"sql",
	"graphql",
	"diff",
	"proto",
	"wasm"
];
const supportedLanguagesInfo = [
	{
		id: "markdown",
		name: "Markdown",
		aliases: ["md"],
		import: () => import("@shikijs/langs/markdown")
	},
	{
		id: "mdx",
		name: "MDX",
		import: () => import("@shikijs/langs/mdx")
	},
	{
		id: "javascript",
		name: "JavaScript",
		aliases: [
			"js",
			"cjs",
			"mjs"
		],
		import: () => import("@shikijs/langs/javascript")
	},
	{
		id: "typescript",
		name: "TypeScript",
		aliases: [
			"ts",
			"cts",
			"mts"
		],
		import: () => import("@shikijs/langs/typescript")
	},
	{
		id: "jsx",
		name: "JSX",
		import: () => import("@shikijs/langs/jsx")
	},
	{
		id: "tsx",
		name: "TSX",
		import: () => import("@shikijs/langs/tsx")
	},
	{
		id: "html",
		name: "HTML",
		import: () => import("@shikijs/langs/html")
	},
	{
		id: "css",
		name: "CSS",
		import: () => import("@shikijs/langs/css")
	},
	{
		id: "scss",
		name: "SCSS",
		import: () => import("@shikijs/langs/scss")
	},
	{
		id: "less",
		name: "Less",
		import: () => import("@shikijs/langs/less")
	},
	{
		id: "vue",
		name: "Vue",
		import: () => import("@shikijs/langs/vue")
	},
	{
		id: "svelte",
		name: "Svelte",
		import: () => import("@shikijs/langs/svelte")
	},
	{
		id: "json",
		name: "JSON",
		import: () => import("@shikijs/langs/json")
	},
	{
		id: "jsonc",
		name: "JSON with Comments",
		import: () => import("@shikijs/langs/jsonc")
	},
	{
		id: "yaml",
		name: "YAML",
		aliases: ["yml"],
		import: () => import("@shikijs/langs/yaml")
	},
	{
		id: "toml",
		name: "TOML",
		import: () => import("@shikijs/langs/toml")
	},
	{
		id: "xml",
		name: "XML",
		import: () => import("@shikijs/langs/xml")
	},
	{
		id: "ini",
		name: "INI",
		aliases: ["properties"],
		import: () => import("@shikijs/langs/ini")
	},
	{
		id: "python",
		name: "Python",
		aliases: ["py"],
		import: () => import("@shikijs/langs/python")
	},
	{
		id: "java",
		name: "Java",
		import: () => import("@shikijs/langs/java")
	},
	{
		id: "kotlin",
		name: "Kotlin",
		aliases: ["kt", "kts"],
		import: () => import("@shikijs/langs/kotlin")
	},
	{
		id: "go",
		name: "Go",
		import: () => import("@shikijs/langs/go")
	},
	{
		id: "rust",
		name: "Rust",
		aliases: ["rs"],
		import: () => import("@shikijs/langs/rust")
	},
	{
		id: "c",
		name: "C",
		import: () => import("@shikijs/langs/c")
	},
	{
		id: "cpp",
		name: "C++",
		aliases: ["c++"],
		import: () => import("@shikijs/langs/cpp")
	},
	{
		id: "csharp",
		name: "C#",
		aliases: ["c#", "cs"],
		import: () => import("@shikijs/langs/csharp")
	},
	{
		id: "ruby",
		name: "Ruby",
		aliases: ["rb"],
		import: () => import("@shikijs/langs/ruby")
	},
	{
		id: "php",
		name: "PHP",
		import: () => import("@shikijs/langs/php")
	},
	{
		id: "swift",
		name: "Swift",
		import: () => import("@shikijs/langs/swift")
	},
	{
		id: "lua",
		name: "Lua",
		import: () => import("@shikijs/langs/lua")
	},
	{
		id: "shellscript",
		name: "Shell",
		aliases: [
			"bash",
			"sh",
			"shell",
			"zsh"
		],
		import: () => import("@shikijs/langs/shellscript")
	},
	{
		id: "shellsession",
		name: "Shell Session",
		aliases: ["console"],
		import: () => import("@shikijs/langs/shellsession")
	},
	{
		id: "powershell",
		name: "PowerShell",
		aliases: ["ps", "ps1"],
		import: () => import("@shikijs/langs/powershell")
	},
	{
		id: "docker",
		name: "Dockerfile",
		aliases: ["dockerfile"],
		import: () => import("@shikijs/langs/docker")
	},
	{
		id: "nginx",
		name: "Nginx",
		import: () => import("@shikijs/langs/nginx")
	},
	{
		id: "make",
		name: "Makefile",
		aliases: ["makefile"],
		import: () => import("@shikijs/langs/make")
	},
	{
		id: "cmake",
		name: "CMake",
		import: () => import("@shikijs/langs/cmake")
	},
	{
		id: "sql",
		name: "SQL",
		import: () => import("@shikijs/langs/sql")
	},
	{
		id: "graphql",
		name: "GraphQL",
		aliases: ["gql"],
		import: () => import("@shikijs/langs/graphql")
	},
	{
		id: "diff",
		name: "Diff",
		import: () => import("@shikijs/langs/diff")
	},
	{
		id: "proto",
		name: "Protocol Buffer 3",
		aliases: ["protobuf"],
		import: () => import("@shikijs/langs/proto")
	},
	{
		id: "wasm",
		name: "WebAssembly",
		import: () => import("@shikijs/langs/wasm")
	}
];
function findSupportedLanguageInfo(language) {
	const langId = language.toLowerCase();
	return supportedLanguagesInfo.find((desc) => desc.id === langId || desc.aliases?.some((alias) => alias.toLowerCase() === langId));
}
/** Map fence language tag to a supported id, or `plaintext` when not in the whitelist. */
function resolveSupportedLanguageId(language) {
	if (!language) return "plaintext";
	return findSupportedLanguageInfo(language)?.id ?? "plaintext";
}
//#endregion
//#region src/plugins/link/node/LinkNode.ts
init_utils$1();
init_debug();
const logger$1 = createDebugLogger("plugin", "link");
function getKernel(editor) {
	return editor.__kernel;
}
const SUPPORTED_URL_PROTOCOLS = new Set([
	"http:",
	"https:",
	"mailto:",
	"sms:",
	"tel:"
]);
const HOVER_LINK_COMMAND = createCommand("HOVER_LINK_COMMAND");
const HOVER_OUT_LINK_COMMAND = createCommand("HOVER_OUT_LINK_COMMAND");
const EDIT_LINK_COMMAND = createCommand("EDIT_LINK_COMMAND");
/** @noInheritDoc */
var LinkNode = class LinkNode extends ElementNode {
	static getType() {
		return "link";
	}
	static clone(node) {
		return new LinkNode(node.__url, {
			rel: node.__rel,
			target: node.__target,
			title: node.__title
		}, node.__key);
	}
	constructor(url = "", attributes = {}, key) {
		super(key);
		const { target = null, rel = null, title = null } = attributes;
		this.__url = url;
		this.__target = target;
		this.__rel = rel;
		this.__title = title;
	}
	createDOM(config, editor) {
		logger$1.debug("🔍 config", config);
		const element = document.createElement("a");
		this.updateLinkDOM(null, element, config);
		addClassNamesToElement(element, config.theme.link);
		element.addEventListener("mouseenter", (event) => {
			if (event.target instanceof HTMLElement) {
				event.target.classList.add("hover");
				editor.dispatchCommand(HOVER_LINK_COMMAND, {
					event,
					linkNode: this
				});
			}
		});
		element.addEventListener("mouseleave", (event) => {
			if (event.target instanceof HTMLElement) {
				event.target.classList.remove("hover");
				editor.dispatchCommand(HOVER_OUT_LINK_COMMAND, { event });
			}
		});
		if (editor.isEditable()) element.title = getKernel(editor)?.t("link.editableInteractiveHint") ?? "Click to edit link text. ⌘ or Ctrl-click (or middle-click) opens in a new tab.";
		/** ⌘/Ctrl+click or middle-click opens href; plain click re-opens the link edit UI (selection can stay inside the same link). */
		element.addEventListener("click", (event) => {
			if (!editor.isEditable()) return;
			const withModifier = event.metaKey || event.ctrlKey;
			const middleClick = event.button === 1;
			if (withModifier || middleClick) {
				const href = element.href;
				if (!href || /\babout:blank\b/i.test(href)) return;
				event.preventDefault();
				event.stopPropagation();
				window.open(href, "_blank", "noopener,noreferrer");
				return;
			}
			if (event.button !== 0) return;
			const nodeKey = this.getKey();
			let linkNodeForEdit = null;
			editor.getEditorState().read(() => {
				const n = $getNodeByKey(nodeKey);
				if ($isLinkNode(n)) linkNodeForEdit = n;
			});
			if (linkNodeForEdit) editor.dispatchCommand(EDIT_LINK_COMMAND, {
				linkNode: linkNodeForEdit,
				linkNodeDOM: element
			});
		}, true);
		element.addEventListener("auxclick", (event) => {
			if (event.button !== 1) return;
			if (!editor.isEditable()) return;
			const href = element.href;
			if (!href || /\babout:blank\b/i.test(href)) return;
			event.preventDefault();
			event.stopPropagation();
			window.open(href, "_blank", "noopener,noreferrer");
		}, true);
		return element;
	}
	updateLinkDOM(prevNode, anchor, _config) {
		if (isHTMLAnchorElement(anchor)) {
			if (!prevNode || prevNode.__url !== this.__url) anchor.href = this.sanitizeUrl(this.__url);
			for (const attr of [
				"target",
				"rel",
				"title"
			]) {
				const key = `__${attr}`;
				const value = this[key];
				if (!prevNode || prevNode[key] !== value) if (value) anchor[attr] = value;
				else anchor.removeAttribute(attr);
			}
		}
	}
	updateDOM(prevNode, anchor, config) {
		this.updateLinkDOM(prevNode, anchor, config);
		return false;
	}
	static importDOM() {
		return { a: () => ({
			conversion: $convertAnchorElement,
			priority: 1
		}) };
	}
	static importJSON(serializedNode) {
		return $createLinkNode().updateFromJSON(serializedNode);
	}
	updateFromJSON(serializedNode) {
		return super.updateFromJSON(serializedNode).setURL(serializedNode.url).setRel(serializedNode.rel || null).setTarget(serializedNode.target || null).setTitle(serializedNode.title || null);
	}
	sanitizeUrl(url) {
		url = formatUrl(url);
		try {
			const parsedUrl = new URL(formatUrl(url));
			if (!SUPPORTED_URL_PROTOCOLS.has(parsedUrl.protocol)) return "about:blank";
		} catch {
			return url;
		}
		return url;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			rel: this.getRel(),
			target: this.getTarget(),
			title: this.getTitle(),
			url: this.getURL()
		};
	}
	getURL() {
		return this.getLatest().__url;
	}
	setURL(url) {
		const writable = this.getWritable();
		writable.__url = url;
		return writable;
	}
	getTarget() {
		return this.getLatest().__target;
	}
	setTarget(target) {
		const writable = this.getWritable();
		writable.__target = target;
		return writable;
	}
	getRel() {
		return this.getLatest().__rel;
	}
	setRel(rel) {
		const writable = this.getWritable();
		writable.__rel = rel;
		return writable;
	}
	getTitle() {
		return this.getLatest().__title;
	}
	setTitle(title) {
		const writable = this.getWritable();
		writable.__title = title;
		return writable;
	}
	insertNewAfter(_, restoreSelection = true) {
		const linkNode = $createLinkNode(this.__url, {
			rel: this.__rel,
			target: this.__target,
			title: this.__title
		});
		this.insertAfter(linkNode, restoreSelection);
		return linkNode;
	}
	canInsertTextBefore() {
		return false;
	}
	canInsertTextAfter() {
		return false;
	}
	canBeEmpty() {
		return false;
	}
	isInline() {
		return true;
	}
	extractWithChild(child, selection) {
		if (!$isRangeSelection(selection)) return false;
		const anchorNode = selection.anchor.getNode();
		const focusNode = selection.focus.getNode();
		return this.isParentOf(anchorNode) && this.isParentOf(focusNode) && selection.getTextContent().length > 0;
	}
	isEmailURI() {
		return this.__url.startsWith("mailto:");
	}
	isWebSiteURI() {
		return this.__url.startsWith("https://") || this.__url.startsWith("http://");
	}
};
function $convertAnchorElement(domNode) {
	let node = null;
	if (isHTMLAnchorElement(domNode)) {
		const content = domNode.textContent;
		if (content !== null && content !== "" || domNode.children.length > 0) node = $createLinkNode(domNode.getAttribute("href") || "", {
			rel: domNode.getAttribute("rel"),
			target: domNode.getAttribute("target"),
			title: domNode.getAttribute("title")
		});
	}
	return { node };
}
/**
* Takes a URL and creates a LinkNode.
* @param url - The URL the LinkNode should direct to.
* @param attributes - Optional HTML a tag attributes \\{ target, rel, title \\}
* @returns The LinkNode.
*/
function $createLinkNode(url = "", attributes) {
	return $applyNodeReplacement(new LinkNode(url, attributes));
}
/**
* Determines if node is a LinkNode.
* @param node - The node to be checked.
* @returns true if node is a LinkNode, false otherwise.
*/
function $isLinkNode(node) {
	return node instanceof LinkNode;
}
var AutoLinkNode = class AutoLinkNode extends LinkNode {
	constructor(url = "", attributes = {}, key) {
		super(url, attributes, key);
		this.__isUnlinked = attributes.isUnlinked !== void 0 && attributes.isUnlinked !== null ? attributes.isUnlinked : false;
	}
	static getType() {
		return "autolink";
	}
	static clone(node) {
		return new AutoLinkNode(node.__url, {
			isUnlinked: node.__isUnlinked,
			rel: node.__rel,
			target: node.__target,
			title: node.__title
		}, node.__key);
	}
	getIsUnlinked() {
		return this.__isUnlinked;
	}
	setIsUnlinked(value) {
		const self = this.getWritable();
		self.__isUnlinked = value;
		return self;
	}
	createDOM(config, editor) {
		logger$1.debug("🔍 config", config);
		if (this.__isUnlinked) return document.createElement("span");
		else return super.createDOM(config, editor);
	}
	updateDOM(prevNode, anchor, config) {
		return super.updateDOM(prevNode, anchor, config) || prevNode.__isUnlinked !== this.__isUnlinked;
	}
	static importJSON(serializedNode) {
		return $createAutoLinkNode().updateFromJSON(serializedNode);
	}
	updateFromJSON(serializedNode) {
		return super.updateFromJSON(serializedNode).setIsUnlinked(serializedNode.isUnlinked || false);
	}
	static importDOM() {
		return null;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			isUnlinked: this.__isUnlinked
		};
	}
	insertNewAfter(selection, restoreSelection = true) {
		const element = this.getParentOrThrow().insertNewAfter(selection, restoreSelection);
		if ($isElementNode(element)) {
			const linkNode = $createAutoLinkNode(this.__url, {
				isUnlinked: this.__isUnlinked,
				rel: this.__rel,
				target: this.__target,
				title: this.__title
			});
			element.append(linkNode);
			return linkNode;
		}
		return null;
	}
};
/**
* Takes a URL and creates an AutoLinkNode. AutoLinkNodes are generally automatically generated
* during typing, which is especially useful when a button to generate a LinkNode is not practical.
* @param url - The URL the LinkNode should direct to.
* @param attributes - Optional HTML a tag attributes. \\{ target, rel, title \\}
* @returns The LinkNode.
*/
function $createAutoLinkNode(url = "", attributes) {
	return $applyNodeReplacement(new AutoLinkNode(url, attributes));
}
/**
* Determines if node is an AutoLinkNode.
* @param node - The node to be checked.
* @returns true if node is an AutoLinkNode, false otherwise.
*/
function $isAutoLinkNode(node) {
	return node instanceof AutoLinkNode;
}
const TOGGLE_LINK_COMMAND = createCommand("TOGGLE_LINK_COMMAND");
function $getPointNode(point, offset) {
	if (point.type === "element") {
		const node = point.getNode();
		assert($isElementNode(node), "$getPointNode: element point is not an ElementNode");
		return node.getChildren()[point.offset + offset] || null;
	}
	return null;
}
/**
* Preserve the logical start/end of a RangeSelection in situations where
* the point is an element that may be reparented in the callback.
*
* @param $fn The function to run
* @returns The result of the callback
*/
function $withSelectedNodes($fn) {
	const initialSelection = $getSelection();
	if (!$isRangeSelection(initialSelection)) return $fn();
	const normalized = $normalizeSelection__EXPERIMENTAL(initialSelection);
	const isBackwards = normalized.isBackward();
	const anchorNode = $getPointNode(normalized.anchor, isBackwards ? -1 : 0);
	const focusNode = $getPointNode(normalized.focus, isBackwards ? 0 : -1);
	const rval = $fn();
	if (anchorNode || focusNode) {
		const updatedSelection = $getSelection();
		if ($isRangeSelection(updatedSelection)) {
			const finalSelection = updatedSelection.clone();
			if (anchorNode) {
				const anchorParent = anchorNode.getParent();
				if (anchorParent) finalSelection.anchor.set(anchorParent.getKey(), anchorNode.getIndexWithinParent() + (isBackwards ? 1 : 0), "element");
			}
			if (focusNode) {
				const focusParent = focusNode.getParent();
				if (focusParent) finalSelection.focus.set(focusParent.getKey(), focusNode.getIndexWithinParent() + (isBackwards ? 0 : 1), "element");
			}
			$setSelection($normalizeSelection__EXPERIMENTAL(finalSelection));
		}
	}
	return rval;
}
/**
* Generates or updates a LinkNode. It can also delete a LinkNode if the URL is null,
* but saves any children and brings them up to the parent node.
* @param url - The URL the link directs to.
* @param attributes - Optional HTML a tag attributes. \\{ target, rel, title \\}
*/
function $toggleLink(url, attributes = {}) {
	const { target, title } = attributes;
	const rel = attributes.rel === void 0 ? "noreferrer" : attributes.rel;
	const selection = $getSelection();
	if (selection === null || !$isRangeSelection(selection) && !$isNodeSelection(selection)) return;
	if ($isNodeSelection(selection)) {
		const nodes = selection.getNodes();
		if (nodes.length === 0) return;
		nodes.forEach((node) => {
			if (url === null) {
				const linkParent = $findMatchingParent(node, (parent) => !$isAutoLinkNode(parent) && $isLinkNode(parent));
				if (linkParent) {
					linkParent.insertBefore(node);
					if (linkParent.getChildren().length === 0) linkParent.remove();
				}
			} else {
				const existingLink = $findMatchingParent(node, (parent) => !$isAutoLinkNode(parent) && $isLinkNode(parent));
				if (existingLink) {
					existingLink.setURL(url);
					if (target !== void 0) existingLink.setTarget(target);
					if (rel !== void 0) existingLink.setRel(rel);
				} else {
					const linkNode = $createLinkNode(url, {
						rel,
						target
					});
					node.insertBefore(linkNode);
					linkNode.append(node);
				}
			}
		});
		return;
	}
	const nodes = selection.extract();
	if (url === null) {
		nodes.forEach((node) => {
			const parentLink = $findMatchingParent(node, (parent) => !$isAutoLinkNode(parent) && $isLinkNode(parent));
			if (parentLink) {
				const children = parentLink.getChildren();
				for (const child of children) parentLink.insertBefore(child);
				parentLink.remove();
			}
		});
		return;
	}
	const updatedNodes = /* @__PURE__ */ new Set();
	const updateLinkNode = (linkNode) => {
		if (updatedNodes.has(linkNode.getKey())) return;
		updatedNodes.add(linkNode.getKey());
		linkNode.setURL(url);
		if (target !== void 0) linkNode.setTarget(target);
		if (rel !== void 0) linkNode.setRel(rel);
		if (title !== void 0) linkNode.setTitle(title);
	};
	if (nodes.length === 1) {
		const firstNode = nodes[0];
		const linkNode = $getAncestor(firstNode, $isLinkNode);
		if (linkNode !== null) return updateLinkNode(linkNode);
	}
	$withSelectedNodes(() => {
		let linkNode = null;
		for (const node of nodes) {
			if (!node.isAttached()) continue;
			const parentLinkNode = $getAncestor(node, $isLinkNode);
			if (parentLinkNode) {
				updateLinkNode(parentLinkNode);
				continue;
			}
			if ($isElementNode(node)) {
				if (!node.isInline()) continue;
				if ($isLinkNode(node)) {
					if (!$isAutoLinkNode(node) && (linkNode === null || !linkNode.getParentOrThrow().isParentOf(node))) {
						updateLinkNode(node);
						linkNode = node;
						continue;
					}
					for (const child of node.getChildren()) node.insertBefore(child);
					node.remove();
					continue;
				}
			}
			const prevLinkNode = node.getPreviousSibling();
			if ($isLinkNode(prevLinkNode) && prevLinkNode.is(linkNode)) {
				prevLinkNode.append(node);
				continue;
			}
			linkNode = $createLinkNode(url, {
				rel,
				target,
				title
			});
			node.insertAfter(linkNode);
			linkNode.append(node);
		}
	});
}
function $getAncestor(node, predicate) {
	let parent = node;
	while (parent !== null && parent.getParent() !== null && !predicate(parent)) parent = parent.getParentOrThrow();
	return predicate(parent) ? parent : null;
}
const PHONE_NUMBER_REGEX = /^\+?[\d\s()-]{5,}$/;
/**
* Formats a URL string by adding appropriate protocol if missing
*
* @param url - URL to format
* @returns Formatted URL with appropriate protocol
*/
function formatUrl(url) {
	if (/^[a-z][\d+.a-z-]*:/i.test(url)) return url;
	else if (/^[#./]/.test(url)) return url;
	else if (url.includes("@")) return `mailto:${url}`;
	else if (PHONE_NUMBER_REGEX.test(url)) return `tel:${url}`;
	return url;
}
//#endregion
//#region src/plugins/link-highlight/node/link-highlight.ts
init_debug();
const logger = createDebugLogger("plugin", "link-highlight");
var LinkHighlightNode = class LinkHighlightNode extends ElementNode {
	static getType() {
		return "linkHighlight";
	}
	static clone(node) {
		return new LinkHighlightNode(node.__key);
	}
	static importJSON(serializedNode) {
		return $createLinkHighlightNode().updateFromJSON(serializedNode);
	}
	createDOM(config) {
		logger.debug("🔍 config", config);
		const element = document.createElement("a");
		const url = this.getURL();
		if (url) element.href = this.formatUrl(url);
		element.setAttribute("target", "_blank");
		element.setAttribute("rel", "noopener noreferrer");
		addClassNamesToElement(element, config.theme.linkHighlight);
		return element;
	}
	/**
	* Format URL to ensure it has proper protocol
	*/
	formatUrl(url) {
		if (/^[a-z][\d+.a-z-]*:/i.test(url)) return url;
		if (/^[#./]/.test(url)) return url;
		if (url.includes("@") && !url.startsWith("mailto:")) return `mailto:${url}`;
		if (/^\+?[\d\s()-]{5,}$/.test(url)) return `tel:${url}`;
		if (url.startsWith("www.")) return `https://${url}`;
		if (!url.includes("://")) return `https://${url}`;
		return url;
	}
	canBeEmpty() {
		return false;
	}
	isInline() {
		return true;
	}
	canInsertTextBefore() {
		return false;
	}
	canInsertTextAfter() {
		return false;
	}
	updateDOM(prevNode, dom, config) {
		if ((prevNode ? prevNode : null) !== this) addClassNamesToElement(dom, config.theme.linkHighlight);
		if (dom instanceof HTMLAnchorElement) {
			const url = this.getURL();
			if (url) dom.href = this.formatUrl(url);
			else dom.removeAttribute("href");
		}
		return false;
	}
	/**
	* Get the URL from the text content
	*/
	getURL() {
		return this.getTextContent().trim();
	}
};
function $createLinkHighlightNode() {
	return $applyNodeReplacement(new LinkHighlightNode());
}
function $isLinkHighlightNode(node) {
	return node instanceof LinkHighlightNode;
}
function getLinkHighlightNode(node) {
	if ($isLinkHighlightNode(node)) return node;
	const parent = node.getParent();
	if ($isLinkHighlightNode(parent)) return parent;
	return null;
}
//#endregion
//#region src/plugins/math/node/index.ts
var MathInlineNode = class MathInlineNode extends DecoratorNode {
	static getType() {
		return "math";
	}
	static clone(node) {
		return new MathInlineNode(node.__code, node.__key);
	}
	static importJSON(serializedNode) {
		return $createMathInlineNode().updateFromJSON(serializedNode);
	}
	static importDOM() {
		return { span: (node) => {
			if (node.classList.contains("math-inline")) return {
				conversion: $convertMathInlineElement,
				priority: 0
			};
			return null;
		} };
	}
	constructor(code = "", key) {
		super(key);
		this.__code = code;
	}
	get code() {
		return this.__code;
	}
	updateCode(newCode) {
		const writer = this.getWritable();
		writer.__code = newCode;
	}
	exportDOM() {
		const span = document.createElement("span");
		span.className = "math-inline";
		return { element: span };
	}
	createDOM(config) {
		const element = document.createElement("span");
		addClassNamesToElement(element, config.theme.mathInline);
		return element;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			code: this.__code
		};
	}
	updateFromJSON(serializedNode) {
		const node = super.updateFromJSON(serializedNode);
		this.__code = serializedNode.code || "";
		return node;
	}
	getTextContent() {
		return `$${this.code}$`;
	}
	isInline() {
		return true;
	}
	updateDOM() {
		return false;
	}
	decorate(editor) {
		const decorator = getKernelFromEditor(editor)?.getDecorator(MathInlineNode.getType());
		if (!decorator) return null;
		if (typeof decorator === "function") return decorator(this, editor);
		return {
			queryDOM: decorator.queryDOM,
			render: decorator.render(this, editor)
		};
	}
};
var MathBlockNode = class MathBlockNode extends DecoratorNode {
	static getType() {
		return "mathBlock";
	}
	static clone(node) {
		return new MathBlockNode(node.__code, node.__key);
	}
	static importJSON(serializedNode) {
		return $createMathBlockNode().updateFromJSON(serializedNode);
	}
	static importDOM() {
		return { div: (node) => {
			if (node.classList.contains("math-block")) return {
				conversion: $convertMathBlockElement,
				priority: 0
			};
			return null;
		} };
	}
	constructor(code = "", key) {
		super(key);
		this.__code = code;
	}
	get code() {
		return this.__code;
	}
	updateCode(newCode) {
		const writer = this.getWritable();
		writer.__code = newCode;
	}
	exportDOM() {
		const div = document.createElement("div");
		div.className = "math-block";
		return { element: div };
	}
	createDOM(config) {
		const element = document.createElement("div");
		addClassNamesToElement(element, config.theme.mathBlock);
		return element;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			code: this.__code
		};
	}
	updateFromJSON(serializedNode) {
		const node = super.updateFromJSON(serializedNode);
		this.__code = serializedNode.code || "";
		return node;
	}
	getTextContent() {
		return `$$\n${this.code}\n$$\n`;
	}
	isInline() {
		return false;
	}
	updateDOM() {
		return false;
	}
	decorate(editor) {
		const decorator = getKernelFromEditor(editor)?.getDecorator(MathBlockNode.getType());
		if (!decorator) return null;
		if (typeof decorator === "function") return decorator(this, editor);
		return {
			queryDOM: decorator.queryDOM,
			render: decorator.render(this, editor)
		};
	}
};
function $createMathInlineNode(code = "") {
	return $applyNodeReplacement(new MathInlineNode(code));
}
function $createMathBlockNode(code = "") {
	return $applyNodeReplacement(new MathBlockNode(code));
}
function $convertMathInlineElement() {
	return { node: $createMathInlineNode() };
}
function $convertMathBlockElement() {
	return { node: $createMathBlockNode() };
}
function $isMathNode(node) {
	return node instanceof MathInlineNode || node instanceof MathBlockNode;
}
//#endregion
//#region src/plugins/mention/node/MentionNode.ts
init_utils$1();
var MentionNode = class MentionNode extends DecoratorNode {
	static getType() {
		return "mention";
	}
	static clone(node) {
		return new MentionNode(node.__label, node.__metadata, node.__key);
	}
	static importJSON(serializedNode) {
		return $createMentionNode().updateFromJSON(serializedNode);
	}
	static importDOM() {
		return { span: (node) => {
			if (node.classList.contains("mention")) return {
				conversion: $convertMentionElement,
				priority: 0
			};
			return null;
		} };
	}
	constructor(label = "", metadata = {}, key) {
		super(key);
		this.__label = label;
		this.__metadata = metadata;
	}
	get label() {
		return this.__label;
	}
	get metadata() {
		return this.__metadata;
	}
	exportDOM() {
		return { element: document.createElement("span") };
	}
	createDOM(config) {
		const element = document.createElement("span");
		addClassNamesToElement(element, config.theme.mention);
		return element;
	}
	getTextContent() {
		return this.label;
	}
	isInline() {
		return true;
	}
	updateDOM() {
		return false;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			label: this.label,
			metadata: this.metadata
		};
	}
	updateFromJSON(serializedNode) {
		const node = super.updateFromJSON(serializedNode);
		this.__label = serializedNode.label || "";
		this.__metadata = serializedNode.metadata || {};
		return node;
	}
	decorate(editor) {
		const decorator = getKernelFromEditor(editor)?.getDecorator(MentionNode.getType());
		if (!decorator) return null;
		if (typeof decorator === "function") return decorator(this, editor);
		return {
			queryDOM: decorator.queryDOM,
			render: decorator.render(this, editor)
		};
	}
};
function $createMentionNode(label, metadata) {
	return $applyNodeReplacement(new MentionNode(label, metadata));
}
function $convertMentionElement() {
	return { node: $createMentionNode() };
}
function $isMentionNode(node) {
	return node.getType() === MentionNode.getType();
}
//#endregion
//#region src/plugins/mention/react/style.ts
const styles = createStaticStyles(({ css, cssVar }) => ({ mention: css`
    user-select: none;

    position: relative;

    display: inline;

    margin-inline: 0.25em;
    padding-block: 0.2em;
    padding-inline: 0.4em;
    border: 1px solid ${cssVar.colorInfoBgHover};
    border-radius: 0.25em;

    font-size: 0.875em;
    line-height: 1;
    color: ${cssVar.colorInfo};
    word-break: break-word;
    white-space: break-spaces;

    background: ${cssVar.colorInfoBg};

    .editor_mention {
      padding: 0;
    }

    &.selected {
      color: #000;
      background: ${cssVar.yellow};
    }
  ` }));
//#endregion
export { HOVER_COMMAND as $, $isSelectionInCodeInline as A, $isCursorNode as B, formatUrl as C, INodeHelper as Ct, supportedLanguagesInfo as D, zhCN as Dt, resolveSupportedLanguageId as E, init_locale as Et, $createCodeMirrorNode as F, Editor as G, CursorNode as H, $isCodeMirrorNode as I, Kernel as J, resetRandomKey as K, CodeMirrorNode as L, getCodeInlineNode as M, styles$1 as N, $createCodeNode as O, themeStyles as P, init_plugin as Q, $createCursorNode as R, TOGGLE_LINK_COMMAND as S, init_utils as St, findSupportedLanguageInfo as T, enUS as Tt, cursorNodeSerialized as U, CardLikeElementNode as V, registerCursorNode as W, kernel_exports as X, init_kernel as Y, KernelPlugin as Z, AutoLinkNode as _, $isCursorInQuote as _t, $createMathBlockNode as a, HotkeyScopeEnum as at, HOVER_OUT_LINK_COMMAND as b, createBlockNode as bt, MathBlockNode as c, browserDebug as ct, $isLinkHighlightNode as d, debugLoggers as dt, getHotkeyById as et, LinkHighlightNode as f, debug_exports as ft, $toggleLink as g, $canShowPlaceholderCurry as gt, $isLinkNode as h, prodSafeLogger as ht, MentionNode as i, HotkeyEnum as it, CodeNode as j, $isCodeInlineNode as k, MathInlineNode as l, createDebugLogger as lt, $createLinkNode as m, init_debug as mt, $createMentionNode as n, CONTROL_OR_META as nt, $createMathInlineNode as o, KeyEnum as ot, getLinkHighlightNode as p, devConsole as pt, DataSource as q, $isMentionNode as r, init_sys as rt, $isMathNode as s, init_hotkey$1 as st, styles as t, init_registerHotkey as tt, $createLinkHighlightNode as u, debugLogger as ut, EDIT_LINK_COMMAND as v, $isCursorInTable as vt, SUPPORTED_SHIKI_LANGUAGE_IDS as w, init_helper as wt, LinkNode as x, exportNodeToJSON as xt, HOVER_LINK_COMMAND as y, $isRootTextContentEmpty as yt, $isCardLikeElementNode as z };
