import { C as noop } from "./utils-DR6xvOCh.js";
import { A as $isSelectionInCodeInline, C as formatUrl, D as supportedLanguagesInfo, F as $createCodeMirrorNode, G as Editor$2, I as $isCodeMirrorNode, S as TOGGLE_LINK_COMMAND, St as init_utils, a as $createMathBlockNode, d as $isLinkHighlightNode, h as $isLinkNode, o as $createMathInlineNode, yt as $isRootTextContentEmpty } from "./style-B85viVq4.js";
import { E as ReactPlainText, J as ReactEditor, P as ReactEditorContent, S as INSERT_CHECK_LIST_COMMAND, a as ReactMentionPlugin, b as ReactMarkdownPlugin, c as INSERT_LINK_HIGHLIGHT_COMMAND, f as sanitizeUrl, g as UPDATE_CODEBLOCK_LANG, n as ReactSlashOption, p as validateUrl, t as ReactSlashPlugin, u as extractUrlFromText, w as INSERT_CODEINLINE_COMMAND, x as useTranslation } from "./ReactSlashPlugin-Dz3bYDG1.js";
import { r as useLexicalComposerContext } from "./react-context-DwwzSNVm.js";
import { t as useEditorLocale } from "./useEditorLocale-D19_9zmS.js";
import { $createNodeSelection, $createParagraphNode, $getPreviousSelection, $getSelection, $isParagraphNode, $isRangeSelection, $isRootOrShadowRoot, $isTextNode, $setSelection, CAN_REDO_COMMAND, CAN_UNDO_COMMAND, COMMAND_PRIORITY_LOW, FORMAT_TEXT_COMMAND, REDO_COMMAND, SELECTION_CHANGE_COMMAND, UNDO_COMMAND } from "lexical";
import { $createQuoteNode, $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import { $findMatchingParent, $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { createContext, createElement, isValidElement, memo, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { $isAtNodeEnd, $setBlocksType } from "@lexical/selection";
import { $isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListNode } from "@lexical/list";
import { $createCodeNode, $isCodeNode } from "@lexical/code-core";
import { createPortal } from "react-dom";
import { ActionIcon, Block, Button, Dropdown, Flexbox, Icon, MaterialFileTypeIcon, Menu, Popover, Select, Text, TooltipGroup, useMotionComponent } from "@lobehub/ui";
import { createStaticStyles, createStyles, cssVar, cx, useThemeMode } from "antd-style";
import { ColorPicker, Divider, Dropdown as Dropdown$1, Space } from "antd";
import { ChevronDownIcon, CircleChevronLeftIcon, CircleChevronRightIcon, CircleChevronUpIcon } from "lucide-react";
import { Resizable } from "re-resizable";
import useMergeState from "use-merge-value";
import { debounce } from "es-toolkit";
//#region src/react/hooks/useSize.ts
const useWidth = (options = {}) => {
	const { debounceMs = 100 } = options;
	const ref = useRef(null);
	const [size, setSize] = useState();
	const resizeObserverRef = useRef(null);
	const updateSize = useCallback(debounce((entries) => {
		if (entries[0]) {
			const { width } = entries[0].contentRect;
			setSize(Math.floor(width));
		}
	}, debounceMs), [debounceMs]);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		resizeObserverRef.current = new ResizeObserver(updateSize);
		resizeObserverRef.current.observe(element);
		return () => {
			if (resizeObserverRef.current) {
				resizeObserverRef.current.disconnect();
				updateSize.cancel?.();
			}
		};
	}, [updateSize]);
	return {
		ref,
		width: size
	};
};
const useHeight = (options = {}) => {
	const { debounceMs = 100 } = options;
	const ref = useRef(null);
	const [size, setSize] = useState();
	const resizeObserverRef = useRef(null);
	const updateSize = useCallback(debounce((entries) => {
		if (entries[0]) {
			const { height } = entries[0].contentRect;
			setSize(Math.floor(height));
		}
	}, debounceMs), [debounceMs]);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		resizeObserverRef.current = new ResizeObserver(updateSize);
		resizeObserverRef.current.observe(element);
		return () => {
			if (resizeObserverRef.current) {
				resizeObserverRef.current.disconnect();
				updateSize.cancel?.();
			}
		};
	}, [updateSize]);
	return {
		height: size,
		ref
	};
};
//#endregion
//#region src/react/ChatInput/style.ts
const styles$8 = createStaticStyles(({ css, cssVar }) => ({
	bodyEditor: css`
    z-index: 0;
    flex: 1;
  `,
	containerDark: css`
    position: relative;

    display: flex;
    flex-direction: column;

    height: 100%;
    border: 1px solid ${cssVar.colorFillSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background-color: ${cssVar.colorBgElevated};
    box-shadow: 0 4px 4px color-mix(in srgb, #000 40%, transparent);
  `,
	containerLight: css`
    position: relative;

    display: flex;
    flex-direction: column;

    height: 100%;
    border: 1px solid ${cssVar.colorFill};
    border-radius: ${cssVar.borderRadiusLG};

    background-color: ${cssVar.colorBgElevated};
    box-shadow: 0 4px 4px color-mix(in srgb, #000 4%, transparent);
  `,
	editor: css`
    cursor: text;

    overflow: hidden auto;
    flex: 1;

    width: 100%;
    padding-block: 8px 0;
    padding-inline: 12px;
  `,
	footer: css`
    z-index: 1;
    width: 100%;
  `,
	header: css`
    z-index: 1;
    width: 100%;
  `,
	resizableContainer: css`
    position: relative;

    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    align-self: flex-end;

    width: 100%;

    &:hover .resize-handle {
      opacity: 1;
    }
  `,
	resizeHandle: css`
    position: absolute;
    inset-block-start: -4px;
    inset-inline-start: 50%;
    transform: translateX(-50%);

    width: 100%;
    height: 8px;

    opacity: 0;

    transition: opacity 0.2s ease-in-out;

    &::before {
      content: '';

      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 50%;
      transform: translateX(-50%);

      width: 32px;
      height: 4px;
      border-radius: 4px;

      background-color: ${cssVar.colorPrimary};
      box-shadow: 0 1px 2px color-mix(in srgb, ${cssVar.colorTextSecondary} 12.5%, transparent);
    }

    &:hover {
      opacity: 1 !important;

      &::before {
        background-color: ${cssVar.colorPrimaryHover};
        box-shadow: 0 2px 4px color-mix(in srgb, ${cssVar.colorTextSecondary} 25%, transparent);
      }
    }

    &:active {
      &::before {
        background-color: ${cssVar.colorPrimaryActive};
      }
    }
  `,
	root: css`
    position: relative;
  `
}));
//#endregion
//#region src/react/ChatInput/ChatInput.tsx
const ChatInput = (props) => {
	const { defaultHeight = props.defaultHeight || props.minHeight || 64, height, maxHeight = 320, minHeight = 64, resizeMaxHeightOffset = 120, resize = true, onSizeChange, onSizeDragging, className, children, footer, header, style, slashMenuRef, classNames, fullscreen, showResizeHandle, onBodyClick, styles: customStyles, ...rest } = props;
	const { isDarkMode } = useThemeMode();
	const { ref: headerRef, height: headerHeight = 0 } = useHeight();
	const [currentHeight, setCurrentHeight] = useMergeState(defaultHeight, {
		defaultValue: defaultHeight,
		onChange: onSizeChange,
		value: height
	});
	const handleResizeStop = useCallback((e, direction, ref) => {
		setCurrentHeight(ref.style.height ? parseInt(ref.style.height) : defaultHeight);
	}, [setCurrentHeight, defaultHeight]);
	const handleResize = useCallback((e, direction, ref) => {
		const newHeight = ref.style.height ? parseInt(ref.style.height) : defaultHeight;
		onSizeDragging?.(newHeight);
	}, [onSizeDragging, defaultHeight]);
	const bodyNode = /* @__PURE__ */ jsx("div", {
		className: cx(styles$8.editor, styles$8.bodyEditor, classNames?.body),
		draggable: false,
		onClick: onBodyClick,
		style: {
			...customStyles?.body,
			maxHeight: fullscreen ? "100%" : maxHeight,
			minHeight: resize ? currentHeight : minHeight
		},
		children
	});
	return /* @__PURE__ */ jsxs(Flexbox, {
		className: cx(isDarkMode ? styles$8.containerDark : styles$8.containerLight, styles$8.root, className),
		height: fullscreen ? "100%" : void 0,
		style,
		width: "100%",
		...rest,
		children: [
			slashMenuRef && /* @__PURE__ */ jsx("div", { ref: slashMenuRef }),
			/* @__PURE__ */ jsx("div", {
				className: cx(styles$8.header, classNames?.header),
				ref: headerRef,
				style: customStyles?.header,
				children: header
			}),
			resize ? /* @__PURE__ */ jsx(Resizable, {
				className: styles$8.resizableContainer,
				enable: fullscreen ? false : { top: true },
				handleClasses: { top: showResizeHandle ? styles$8.resizeHandle : void 0 },
				handleStyles: { top: {
					backgroundColor: "transparent",
					borderRadius: "4px",
					cursor: "ns-resize",
					height: "8px",
					left: "50%",
					top: !!header ? -3 - headerHeight : -3,
					transform: "translateX(-50%)",
					width: "100%"
				} },
				maxHeight: fullscreen ? void 0 : maxHeight + resizeMaxHeightOffset,
				minHeight: fullscreen ? void 0 : minHeight,
				onResize: handleResize,
				onResizeStop: handleResizeStop,
				size: {
					height: fullscreen ? void 0 : "auto",
					width: "100%"
				},
				style: fullscreen ? {
					flex: 1,
					overflow: "hidden",
					position: "relative"
				} : void 0,
				children: bodyNode
			}) : bodyNode,
			/* @__PURE__ */ jsx("div", {
				className: cx(styles$8.footer, classNames?.footer),
				style: customStyles?.footer,
				children: footer
			})
		]
	});
};
ChatInput.displayName = "ChatInput";
//#endregion
//#region src/react/ChatInputActionBar/style.ts
const styles$7 = createStaticStyles(({ css }) => ({ container: css`
    overflow: hidden;
  ` }));
//#endregion
//#region src/react/ChatInputActionBar/ChatInputActionBar.tsx
const ChatInputActionBar = ({ className, style, left, right, ...rest }) => {
	return /* @__PURE__ */ jsxs(Flexbox, {
		align: "center",
		className: cx(styles$7.container, className),
		gap: 4,
		horizontal: true,
		justify: "space-between",
		padding: 4,
		style,
		...rest,
		children: [left, right]
	});
};
ChatInputActionBar.displayName = "ChatInputActionBar";
//#endregion
//#region src/react/ColorPickerBtn.tsx
const PRESETS = [{
	colors: [
		"#000000",
		"#ffffff",
		"#dc2626",
		"#ea580c",
		"#d97706",
		"#65a30d",
		"#059669",
		"#0891b2",
		"#2563eb",
		"#7c3aed",
		"#db2777",
		"#6b7280"
	],
	label: "Default"
}];
const lastUsedColors = {};
const ColorPickerBtn = ({ active, defaultColor = "#000000", editor, icon: Icon, label, onChange, value }) => {
	const storageKey = Icon ? "bg" : "text";
	const [hovered, setHovered] = useState(false);
	const displayColor = value || lastUsedColors[storageKey] || defaultColor;
	const appliedColor = lastUsedColors[storageKey] || defaultColor;
	const underlineColor = Icon && !lastUsedColors[storageKey] && !value ? "#D1D5DB" : appliedColor;
	const handleChange = (_, css) => {
		lastUsedColors[storageKey] = css;
		onChange?.(css);
	};
	const handleApplyColor = useCallback(() => {
		const lexicalEditor = editor?.getLexicalEditor();
		if (!lexicalEditor) return;
		lexicalEditor.getEditorState().read(() => {
			const sel = $getSelection() || $getPreviousSelection();
			if (!$isRangeSelection(sel) || sel.isCollapsed()) return;
			onChange?.(appliedColor);
		});
	}, [
		editor,
		onChange,
		appliedColor
	]);
	const handleLeftMouseDown = useCallback((e) => {
		e.preventDefault();
		handleApplyColor();
		editor?.getLexicalEditor()?.getRootElement()?.focus({ preventScroll: true });
	}, [handleApplyColor, editor]);
	const handleRightMouseDown = useCallback((e) => {
		e.preventDefault();
		editor?.getLexicalEditor()?.getRootElement()?.focus({ preventScroll: true });
	}, [editor]);
	return /* @__PURE__ */ jsxs("div", {
		onMouseEnter: () => setHovered(true),
		onMouseLeave: () => setHovered(false),
		style: {
			alignItems: "center",
			backgroundColor: hovered ? "#EAEAEA" : "transparent",
			borderRadius: 6,
			display: "flex",
			height: 36,
			paddingInline: 4,
			transition: "background-color 100ms"
		},
		children: [/* @__PURE__ */ jsxs("div", {
			onMouseDown: handleLeftMouseDown,
			style: {
				alignItems: "center",
				cursor: "pointer",
				display: "flex",
				flexDirection: "column",
				paddingInline: 6
			},
			children: [Icon ? /* @__PURE__ */ jsx(ActionIcon, {
				active,
				icon: Icon,
				size: {
					blockSize: 28,
					size: 18
				},
				title: label
			}) : /* @__PURE__ */ jsx("span", {
				style: {
					color: "rgba(0, 0, 0, 0.45)",
					fontSize: 18,
					fontWeight: 500,
					lineHeight: 1.2
				},
				children: "A"
			}), /* @__PURE__ */ jsx("div", { style: {
				backgroundColor: underlineColor,
				borderRadius: 1,
				height: 2.5,
				marginTop: Icon ? -2 : 1,
				width: 16
			} })]
		}), /* @__PURE__ */ jsx(ColorPicker, {
			format: "hex",
			getPopupContainer: () => document.body,
			onChange: handleChange,
			panelRender: (_, { components: { Picker, Presets } }) => /* @__PURE__ */ jsxs("div", { children: [
				/* @__PURE__ */ jsx(Presets, {}),
				/* @__PURE__ */ jsx("div", { style: {
					borderTop: "1px solid rgba(5, 5, 5, 0.06)",
					margin: "8px 0"
				} }),
				/* @__PURE__ */ jsx(Picker, {})
			] }),
			presets: PRESETS,
			styles: { popupOverlayInner: { zIndex: 1e4 } },
			value: displayColor,
			children: /* @__PURE__ */ jsx("div", {
				onMouseDown: handleRightMouseDown,
				style: {
					alignItems: "center",
					cursor: "pointer",
					display: "flex",
					justifyContent: "center",
					padding: "6px 4px"
				},
				children: /* @__PURE__ */ jsx(ChevronDownIcon, {
					color: "#9CA3AF",
					size: 12
				})
			})
		})]
	});
};
//#endregion
//#region src/react/ChatInputActions/style.ts
const styles$6 = createStaticStyles(({ css }) => ({
	collapsedContainer: css`
    overflow: hidden;
    display: flex;
    align-items: center;
  `,
	container: css`
    position: relative;
    overflow: hidden;
    width: 100%;
  `,
	divider: css`
    height: 20px;
    margin-inline: 4px;
  `
}));
//#endregion
//#region src/react/ChatInputActions/components/ActionRender.tsx
const ActionRender$1 = ({ item, onActionClick, disabled }) => {
	if (item.type === "divider") return /* @__PURE__ */ jsx(Divider, {
		className: styles$6.divider,
		orientation: "vertical"
	});
	if (item.type === "colorPicker") {
		const btn = /* @__PURE__ */ jsx(ColorPickerBtn, {
			active: item.active,
			defaultColor: item.defaultColor,
			editor: item.editor,
			icon: item.icon,
			label: item.label,
			onChange: item.onChange,
			value: item.value
		});
		if (!item.wrapper) return btn;
		return item.wrapper(btn);
	}
	const { wrapper, icon, key, label, onClick, danger, loading, active, tooltipProps, ...itemRest } = item;
	if (item.children && isValidElement(item.children)) {
		if (!wrapper) return item.children;
		return wrapper(item.children);
	}
	const action = /* @__PURE__ */ jsx(ActionIcon, {
		active,
		danger,
		disabled: disabled || loading || itemRest?.disabled,
		icon,
		loading,
		onClick: (e) => {
			onActionClick?.({
				domEvent: e,
				key: String(key),
				keyPath: [String(key)]
			});
			onClick?.(e);
		},
		size: {
			blockSize: 36,
			size: 20
		},
		title: label,
		tooltipProps: {
			placement: "top",
			...tooltipProps
		}
	});
	if (!wrapper) return action;
	return wrapper(action);
};
//#endregion
//#region src/react/ChatInputActions/components/CollapsedActions.tsx
const CollapsedActions$1 = ({ children, groupCollapse = false, onGroupCollapseChange, gap, mode }) => {
	const Motion = useMotionComponent();
	if (mode === "popup") return /* @__PURE__ */ jsx(Popover, {
		arrow: false,
		content: /* @__PURE__ */ jsx(Flexbox, {
			align: "center",
			gap,
			horizontal: true,
			children
		}),
		styles: { content: { padding: 4 } },
		children: /* @__PURE__ */ jsx(ActionIcon, {
			icon: CircleChevronUpIcon,
			size: {
				blockSize: 36,
				size: 20
			}
		})
	});
	return /* @__PURE__ */ jsxs(Flexbox, {
		align: "center",
		flex: "none",
		gap,
		horizontal: true,
		children: [/* @__PURE__ */ jsx(Motion.div, {
			animate: groupCollapse ? "closed" : "open",
			className: styles$6.collapsedContainer,
			initial: groupCollapse ? "closed" : "open",
			style: { gap },
			transition: { duration: .2 },
			variants: {
				closed: {
					opacity: 0,
					width: 0
				},
				open: {
					opacity: 1,
					width: "auto"
				}
			},
			children
		}), /* @__PURE__ */ jsx(ActionIcon, {
			icon: groupCollapse ? CircleChevronRightIcon : CircleChevronLeftIcon,
			onClick: () => onGroupCollapseChange?.(!groupCollapse),
			size: {
				blockSize: 36,
				size: 20
			}
		})]
	});
};
CollapsedActions$1.displayName = "ChatInputActionsCollapse";
//#endregion
//#region src/react/ChatInputActions/components/ActionItem.tsx
const ActionItem$1 = ({ item, disabled, onActionClick, groupCollapsed, collapsed, gap, setGroupCollapsed }) => {
	if (item.type === "collapse") return /* @__PURE__ */ jsx(CollapsedActions$1, {
		gap,
		groupCollapse: groupCollapsed,
		mode: collapsed ? "popup" : "default",
		onGroupCollapseChange: setGroupCollapsed,
		children: item.children.map((child, childIndex) => /* @__PURE__ */ jsx(ActionRender$1, {
			disabled,
			item: child,
			onActionClick
		}, child?.key || `action-${childIndex}`))
	});
	if (item.type === "dropdown") return /* @__PURE__ */ jsx(Dropdown, {
		menu: { items: item.children },
		children: /* @__PURE__ */ jsx(ActionIcon, {
			active: item.active,
			danger: item.danger,
			disabled: disabled || item.loading || item?.disabled,
			icon: item.icon,
			loading: item.loading,
			size: {
				blockSize: 36,
				size: 20
			},
			title: item.label,
			tooltipProps: {
				placement: "top",
				...item.tooltipProps
			}
		})
	}, item.key);
	return /* @__PURE__ */ jsx(ActionRender$1, {
		disabled,
		item,
		onActionClick
	});
};
ActionItem$1.displayName = "ChatInputActionItem";
//#endregion
//#region src/react/ChatInputActions/components/useDisplayActionCount.ts
const useDisplayActionCount = ({ items = [], collapseOffset = 0, autoCollapse } = {}) => {
	const { ref, width } = useWidth();
	const [collapsed, setCollapsed] = useState(false);
	const flatItems = useMemo(() => items.flatMap((item) => {
		if (item.type === "collapse" && item.children) return item.children;
		return item;
	}).filter((item) => item.type !== "divider"), [items]);
	const alwaysDisplayCount = useMemo(() => items.filter((item) => item.alwaysDisplay).length, [items]);
	const rawMaxCount = useMemo(() => flatItems.length + 1, [flatItems.length]);
	const [maxCount, setMaxCount] = useState(rawMaxCount);
	useEffect(() => {
		if (!autoCollapse) {
			setCollapsed(false);
			setMaxCount(rawMaxCount);
			return;
		}
		if (!width) return;
		const atLeastCount = 1 + alwaysDisplayCount;
		let calcMaxCount = Math.floor((width - collapseOffset) / 38);
		if (calcMaxCount < atLeastCount) calcMaxCount = atLeastCount;
		setCollapsed(calcMaxCount < rawMaxCount);
		if (calcMaxCount >= rawMaxCount) return;
		setMaxCount(calcMaxCount);
	}, [
		autoCollapse,
		width,
		rawMaxCount,
		collapseOffset,
		alwaysDisplayCount
	]);
	return useMemo(() => ({
		collapsed,
		maxCount,
		ref
	}), [
		collapsed,
		maxCount,
		ref
	]);
};
//#endregion
//#region src/react/ChatInputActions/ChatInputActions.tsx
const ChatInputActions = memo(({ gap = 2, disabled, items = [], onActionClick, className, collapseOffset = 0, autoCollapse = true, defaultGroupCollapse = false, onGroupCollapseChange, groupCollapse, ...rest }) => {
	const [groupCollapsed, setGroupCollapsed] = useMergeState(defaultGroupCollapse, {
		defaultValue: defaultGroupCollapse,
		onChange: onGroupCollapseChange,
		value: groupCollapse
	});
	const { ref, maxCount, collapsed } = useDisplayActionCount({
		autoCollapse,
		collapseOffset,
		items
	});
	const calcItem = useMemo(() => {
		if (!collapsed) return items;
		const alwaysDisplayItems = items.filter((item) => item.alwaysDisplay);
		const normalItems = items.filter((item) => item.type !== "collapse" && !item.alwaysDisplay);
		const collapseItems = items.find((item) => item.type === "collapse" && item.children) || {
			children: [],
			type: "collapse"
		};
		const sliceCount = maxCount - alwaysDisplayItems.length - 1;
		return [
			...normalItems.slice(0, sliceCount),
			{
				...collapseItems,
				children: [...normalItems.filter((item) => item.type !== "divider").slice(sliceCount), ...collapseItems.children]
			},
			...alwaysDisplayItems
		].filter(Boolean);
	}, [
		collapsed,
		items,
		maxCount
	]);
	return /* @__PURE__ */ jsx(TooltipGroup, { children: /* @__PURE__ */ jsx(Flexbox, {
		align: "center",
		className: cx(styles$6.container, className),
		flex: 1,
		gap,
		horizontal: true,
		ref,
		...rest,
		children: calcItem.map((item, index) => /* @__PURE__ */ jsx(ActionItem$1, {
			collapsed,
			disabled,
			gap,
			groupCollapsed,
			item,
			onActionClick,
			setGroupCollapsed
		}, item.key || index))
	}) });
});
ChatInputActions.displayName = "ChatInputActions";
//#endregion
//#region src/react/CodeLanguageSelect/style.ts
const styles$5 = createStaticStyles(({ css }) => ({ container: css`
    width: 160px;
  ` }));
//#endregion
//#region src/react/CodeLanguageSelect/CodeLanguageSelect.tsx
const CodeLanguageSelect = ({ className, ...rest }) => {
	const options = useMemo(() => [{
		aliases: ["text", "txt"],
		label: /* @__PURE__ */ jsxs(Flexbox, {
			align: "center",
			gap: 4,
			horizontal: true,
			children: [/* @__PURE__ */ jsx(MaterialFileTypeIcon, {
				fallbackUnknownType: false,
				filename: `*.txt`,
				size: 18,
				type: "file",
				variant: "raw"
			}), /* @__PURE__ */ jsx(Text, {
				ellipsis: true,
				fontSize: 13,
				children: "Plaintext"
			})]
		}),
		value: "plaintext"
	}, ...supportedLanguagesInfo.map((item) => ({
		aliases: item.aliases,
		label: /* @__PURE__ */ jsxs(Flexbox, {
			align: "center",
			gap: 4,
			horizontal: true,
			children: [/* @__PURE__ */ jsx(MaterialFileTypeIcon, {
				fallbackUnknownType: false,
				filename: `*.${item?.aliases?.[0] || item.id}`,
				size: 18,
				type: "file",
				variant: "raw"
			}), /* @__PURE__ */ jsx(Text, {
				ellipsis: true,
				fontSize: 13,
				children: item.name
			})]
		}),
		title: (item.aliases || [item.id]).filter(Boolean).map((item) => `*.${item}`).join(","),
		value: item.id
	}))], []);
	return /* @__PURE__ */ jsx(Select, {
		className: cx(styles$5.container, className),
		defaultValue: "plaintext",
		filterOption: (input, option) => {
			const lang = input.toLowerCase();
			if ((option?.value)?.startsWith(lang)) return true;
			if (option?.aliases?.some((item) => item.startsWith(lang))) return true;
			return false;
		},
		options,
		showSearch: true,
		variant: "filled",
		...rest
	});
};
CodeLanguageSelect.displayName = "CodeLanguageSelect";
//#endregion
//#region src/react/hooks/useEditor.ts
const useEditor = () => {
	const editor = useMemo(() => Editor$2.createEditor(), []);
	const pendingDestroyRef = useRef(null);
	useEffect(() => {
		if (pendingDestroyRef.current) pendingDestroyRef.current = null;
		return () => {
			pendingDestroyRef.current = () => {
				editor.destroy();
			};
			queueMicrotask(() => {
				if (pendingDestroyRef.current) {
					pendingDestroyRef.current();
					pendingDestroyRef.current = null;
				}
			});
		};
	}, [editor]);
	return editor;
};
//#endregion
//#region src/react/hooks/useEditorState/utils.ts
init_utils();
const $findTopLevelElement = (node) => {
	let topLevelElement = node.getKey() === "root" ? node : $findMatchingParent(node, (e) => {
		const parent = e.getParent();
		return parent !== null && $isRootOrShadowRoot(parent);
	});
	if (topLevelElement === null) topLevelElement = node.getTopLevelElementOrThrow();
	return topLevelElement;
};
const formatParagraph = (editor) => {
	editor?.update(() => {
		$setBlocksType($getSelection(), () => $createParagraphNode());
	});
};
const getSelectedNode = (selection) => {
	const anchor = selection.anchor;
	const focus = selection.focus;
	const anchorNode = selection.anchor.getNode();
	const focusNode = selection.focus.getNode();
	if (anchorNode === focusNode) return anchorNode;
	if (selection.isBackward()) return $isAtNodeEnd(focus) ? anchorNode : focusNode;
	else return $isAtNodeEnd(anchor) ? anchorNode : focusNode;
};
//#endregion
//#region src/react/hooks/useEditorState/index.ts
/**
* Provide toolbar state and toolbar methods
* @param editor - Editor instance
* @returns Editor state and methods for toolbar functionality
*/
function useEditorState(editor) {
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	const [editable, setEditable] = useState(editor?.isEditable() ?? true);
	const [isBold, setIsBold] = useState(false);
	const [isItalic, setIsItalic] = useState(false);
	const [isUnderline, setIsUnderline] = useState(false);
	const [isStrikethrough, setIsStrikethrough] = useState(false);
	const [isSubscript, setIsSubscript] = useState(false);
	const [isSuperscript, setIsSuperscript] = useState(false);
	const [isCode, setIsCode] = useState(false);
	const [isLink, setIsLink] = useState(false);
	const [isCodeblock, setIsInCodeblok] = useState(false);
	const [isBlockquote, setIsInBlockquote] = useState(false);
	const [codeblockLang, setCodeblockLang] = useState(null);
	const [isEmpty, setIsEmpty] = useState(true);
	const [isSelected, setIsSelected] = useState(false);
	const [blockType, setBlockType] = useState(null);
	const [textColor, setTextColorState] = useState("");
	const [bgColor, setBgColorState] = useState("");
	const $handleHeadingNode = useCallback((selectedElement) => {
		setBlockType($isHeadingNode(selectedElement) ? selectedElement.getTag() : selectedElement.getType());
	}, [setBlockType]);
	const $updateToolbar = useCallback(() => {
		const selection = $getSelection();
		const lexicalEditor = editor?.getLexicalEditor();
		setIsSelected(false);
		setEditable(editor?.isEditable() ?? true);
		if (lexicalEditor) setIsEmpty($isRootTextContentEmpty(lexicalEditor.isComposing(), false));
		if ($isRangeSelection(selection)) {
			setIsSelected(!!selection._cachedNodes);
			setIsBold(selection.hasFormat("bold"));
			setIsItalic(selection.hasFormat("italic"));
			setIsUnderline(selection.hasFormat("underline"));
			setIsStrikethrough(selection.hasFormat("strikethrough"));
			setIsSubscript(selection.hasFormat("subscript"));
			setIsSuperscript(selection.hasFormat("superscript"));
			setIsCode(lexicalEditor ? $isSelectionInCodeInline(lexicalEditor) : false);
			const anchorNode = selection.anchor.getNode();
			const focusNode = selection.focus.getNode();
			const element = $findTopLevelElement(anchorNode);
			const focusElement = $findTopLevelElement(focusNode);
			const elementKey = element.getKey();
			const elementDOM = editor?.getLexicalEditor()?.getElementByKey(elementKey);
			const node = getSelectedNode(selection);
			const parent = node.getParent();
			setIsLink($isLinkNode(parent) || $isLinkNode(node) || $isLinkHighlightNode(parent) || $isLinkHighlightNode(node));
			const isLexicalCodeBlock = $isCodeNode(element) && $isCodeNode(focusElement) && elementKey === focusElement.getKey();
			const isCodeMirrorBlock = $isCodeMirrorNode(element) && $isCodeMirrorNode(focusElement) && elementKey === focusElement.getKey();
			setIsInCodeblok(isLexicalCodeBlock || isCodeMirrorBlock);
			if (isLexicalCodeBlock) setCodeblockLang(element.getLanguage());
			else if (isCodeMirrorBlock) setCodeblockLang(element.lang);
			else setCodeblockLang("");
			setIsInBlockquote($isQuoteNode(element) && $isQuoteNode(focusElement) && elementKey === focusElement.getKey());
			if (elementDOM !== null) if ($isListNode(element)) {
				const parentList = $getNearestNodeOfType(anchorNode, ListNode);
				setBlockType(parentList ? parentList.getListType() : element.getListType());
			} else $handleHeadingNode(element);
			let foundTextColor = "";
			let foundBgColor = "";
			const selectedNodes = selection.getNodes();
			for (const textNode of selectedNodes) if ($isTextNode(textNode)) {
				const style = textNode.getStyle() || "";
				const colorMatch = style.match(/color\s*:\s*([^;]+)/);
				if (colorMatch) foundTextColor = colorMatch[1].trim();
				const bgMatch = style.match(/background-color\s*:\s*([^;]+)/);
				if (bgMatch) foundBgColor = bgMatch[1].trim();
				break;
			}
			setTextColorState(foundTextColor);
			setBgColorState(foundBgColor);
		} else if (!selection) {
			setIsSelected(false);
			setIsBold(false);
			setIsItalic(false);
			setIsUnderline(false);
			setIsStrikethrough(false);
			setIsSubscript(false);
			setIsSuperscript(false);
			setIsCode(false);
			setIsLink(false);
			setIsInCodeblok(false);
			setIsInBlockquote(false);
			setCodeblockLang(null);
			setBlockType(null);
		}
	}, [editor]);
	const undo = useCallback(() => {
		editor?.dispatchCommand(UNDO_COMMAND, void 0);
	}, [editor]);
	const redo = useCallback(() => {
		editor?.dispatchCommand(REDO_COMMAND, void 0);
	}, [editor]);
	const formatText = useCallback((type) => {
		editor?.dispatchCommand(FORMAT_TEXT_COMMAND, type);
	}, [editor]);
	const bold = useCallback(() => {
		formatText("bold");
	}, [formatText]);
	const underline = useCallback(() => {
		formatText("underline");
	}, [formatText]);
	const strikethrough = useCallback(() => {
		formatText("strikethrough");
	}, [formatText]);
	const italic = useCallback(() => {
		formatText("italic");
	}, [formatText]);
	const $applyStyleProperty = useCallback((prop, value) => {
		const sel = $getSelection() || $getPreviousSelection();
		if (!$isRangeSelection(sel) || sel.isCollapsed()) return;
		const selectedNodes = sel.getNodes();
		const selectedTextNodes = [];
		for (const node of selectedNodes) if ($isTextNode(node)) selectedTextNodes.push(node);
		if (selectedTextNodes.length === 0) return;
		const anchor = sel.anchor;
		const focus = sel.focus;
		const isBackward = sel.isBackward();
		const startPoint = isBackward ? focus : anchor;
		const endPoint = isBackward ? anchor : focus;
		let firstIndex = 0;
		let firstNode = selectedTextNodes[0];
		let startOffset = startPoint.type === "element" ? 0 : startPoint.offset;
		if (startPoint.type === "text" && startOffset === firstNode.getTextContentSize()) {
			firstIndex = 1;
			firstNode = selectedTextNodes[1];
			startOffset = 0;
		}
		if (!firstNode) return;
		const lastIndex = selectedTextNodes.length - 1;
		let lastNode = selectedTextNodes[lastIndex];
		const endOffset = endPoint.type === "element" ? lastNode.getTextContentSize() : endPoint.offset;
		const buildStyle = (node) => {
			const escaped = prop.replaceAll("-", "\\-");
			let style = node.getStyle().replaceAll(new RegExp(escaped + "\\s*:\\s*[^;]+;?\\s*", "g"), "").trim();
			if (value) style = style ? `${style}; ${prop}: ${value}` : `${prop}: ${value}`;
			return style;
		};
		if (firstNode.is(lastNode)) {
			if (startOffset === 0 && endOffset === firstNode.getTextContentSize()) firstNode.setStyle(buildStyle(firstNode));
			else {
				const splitNodes = firstNode.splitText(startOffset, endOffset);
				const target = startOffset === 0 ? splitNodes[0] : splitNodes[1];
				target.setStyle(buildStyle(target));
			}
			return;
		}
		if (startOffset !== 0) [, firstNode] = firstNode.splitText(startOffset);
		firstNode.setStyle(buildStyle(firstNode));
		if (endOffset > 0) {
			if (endOffset !== lastNode.getTextContentSize()) [lastNode] = lastNode.splitText(endOffset);
			lastNode.setStyle(buildStyle(lastNode));
		}
		for (let i = firstIndex + 1; i < lastIndex; i++) selectedTextNodes[i].setStyle(buildStyle(selectedTextNodes[i]));
	}, []);
	const setTextColor = useCallback((color) => {
		editor?.getLexicalEditor()?.update(() => {
			$applyStyleProperty("color", color);
		});
	}, [editor, $applyStyleProperty]);
	const setBgColor = useCallback((color) => {
		editor?.getLexicalEditor()?.update(() => {
			$applyStyleProperty("background-color", color);
		});
	}, [editor, $applyStyleProperty]);
	const subscript = useCallback(() => {
		formatText("subscript");
	}, [formatText]);
	const superscript = useCallback(() => {
		formatText("superscript");
	}, [formatText]);
	const code = useCallback(() => {
		editor?.dispatchCommand(INSERT_CODEINLINE_COMMAND, void 0);
	}, [formatText]);
	const bulletList = useCallback(() => {
		if (blockType !== "bullet") editor?.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, void 0);
		else formatParagraph(editor?.getLexicalEditor());
	}, [blockType, editor]);
	const numberList = useCallback(() => {
		if (blockType !== "number") editor?.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, void 0);
		else formatParagraph(editor?.getLexicalEditor());
	}, [blockType, editor]);
	const checkList = useCallback(() => {
		if (blockType !== "check") editor?.dispatchCommand(INSERT_CHECK_LIST_COMMAND, void 0);
		else formatParagraph(editor?.getLexicalEditor());
	}, [blockType, editor]);
	const codeblock = useCallback(() => {
		if (blockType !== "code") editor?.getLexicalEditor()?.update(() => {
			let selection = $getSelection();
			if (!selection) return;
			const lexicalEditor = editor?.getLexicalEditor();
			if (lexicalEditor ? lexicalEditor._nodes.has("code") && lexicalEditor._nodes.get("code")?.klass.name === "CodeMirrorNode" : false) if (!$isRangeSelection(selection) || selection.isCollapsed()) {
				const codeMirrorNode = $createCodeMirrorNode("plain", selection.getTextContent());
				const nodeSelection = $createNodeSelection();
				nodeSelection.add(codeMirrorNode.getKey());
				selection.insertNodes([codeMirrorNode]);
				$setSelection(nodeSelection);
			} else {
				const codeMirrorNode = $createCodeMirrorNode("plain", selection.getTextContent());
				selection.insertNodes([codeMirrorNode]);
				const nodeSelection = $createNodeSelection();
				nodeSelection.add(codeMirrorNode.getKey());
				$setSelection(nodeSelection);
			}
			else if (!$isRangeSelection(selection) || selection.isCollapsed()) $setBlocksType(selection, () => $createCodeNode());
			else {
				const textContent = selection.getTextContent();
				const codeNode = $createCodeNode();
				selection.insertNodes([codeNode]);
				selection = $getSelection();
				if ($isRangeSelection(selection)) selection.insertRawText(textContent);
			}
		});
		else formatParagraph(editor?.getLexicalEditor());
	}, [blockType, editor]);
	const blockquote = useCallback(() => {
		if (blockType !== "quote") editor?.getLexicalEditor()?.update(() => {
			const selection = $getSelection();
			if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createQuoteNode());
		});
		else formatParagraph(editor?.getLexicalEditor());
	}, [blockType, editor]);
	const updateCodeblockLang = useCallback((lang) => {
		if (!isCodeblock) return;
		editor?.dispatchCommand(UPDATE_CODEBLOCK_LANG, { lang });
	}, [editor, isCodeblock]);
	const insertLink = useCallback(() => {
		const lexical = editor?.getLexicalEditor();
		if (!lexical) return;
		let inLinkNode = false;
		let inLinkHighlightNode = false;
		lexical.getEditorState().read(() => {
			const selection = $getSelection();
			if ($isRangeSelection(selection)) {
				const node = getSelectedNode(selection);
				const parent = node.getParent();
				if ($isLinkNode(parent) || $isLinkNode(node)) inLinkNode = true;
				if ($isLinkHighlightNode(parent) || $isLinkHighlightNode(node)) inLinkHighlightNode = true;
			}
		});
		if (inLinkHighlightNode) {
			lexical.dispatchCommand(INSERT_LINK_HIGHLIGHT_COMMAND, void 0);
			setIsLink(false);
			return;
		}
		if (inLinkNode) {
			setIsLink(false);
			lexical.dispatchCommand(TOGGLE_LINK_COMMAND, null);
			return;
		}
		if (!isLink) {
			if (lexical.dispatchCommand(INSERT_LINK_HIGHLIGHT_COMMAND, void 0)) {
				setIsLink(true);
				return;
			}
			let nextUrl = sanitizeUrl("https://");
			let expandTo = null;
			lexical.getEditorState().read(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) {
					const text = selection.getTextContent();
					if (!selection.isCollapsed()) {
						const maybeUrl = formatUrl(text.trim());
						if (validateUrl(maybeUrl)) nextUrl = maybeUrl;
					} else {
						const found = extractUrlFromText(selection.anchor.getNode().getTextContent());
						if (found && validateUrl(formatUrl(found.url))) expandTo = {
							index: found.index,
							length: found.length
						};
					}
				}
			});
			setIsLink(true);
			lexical.update(() => {
				if (expandTo) {
					const selection = $getSelection();
					if ($isRangeSelection(selection)) {
						const anchorNode = selection.anchor.getNode();
						selection.anchor.set(anchorNode.getKey(), expandTo.index, "text");
						selection.focus.set(anchorNode.getKey(), expandTo.index + expandTo.length, "text");
					}
				}
				lexical.dispatchCommand(TOGGLE_LINK_COMMAND, validateUrl(nextUrl) ? nextUrl : sanitizeUrl("https://"));
			});
		}
	}, [editor, isLink]);
	const insertMath = useCallback(() => {
		editor?.getLexicalEditor()?.update(() => {
			const selection = $getSelection();
			if ($isRangeSelection(selection)) {
				const element = $findTopLevelElement(selection.anchor.getNode());
				const mathNode = $isParagraphNode(element) && selection.isCollapsed() && selection.anchor.offset === 0 && element.getTextContentSize() === 0 || !selection.isCollapsed() && selection.anchor.offset === 0 && selection.focus.offset === element.getTextContentSize() ? $createMathBlockNode("") : $createMathInlineNode("");
				selection.insertNodes([mathNode]);
				const nodeSelection = $createNodeSelection();
				nodeSelection.add(mathNode.getKey());
				$setSelection(nodeSelection);
			}
		});
	}, [editor]);
	useEffect(() => {
		if (!editor) return;
		const lexicalEditor = editor.getLexicalEditor();
		let cleanup = noop;
		const handleLexicalEditor = (lexicalEditor) => {
			cleanup = mergeRegister(lexicalEditor.registerUpdateListener(({ editorState }) => {
				editorState.read(() => {
					$updateToolbar();
				});
			}), lexicalEditor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
				if (lexicalEditor.isComposing()) return false;
				lexicalEditor.read(() => {
					$updateToolbar();
				});
				return false;
			}, COMMAND_PRIORITY_LOW), lexicalEditor.registerCommand(CAN_UNDO_COMMAND, (payload) => {
				setCanUndo(payload);
				return false;
			}, COMMAND_PRIORITY_LOW), lexicalEditor.registerCommand(CAN_REDO_COMMAND, (payload) => {
				setCanRedo(payload);
				return false;
			}, COMMAND_PRIORITY_LOW));
			return cleanup;
		};
		if (!lexicalEditor) {
			editor.on("initialized", handleLexicalEditor);
			return () => {
				cleanup();
				editor.off("initialized", handleLexicalEditor);
			};
		}
		return handleLexicalEditor(lexicalEditor);
	}, [editor, $updateToolbar]);
	return useMemo(() => ({
		bgColor,
		blockType,
		blockquote,
		bold,
		bulletList,
		canRedo,
		canUndo,
		checkList,
		code,
		codeblock,
		codeblockLang,
		editable,
		insertLink,
		insertMath,
		isBlockquote,
		isBold,
		isCode,
		isCodeblock,
		isEmpty,
		isItalic,
		isSelected,
		isStrikethrough,
		isSubscript,
		isSuperscript,
		isUnderline,
		italic,
		numberList,
		redo,
		setBgColor,
		setTextColor,
		strikethrough,
		subscript,
		superscript,
		textColor,
		underline,
		undo,
		updateCodeblockLang
	}), [
		bgColor,
		blockType,
		canRedo,
		canUndo,
		codeblockLang,
		isBold,
		isCode,
		isEmpty,
		isBlockquote,
		isCodeblock,
		isItalic,
		isSelected,
		isStrikethrough,
		isUnderline,
		isSubscript,
		isSuperscript,
		italic,
		textColor
	]);
}
//#endregion
//#region src/plugins/markdown/react/PasteMarkdownConfirm.tsx
const useStyles = createStyles(({ css, token, prefixCls }) => ({
	actions: css`
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-block-start: 12px;
  `,
	backdrop: css`
    position: fixed;
    z-index: 1000;
    inset: 0;

    background: rgb(0 0 0 / 30%);

    animation: ${prefixCls}-fadeIn 0.15s ease;

    @keyframes ${prefixCls}-fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `,
	btn: css`
    cursor: pointer;

    padding-block: 6px;
    padding-inline: 16px;
    border: 1px solid ${token.colorBorder};
    border-radius: ${token.borderRadius}px;

    font-size: 13px;

    transition: all 0.15s;
  `,
	btnCancel: css`
    color: ${token.colorTextSecondary};
    background: ${token.colorBgContainer};

    &:hover {
      color: ${token.colorText};
      background: ${token.colorFillSecondary};
    }
  `,
	btnConfirm: css`
    border-color: ${token.colorPrimary};
    color: #fff;
    background: ${token.colorPrimary};

    &:hover {
      opacity: 0.85;
    }
  `,
	card: css`
    position: fixed;
    z-index: 1001;
    inset-block-start: 20%;
    inset-inline-start: 50%;
    transform: translateX(-50%);

    width: calc(100vw - 48px);
    max-width: 520px;
    padding-block: 20px;
    padding-inline: 24px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;

    background: ${token.colorBgElevated};
    box-shadow: ${token.boxShadowSecondary};

    animation: ${prefixCls}-slideUp 0.2s ease;

    @keyframes ${prefixCls}-slideUp {
      from {
        transform: translateX(-50%) translateY(12px);
        opacity: 0;
      }

      to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }
  `,
	description: css`
    margin-block-start: 8px;
    font-size: 14px;
    line-height: 1.5;
    color: ${token.colorTextSecondary};
  `,
	preview: css`
    overflow: auto;

    max-height: 180px;
    margin-block-start: 12px;
    padding-block: 10px;
    padding-inline: 12px;
    border-radius: ${token.borderRadius}px;

    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    line-height: 1.5;
    color: ${token.colorTextSecondary};
    word-break: break-all;
    white-space: pre-wrap;

    background: ${token.colorFillTertiary};
  `,
	title: css`
    font-size: 16px;
    font-weight: 600;
    line-height: 1.4;
    color: ${token.colorText};
  `
}));
function PasteMarkdownConfirm({ text, visible, onConfirm, onCancel }) {
	const { styles } = useStyles();
	const t = useTranslation();
	const [editor] = useLexicalComposerContext();
	const confirmRef = useRef(null);
	useEffect(() => {
		if (visible) {
			const timer = setTimeout(() => confirmRef.current?.focus(), 50);
			return () => clearTimeout(timer);
		}
	}, [visible]);
	useEffect(() => {
		if (!visible) return;
		const handleKey = (e) => {
			if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				onCancel();
			}
		};
		window.addEventListener("keydown", handleKey, { capture: true });
		return () => window.removeEventListener("keydown", handleKey, { capture: true });
	}, [visible, onCancel]);
	useEffect(() => {
		if (!visible) editor?.focus();
	}, [visible, editor]);
	if (!visible) return null;
	const preview = text.length > 300 ? text.slice(0, 300) + "..." : text;
	return createPortal(/* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		className: styles.backdrop,
		onClick: onCancel
	}), /* @__PURE__ */ jsxs("div", {
		className: styles.card,
		children: [
			/* @__PURE__ */ jsx("div", {
				className: styles.title,
				children: t("markdown.pasteTitle")
			}),
			/* @__PURE__ */ jsx("div", {
				className: styles.description,
				children: t("markdown.pasteDescription")
			}),
			/* @__PURE__ */ jsx("pre", {
				className: styles.preview,
				children: preview
			}),
			/* @__PURE__ */ jsxs("div", {
				className: styles.actions,
				children: [/* @__PURE__ */ jsx("button", {
					className: `${styles.btn} ${styles.btnCancel}`,
					onClick: onCancel,
					type: "button",
					children: t("markdown.pasteCancel")
				}), /* @__PURE__ */ jsx("button", {
					className: `${styles.btn} ${styles.btnConfirm}`,
					onClick: onConfirm,
					ref: confirmRef,
					type: "button",
					children: t("markdown.pasteConfirm")
				})]
			})
		]
	})] }), document.body);
}
//#endregion
//#region src/react/EditorProvider/index.tsx
const EditorContext = createContext({ config: {} });
const EditorProvider = ({ children, config = {} }) => {
	const value = useMemo(() => ({ config }), [config]);
	return /* @__PURE__ */ jsx(EditorContext.Provider, {
		value,
		children
	});
};
const useEditorContent = () => {
	return use(EditorContext);
};
EditorProvider.displayName = "EditorProvider";
//#endregion
//#region src/react/Editor/Editor.tsx
const Editor$1 = memo(({ content, style, className, debounceWait = 100, editable, editor, onInit, onChange, placeholder, lineEmptyPlaceholder, plugins = [], slashOption = {}, slashPlacement, getPopupContainer, mentionOption = {}, variant, onKeyDown, children, type = "json", onPressEnter, onFocus, onBlur, autoFocus, enablePasteMarkdown = true, autoFormatMarkdown = true, confirmPasteMarkdown, onPasteMarkdown, markdownOption = true, pasteAsPlainText = false, pasteVSCodeAsCodeBlock = true, onCompositionStart, onCompositionEnd, onContextMenu, onTextChange }) => {
	const { config } = useEditorContent();
	const pasteResolveRef = useRef(null);
	const [pasteDialog, setPasteDialog] = useState({
		text: "",
		visible: false
	});
	const handlePasteMarkdown = useCallback((text) => {
		return new Promise((resolve) => {
			pasteResolveRef.current = resolve;
			setPasteDialog({
				text,
				visible: true
			});
		});
	}, []);
	const handlePasteConfirm = useCallback(() => {
		pasteResolveRef.current?.(true);
		pasteResolveRef.current = null;
		setPasteDialog((p) => ({
			...p,
			visible: false
		}));
	}, []);
	const handlePasteCancel = useCallback(() => {
		pasteResolveRef.current?.(false);
		pasteResolveRef.current = null;
		setPasteDialog((p) => ({
			...p,
			visible: false
		}));
	}, []);
	const enableSlash = Boolean(slashOption?.items && slashOption.items.length > 0);
	const enableMention = Boolean(mentionOption?.items && mentionOption.items.length > 0);
	const { markdownWriter, ...restMentionOption } = mentionOption;
	const debouncedOnChange = useMemo(() => onChange ? debounce(onChange, debounceWait) : void 0, [onChange, debounceWait]);
	const debouncedOnTextChange = useMemo(() => onTextChange ? debounce(onTextChange, debounceWait) : void 0, [onTextChange, debounceWait]);
	const memoPlugins = useMemo(() => [enablePasteMarkdown && autoFormatMarkdown && ReactMarkdownPlugin, ...plugins].filter(Boolean).map((plugin, index) => {
		if (typeof plugin === "function") return createElement(plugin, { key: index });
		return createElement(plugin[0], {
			key: index,
			...plugin[1]
		});
	}), [
		plugins,
		enablePasteMarkdown,
		autoFormatMarkdown,
		ReactMarkdownPlugin
	]);
	const memoMention = useMemo(() => {
		if (!enableMention) return;
		return /* @__PURE__ */ jsx(ReactMentionPlugin, {
			className,
			markdownWriter
		});
	}, [
		enableMention,
		markdownWriter,
		className
	]);
	return /* @__PURE__ */ jsxs(ReactEditor, {
		config,
		editor,
		onInit,
		children: [
			memoPlugins,
			useMemo(() => {
				if (!enableSlash && !enableMention) return null;
				return /* @__PURE__ */ jsxs(ReactSlashPlugin, {
					getPopupContainer,
					placement: slashPlacement,
					children: [enableSlash ? /* @__PURE__ */ jsx(ReactSlashOption, {
						maxLength: 8,
						trigger: "/",
						...slashOption
					}) : void 0, enableMention ? /* @__PURE__ */ jsx(ReactSlashOption, {
						maxLength: 8,
						trigger: "@",
						...restMentionOption
					}) : void 0]
				});
			}, [
				enableSlash,
				enableMention,
				slashOption,
				slashPlacement,
				getPopupContainer,
				restMentionOption
			]),
			memoMention,
			/* @__PURE__ */ jsx(ReactPlainText, {
				autoFocus,
				autoFormatMarkdown,
				className,
				editable,
				enablePasteMarkdown,
				markdownOption,
				onBlur,
				onChange: debouncedOnChange,
				onCompositionEnd,
				onCompositionStart,
				onContextMenu,
				onFocus,
				onKeyDown,
				onPasteMarkdown: confirmPasteMarkdown ? handlePasteMarkdown : onPasteMarkdown,
				onPressEnter,
				onTextChange: debouncedOnTextChange,
				pasteAsPlainText,
				pasteVSCodeAsCodeBlock,
				style,
				variant,
				children: /* @__PURE__ */ jsx(ReactEditorContent, {
					content,
					lineEmptyPlaceholder,
					placeholder,
					type
				})
			}),
			children,
			/* @__PURE__ */ jsx(PasteMarkdownConfirm, {
				onCancel: handlePasteCancel,
				onConfirm: handlePasteConfirm,
				text: pasteDialog.text,
				visible: pasteDialog.visible
			})
		]
	});
});
Editor$1.displayName = "Editor";
//#endregion
//#region src/react/Editor/utils.ts
function withProps(plugin, props) {
	return [plugin, props];
}
//#endregion
//#region src/react/Editor/index.ts
const Editor = Editor$1;
Editor.useEditor = useEditor;
Editor.useEditorState = useEditorState;
Editor.withProps = withProps;
//#endregion
//#region src/react/FloatActions/style.ts
const styles$4 = createStaticStyles(({ css }) => ({
	collapsedContainer: css`
    overflow: hidden;
    display: flex;
    align-items: center;
  `,
	container: css`
    position: relative;
    width: 100%;
  `,
	divider: css`
    height: 20px;
    margin-inline: 4px;
  `
}));
//#endregion
//#region src/react/FloatActions/components/ActionRender.tsx
const ActionRender = ({ item, onActionClick, disabled }) => {
	if (item.type === "divider") return /* @__PURE__ */ jsx(Divider, {
		className: styles$4.divider,
		orientation: "vertical"
	});
	if (item.type === "colorPicker") {
		const btn = /* @__PURE__ */ jsx(ColorPickerBtn, {
			active: item.active,
			defaultColor: item.defaultColor,
			editor: item.editor,
			icon: item.icon,
			label: item.label,
			onChange: item.onChange,
			value: item.value
		});
		if (!item.wrapper) return btn;
		return item.wrapper(btn);
	}
	const { wrapper, icon, key, label, onClick, danger, loading, active, tooltipProps, ...itemRest } = item;
	if (item.children && isValidElement(item.children)) {
		if (!wrapper) return item.children;
		return wrapper(item.children);
	}
	const action = /* @__PURE__ */ jsx(ActionIcon, {
		active,
		danger,
		disabled: disabled || loading || itemRest?.disabled,
		icon,
		loading,
		onClick: (e) => {
			onActionClick?.({
				domEvent: e,
				key: String(key),
				keyPath: [String(key)]
			});
			onClick?.(e);
		},
		size: {
			blockSize: 36,
			size: 20
		},
		title: label,
		tooltipProps: {
			placement: "top",
			...tooltipProps
		}
	});
	if (!wrapper) return action;
	return wrapper(action);
};
//#endregion
//#region src/react/FloatActions/components/CollapsedActions.tsx
const CollapsedActions = ({ children, groupCollapse = false, onGroupCollapseChange, gap, mode }) => {
	const Motion = useMotionComponent();
	if (mode === "popup") return /* @__PURE__ */ jsx(Popover, {
		arrow: false,
		content: /* @__PURE__ */ jsx(Flexbox, {
			align: "center",
			gap,
			horizontal: true,
			children
		}),
		styles: { content: { padding: 4 } },
		children: /* @__PURE__ */ jsx(ActionIcon, {
			icon: CircleChevronUpIcon,
			size: {
				blockSize: 36,
				size: 20
			}
		})
	});
	return /* @__PURE__ */ jsxs(Flexbox, {
		align: "center",
		flex: "none",
		gap,
		horizontal: true,
		children: [/* @__PURE__ */ jsx(Motion.div, {
			animate: groupCollapse ? "closed" : "open",
			className: styles$4.collapsedContainer,
			initial: groupCollapse ? "closed" : "open",
			style: { gap },
			transition: { duration: .2 },
			variants: {
				closed: {
					opacity: 0,
					width: 0
				},
				open: {
					opacity: 1,
					width: "auto"
				}
			},
			children
		}), /* @__PURE__ */ jsx(ActionIcon, {
			icon: groupCollapse ? CircleChevronRightIcon : CircleChevronLeftIcon,
			onClick: () => onGroupCollapseChange?.(!groupCollapse),
			size: {
				blockSize: 36,
				size: 20
			}
		})]
	});
};
CollapsedActions.displayName = "FloatActionsCollapse";
//#endregion
//#region src/react/FloatActions/components/ActionItem.tsx
const ActionItem = ({ item, disabled, onActionClick, groupCollapsed, gap, setGroupCollapsed }) => {
	if (item.type === "collapse") return /* @__PURE__ */ jsx(CollapsedActions, {
		gap,
		groupCollapse: groupCollapsed,
		mode: "default",
		onGroupCollapseChange: setGroupCollapsed,
		children: item.children.map((child, childIndex) => /* @__PURE__ */ jsx(ActionRender, {
			disabled,
			item: child,
			onActionClick
		}, child?.key || `action-${childIndex}`))
	});
	if (item.type === "dropdown") return /* @__PURE__ */ jsx(Dropdown, {
		menu: { items: item.children },
		children: /* @__PURE__ */ jsx(ActionIcon, {
			active: item.active,
			danger: item.danger,
			disabled: disabled || item.loading || item?.disabled,
			icon: item.icon,
			loading: item.loading,
			size: {
				blockSize: 36,
				size: 20
			},
			title: item.label,
			tooltipProps: {
				placement: "top",
				...item.tooltipProps
			}
		})
	}, item.key);
	return /* @__PURE__ */ jsx(ActionRender, {
		disabled,
		item,
		onActionClick
	});
};
ActionItem.displayName = "FloatActionsItem";
//#endregion
//#region src/react/FloatActions/FloatActions.tsx
const FloatActions = ({ gap = 2, disabled, items = [], onActionClick, className, defaultGroupCollapse = false, onGroupCollapseChange, groupCollapse, ...rest }) => {
	const [groupCollapsed, setGroupCollapsed] = useMergeState(defaultGroupCollapse, {
		defaultValue: defaultGroupCollapse,
		onChange: onGroupCollapseChange,
		value: groupCollapse
	});
	return /* @__PURE__ */ jsx(Flexbox, {
		align: "center",
		className: cx(styles$4.container, className),
		flex: 1,
		gap,
		horizontal: true,
		...rest,
		children: items.map((item, index) => /* @__PURE__ */ jsx(ActionItem, {
			disabled,
			gap,
			groupCollapsed,
			item,
			onActionClick,
			setGroupCollapsed
		}, item.key || index))
	});
};
FloatActions.displayName = "FloatActions";
//#endregion
//#region src/react/FloatMenu/style.ts
const styles$3 = createStaticStyles(({ css, cssVar }) => ({
	container: css`
    position: relative;
    overflow: hidden auto;
    background: ${cssVar.colorBgElevated};
  `,
	containerWithMaxHeight: css`
    /* maxHeight is set via inline style as it's dynamic */
  `,
	rootBottom: css`
    position: absolute;
    z-index: 9999;
    inset-block-start: 100%;
    inset-inline-start: 0;

    padding-block-start: 8px;
  `,
	rootTop: css`
    position: absolute;
    inset-block-start: -8px;
    inset-inline-start: 0;
    transform: translateY(-100%);
  `
}));
//#endregion
//#region src/react/FloatMenu/FloatMenu.tsx
const FloatMenu = ({ className, style, getPopupContainer, children, maxHeight = "min(50vh, 640px)", open, placement = "top", styles: customStyles, classNames }) => {
	const parent = getPopupContainer();
	if (!parent) return;
	if (!open) return;
	return createPortal(/* @__PURE__ */ jsx(Flexbox, {
		className: cx(placement === "bottom" ? styles$3.rootBottom : styles$3.rootTop, classNames?.root),
		paddingInline: 8,
		style: customStyles?.root,
		width: "100%",
		children: /* @__PURE__ */ jsx(Block, {
			className: cx(styles$3.container, className, classNames?.container),
			shadow: true,
			style: {
				maxHeight,
				...style,
				...customStyles?.container
			},
			variant: "outlined",
			children
		})
	}), parent);
};
FloatMenu.displayName = "FloatMenu";
//#endregion
//#region src/react/SendButton/components/SendIcon.tsx
const styles$2 = createStaticStyles(({ css }) => ({ icon: css`
    flex: none;
    line-height: 1;
  ` }));
const SendIcon = ({ size = "1em", style }) => {
	return /* @__PURE__ */ jsx("svg", {
		className: cx("anticon", styles$2.icon),
		fill: "currentColor",
		fillRule: "evenodd",
		height: size,
		style,
		viewBox: "0 0 14 14",
		width: size,
		xmlns: "http://www.w3.org/2000/svg",
		children: /* @__PURE__ */ jsx("path", { d: "M.743 3.773c-.818-.555-.422-1.834.567-1.828l11.496.074a1 1 0 01.837 1.538l-6.189 9.689c-.532.833-1.822.47-1.842-.518L5.525 8.51a1 1 0 01.522-.9l1.263-.686a.808.808 0 00-.772-1.42l-1.263.686a1 1 0 01-1.039-.051L.743 3.773z" })
	});
};
//#endregion
//#region src/react/SendButton/components/StopIcon.tsx
const styles$1 = createStaticStyles(({ css }) => ({ icon: css`
    flex: none;
    line-height: 1;
  ` }));
const StopIcon = ({ size = "1.5em", style }) => {
	return /* @__PURE__ */ jsx("svg", {
		className: cx("anticon", styles$1.icon),
		color: "currentColor",
		height: size,
		style,
		viewBox: "0 0 1024 1024",
		width: size,
		xmlns: "http://www.w3.org/2000/svg",
		children: /* @__PURE__ */ jsxs("g", {
			fill: "none",
			children: [
				/* @__PURE__ */ jsx("circle", {
					cx: "512",
					cy: "512",
					fill: "none",
					r: "426",
					stroke: cssVar.colorBorder,
					strokeWidth: "72"
				}),
				/* @__PURE__ */ jsx("rect", {
					fill: "currentColor",
					height: "252",
					rx: "24",
					ry: "24",
					width: "252",
					x: "386",
					y: "386"
				}),
				/* @__PURE__ */ jsx("path", {
					d: "M938.667 512C938.667 276.359 747.64 85.333 512 85.333",
					stroke: "currentColor",
					strokeLinecap: "round",
					strokeWidth: "73",
					children: /* @__PURE__ */ jsx("animateTransform", {
						attributeName: "transform",
						dur: "1s",
						from: "0 512 512",
						repeatCount: "indefinite",
						to: "360 512 512",
						type: "rotate"
					})
				})
			]
		})
	});
};
//#endregion
//#region src/react/SendButton/style.ts
const prefixCls = "ant";
const styles = createStaticStyles(({ css, cssVar }) => ({
	button: css`
    &.${prefixCls}-btn {
      flex: none;
      width: var(--send-button-size, 32px) !important;
      height: var(--send-button-size, 32px);
      padding-inline: 0 !important;
    }
  `,
	disabled: css`
    &.${prefixCls}-btn {
      cursor: default;
      border-color: ${cssVar.colorBorderSecondary};
      background: transparent;
    }

    .${prefixCls}-btn-compact-first-item {
      cursor: default;
      border-color: ${cssVar.colorBorderSecondary};
      background: transparent;
    }
    .${prefixCls}-dropdown-trigger {
      cursor: default;
      border-color: ${cssVar.colorBorderSecondary};
      border-inline-start-color: transparent;
      background: transparent;
    }
  `,
	dropdownButton: css`
    flex: none;
    width: fit-content;
    .${prefixCls}-btn {
      width: calc(var(--send-button-size, 32px) * 1.2);
      height: var(--send-button-size, 32px);
    }
    .${prefixCls}-dropdown-trigger {
      width: calc(var(--send-button-size, 32px) * 0.8);
      &.${prefixCls}-btn-primary {
        &::before {
          background-color: color-mix(in srgb, ${cssVar.colorBgLayout} 10%, transparent) !important;
        }
      }
    }
  `,
	dropdownButtonRound: css`
    .${prefixCls}-btn-compact-first-item {
      border-start-start-radius: calc(var(--send-button-size, 32px) / 2);
      border-end-start-radius: calc(var(--send-button-size, 32px) / 2);
    }
    .${prefixCls}-dropdown-trigger {
      width: var(--send-button-size, 32px);
      border-start-end-radius: calc(var(--send-button-size, 32px) / 2);
      border-end-end-radius: calc(var(--send-button-size, 32px) / 2);
    }
  `,
	loadingButton: css`
    &.${prefixCls}-btn {
      flex: none;
      height: var(--send-button-size, 32px);
      padding-inline: 0 !important;
    }
  `
}));
//#endregion
//#region src/react/SendButton/SendButton.tsx
const SendButton = ({ type = "primary", menu, className, style, loading, generating, size = 32, shape, onSend, onStop, disabled, onClick, ...rest }) => {
	const cssVariables = useMemo(() => ({ "--send-button-size": `${size}px` }), [size]);
	if (generating) return /* @__PURE__ */ jsx(Button, {
		className: cx(styles.loadingButton, className),
		onClick: (e) => {
			e.stopPropagation();
			e.preventDefault();
			if (onStop) onStop(e);
			if (onClick) onClick(e);
		},
		shape,
		style: {
			...cssVariables,
			...style,
			width: menu ? size * 2 : size
		},
		...rest,
		children: /* @__PURE__ */ jsx(StopIcon, { size: size * .75 })
	});
	if (loading) return /* @__PURE__ */ jsx(Button, {
		className: cx(styles.loadingButton, className),
		disabled: true,
		loading,
		shape,
		style: {
			...cssVariables,
			...style,
			width: menu ? size * 2 : size
		},
		type,
		...rest
	});
	if (!menu) return /* @__PURE__ */ jsx(Button, {
		className: cx(styles.button, disabled && styles.disabled, className),
		disabled,
		icon: /* @__PURE__ */ jsx(SendIcon, {}),
		onClick: (e) => {
			e.stopPropagation();
			e.preventDefault();
			if (onSend) onSend(e);
			if (onClick) onClick(e);
		},
		shape,
		style: {
			...cssVariables,
			...style
		},
		type,
		...rest
	});
	return /* @__PURE__ */ jsxs(Space.Compact, {
		className: cx(styles.dropdownButton, disabled && styles.disabled, shape === "round" && styles.dropdownButtonRound, className),
		style: {
			...cssVariables,
			...style
		},
		...rest,
		children: [/* @__PURE__ */ jsx(Button, {
			className: cx(styles.button, disabled && styles.disabled, className),
			disabled,
			icon: /* @__PURE__ */ jsx(SendIcon, {}),
			onClick: (e) => {
				e.stopPropagation();
				e.preventDefault();
				if (onSend) onSend(e);
				if (onClick) onClick(e);
			},
			shape,
			style: {
				...cssVariables,
				...style
			},
			type,
			...rest
		}), /* @__PURE__ */ jsx(Dropdown$1, {
			menu,
			placement: "topRight",
			...rest,
			children: /* @__PURE__ */ jsx(Button, {
				className: cx(styles.button, disabled && styles.disabled, className),
				disabled,
				icon: /* @__PURE__ */ jsx(Icon, { icon: ChevronDownIcon }),
				shape,
				style: {
					...cssVariables,
					cursor: "pointer"
				},
				type
			})
		})]
	});
};
SendButton.displayName = "SendButton";
//#endregion
//#region src/react/SlashMenu/SlashMenu.tsx
const SlashMenu = ({ options, activeKey, loading, onSelect, classNames, styles: customStyles, menuProps, ...floatMenuProps }) => {
	const handleMenuClick = useCallback(({ key }) => {
		if (!onSelect) return;
		const option = options.find((item) => "key" in item && item.key === key);
		if (option) onSelect?.(option);
	}, [options, onSelect]);
	return /* @__PURE__ */ jsx(FloatMenu, {
		classNames: {
			container: classNames?.container,
			root: classNames?.root
		},
		styles: {
			container: customStyles?.container,
			root: customStyles?.root
		},
		...floatMenuProps,
		children: /* @__PURE__ */ jsx(Menu, {
			className: classNames?.menu,
			items: loading ? [{
				disabled: true,
				key: "loading",
				label: "Loading..."
			}] : options,
			mode: "inline",
			onClick: handleMenuClick,
			selectedKeys: activeKey ? [activeKey] : void 0,
			style: customStyles?.menu,
			...menuProps
		})
	});
};
SlashMenu.displayName = "SlashMenu";
//#endregion
export { ChatInput, ChatInputActionBar, ChatInputActions, CodeLanguageSelect, ColorPickerBtn, Editor, EditorProvider, FloatActions, FloatMenu, SendButton, SlashMenu, useEditor, useEditorContent, useEditorLocale, useEditorState, withProps };
