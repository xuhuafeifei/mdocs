import { c as sanitizeMeta2dData, i as createEmptyMeta2dData, o as normalizeMeta2dData, s as normalizeMeta2dPen } from "./meta2dLight-JnDieCPZ.js";
import { t as useEditorLocale } from "./useEditorLocale-D19_9zmS.js";
import { ensureMeta2dShapes, generateSvgFromDiagram, generateSvgFromMeta2d } from "./meta2dEngine-BD2XbzaV.js";
import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Meta2d } from "@meta2d/core";
//#region src/plugins/meta2d/react/diagram-pens.ts
const GROUP_LOCALE_MAP = {
	"Activity": "meta2d.palette.groups.activity",
	"Basic": "meta2d.palette.groups.basic",
	"Fault tree": "meta2d.palette.groups.faultTree",
	"Flow": "meta2d.palette.groups.flow",
	"Sequence & class": "meta2d.palette.groups.sequenceClass"
};
/** Derive the palette-item label locale key from the item key. */
function itemLabelLocaleKey(key) {
	return `meta2d.palette.${key}`;
}
const baseShape = {
	background: "#fff",
	color: "#1f1f1f",
	height: 60,
	lineWidth: 1,
	textColor: "#1f1f1f",
	width: 120
};
function getPalette() {
	return [
		{
			group: "Basic",
			key: "square",
			label: "Square",
			pen: {
				...baseShape,
				height: 100,
				name: "square",
				text: "",
				width: 100
			}
		},
		{
			group: "Basic",
			key: "rect",
			label: "Rectangle",
			pen: {
				...baseShape,
				name: "rectangle",
				text: "Rectangle"
			}
		},
		{
			group: "Basic",
			key: "roundRect",
			label: "Rounded",
			pen: {
				...baseShape,
				borderRadius: .2,
				name: "rectangle",
				text: "Rounded"
			}
		},
		{
			group: "Basic",
			key: "circle",
			label: "Circle",
			pen: {
				...baseShape,
				height: 80,
				name: "circle",
				text: "Circle",
				width: 80
			}
		},
		{
			group: "Basic",
			key: "triangle",
			label: "Triangle",
			pen: {
				...baseShape,
				height: 90,
				name: "triangle",
				text: "Triangle",
				width: 100
			}
		},
		{
			group: "Basic",
			key: "diamond",
			label: "Diamond",
			pen: {
				...baseShape,
				height: 100,
				name: "diamond",
				text: "Decision",
				width: 100
			}
		},
		{
			group: "Basic",
			key: "pentagon",
			label: "Pentagon",
			pen: {
				...baseShape,
				height: 100,
				name: "pentagon",
				text: "Pentagon",
				width: 100
			}
		},
		{
			group: "Basic",
			key: "hexagon",
			label: "Hexagon",
			pen: {
				...baseShape,
				height: 100,
				name: "hexagon",
				text: "Hexagon",
				width: 100
			}
		},
		{
			group: "Basic",
			key: "pentagram",
			label: "Star",
			pen: {
				...baseShape,
				height: 100,
				name: "pentagram",
				text: "",
				width: 100
			}
		},
		{
			group: "Basic",
			key: "leftArrow",
			label: "Left arrow",
			pen: {
				height: 60,
				name: "leftArrow",
				width: 120
			}
		},
		{
			group: "Basic",
			key: "rightArrow",
			label: "Right arrow",
			pen: {
				height: 60,
				name: "rightArrow",
				width: 120
			}
		},
		{
			group: "Basic",
			key: "twowayArrow",
			label: "Two-way",
			pen: {
				height: 60,
				name: "twowayArrow",
				width: 150
			}
		},
		{
			group: "Basic",
			key: "cloud",
			label: "Cloud",
			pen: {
				height: 100,
				name: "cloud",
				width: 100
			}
		},
		{
			group: "Basic",
			key: "message",
			label: "Message",
			pen: {
				height: 100,
				name: "message",
				textTop: -.1,
				width: 100
			}
		},
		{
			group: "Basic",
			key: "file",
			label: "File",
			pen: {
				height: 100,
				name: "file",
				width: 80
			}
		},
		{
			group: "Basic",
			key: "cube",
			label: "Cube",
			pen: {
				height: 100,
				name: "cube",
				width: 60,
				z: .25
			}
		},
		{
			group: "Basic",
			key: "people",
			label: "Actor",
			pen: {
				height: 100,
				name: "people",
				width: 70
			}
		},
		{
			group: "Basic",
			key: "text",
			label: "Text",
			pen: {
				...baseShape,
				background: "transparent",
				color: "transparent",
				height: 32,
				name: "text",
				text: "text",
				width: 120
			}
		},
		{
			group: "Basic",
			key: "line",
			label: "Line",
			pen: {
				color: "#1f1f1f",
				height: 1,
				lineWidth: 1,
				name: "line",
				width: 160
			}
		},
		{
			group: "Flow",
			key: "flowTerminal",
			label: "Terminal",
			pen: {
				...baseShape,
				borderRadius: .5,
				height: 40,
				name: "rectangle",
				text: "Start / End",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowProcess",
			label: "Process",
			pen: {
				...baseShape,
				height: 40,
				name: "rectangle",
				text: "Process",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowDecision",
			label: "Decision",
			pen: {
				...baseShape,
				height: 60,
				name: "diamond",
				text: "Decision",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowData",
			label: "Data",
			pen: {
				...baseShape,
				name: "flowData",
				offsetX: .14,
				text: "Data"
			}
		},
		{
			group: "Flow",
			key: "flowPrepare",
			label: "Prepare",
			pen: {
				...baseShape,
				height: 50,
				name: "hexagon",
				text: "Prepare",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowSubprocess",
			label: "Subprocess",
			pen: {
				...baseShape,
				height: 50,
				name: "flowSubprocess",
				text: "Subprocess",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowDb",
			label: "Database",
			pen: {
				...baseShape,
				height: 100,
				name: "flowDb",
				text: "DB",
				width: 80
			}
		},
		{
			group: "Flow",
			key: "flowDocument",
			label: "Document",
			pen: {
				...baseShape,
				height: 100,
				name: "flowDocument",
				text: "Document",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowInternalStorage",
			label: "Int. storage",
			pen: {
				...baseShape,
				height: 80,
				name: "flowInternalStorage",
				text: "Internal",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowExternStorage",
			label: "Ext. storage",
			pen: {
				...baseShape,
				height: 80,
				name: "flowExternStorage",
				text: "External",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowQueue",
			label: "Queue",
			pen: {
				...baseShape,
				height: 100,
				name: "flowQueue",
				text: "Queue",
				width: 100
			}
		},
		{
			group: "Flow",
			key: "flowManually",
			label: "Manual input",
			pen: {
				...baseShape,
				height: 80,
				name: "flowManually",
				text: "Manual",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowDisplay",
			label: "Display",
			pen: {
				...baseShape,
				height: 80,
				name: "flowDisplay",
				text: "Display",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowParallel",
			label: "Parallel",
			pen: {
				...baseShape,
				height: 50,
				name: "flowParallel",
				text: "Parallel",
				width: 120
			}
		},
		{
			group: "Flow",
			key: "flowComment",
			label: "Comment",
			pen: {
				...baseShape,
				height: 100,
				name: "flowComment",
				text: "Note",
				width: 100
			}
		},
		{
			group: "Activity",
			key: "actStart",
			label: "Start",
			pen: {
				background: "#555",
				height: 30,
				lineWidth: 0,
				name: "circle",
				text: "",
				width: 30
			}
		},
		{
			group: "Activity",
			key: "actFinal",
			label: "Final",
			pen: {
				height: 30,
				name: "activityFinal",
				width: 30
			}
		},
		{
			group: "Activity",
			key: "actStep",
			label: "Action",
			pen: {
				...baseShape,
				borderRadius: .25,
				height: 50,
				name: "rectangle",
				text: "Action",
				width: 120
			}
		},
		{
			group: "Activity",
			key: "actMerge",
			label: "Merge",
			pen: {
				...baseShape,
				height: 50,
				name: "diamond",
				text: "Merge",
				width: 120
			}
		},
		{
			group: "Activity",
			key: "swimlaneV",
			label: "Swimlane V",
			pen: {
				height: 500,
				lineTop: .08,
				name: "swimlaneV",
				text: "Swimlane",
				textBaseline: "top",
				textTop: 20,
				width: 200
			}
		},
		{
			group: "Activity",
			key: "swimlaneH",
			label: "Swimlane H",
			pen: {
				height: 200,
				lineLeft: .08,
				name: "swimlaneH",
				text: "Swimlane",
				textAlign: "left",
				textLeft: .04,
				textWidth: .01,
				width: 500
			}
		},
		{
			group: "Activity",
			key: "forkV",
			label: "Fork V",
			pen: {
				fillStyle: "#555",
				height: 150,
				name: "forkV",
				strokeStyle: "transparent",
				text: "",
				width: 10
			}
		},
		{
			group: "Activity",
			key: "forkH",
			label: "Fork H",
			pen: {
				fillStyle: "#555",
				height: 10,
				name: "forkH",
				strokeStyle: "transparent",
				text: "",
				width: 150
			}
		},
		{
			group: "Sequence & class",
			key: "lifeline",
			label: "Lifeline",
			pen: {
				height: 400,
				name: "lifeline",
				text: "Object",
				textHeight: 50,
				width: 150
			}
		},
		{
			group: "Sequence & class",
			key: "sequenceFocus",
			label: "Activation",
			pen: {
				height: 200,
				name: "sequenceFocus",
				text: "",
				width: 12
			}
		},
		{
			group: "Sequence & class",
			key: "simpleClass",
			label: "Simple class",
			pen: {
				height: 200,
				list: [{ text: "- name: string\n+ setName(name: string): void" }],
				name: "simpleClass",
				text: "ClassName",
				textAlign: "center",
				textBaseline: "top",
				textHeight: 200,
				textTop: 10,
				width: 270
			}
		},
		{
			group: "Sequence & class",
			key: "interfaceClass",
			label: "Class",
			pen: {
				height: 200,
				list: [{ text: "- name: string" }, { text: "+ setName(name: string): void" }],
				name: "interfaceClass",
				text: "ClassName",
				textAlign: "center",
				textBaseline: "top",
				textHeight: 200,
				textTop: 10,
				width: 270
			}
		},
		{
			group: "Fault tree",
			key: "andGate",
			label: "AND gate",
			pen: {
				height: 150,
				name: "andGate",
				width: 100
			}
		},
		{
			group: "Fault tree",
			key: "orGate",
			label: "OR gate",
			pen: {
				height: 150,
				name: "orGate",
				width: 100
			}
		},
		{
			group: "Fault tree",
			key: "basicEvent",
			label: "Basic event",
			pen: {
				height: 150,
				name: "basicEvent",
				width: 100
			}
		},
		{
			group: "Fault tree",
			key: "xorGate",
			label: "XOR gate",
			pen: {
				height: 150,
				name: "xorGate",
				width: 100
			}
		},
		{
			group: "Fault tree",
			key: "votingGate",
			label: "Voting gate",
			pen: {
				height: 150,
				name: "votingGate",
				width: 100
			}
		}
	];
}
//#endregion
//#region src/plugins/meta2d/react/DiagramPalette.tsx
function clonePen(pen) {
	return normalizeMeta2dPen(structuredClone(pen));
}
function groupPalette(items) {
	const map = /* @__PURE__ */ new Map();
	for (const item of items) {
		const list = map.get(item.group) ?? [];
		list.push(item);
		map.set(item.group, list);
	}
	return Array.from(map.entries());
}
function ShapePreview({ name }) {
	const common = {
		fill: "#fff",
		stroke: "#1f1f1f",
		strokeWidth: 1.2
	};
	if (name === "circle") return /* @__PURE__ */ jsx("svg", {
		height: "24",
		viewBox: "0 0 28 28",
		width: "24",
		children: /* @__PURE__ */ jsx("circle", {
			cx: "14",
			cy: "14",
			r: "10",
			...common
		})
	});
	if (name === "diamond") return /* @__PURE__ */ jsx("svg", {
		height: "24",
		viewBox: "0 0 28 28",
		width: "24",
		children: /* @__PURE__ */ jsx("polygon", {
			points: "14,3 25,14 14,25 3,14",
			...common
		})
	});
	if (name === "triangle") return /* @__PURE__ */ jsx("svg", {
		height: "24",
		viewBox: "0 0 28 28",
		width: "24",
		children: /* @__PURE__ */ jsx("polygon", {
			points: "14,4 25,24 3,24",
			...common
		})
	});
	if (name === "pentagon") return /* @__PURE__ */ jsx("svg", {
		height: "24",
		viewBox: "0 0 28 28",
		width: "24",
		children: /* @__PURE__ */ jsx("polygon", {
			points: "14,3 25,12 21,25 7,25 3,12",
			...common
		})
	});
	if (name === "hexagon") return /* @__PURE__ */ jsx("svg", {
		height: "24",
		viewBox: "0 0 28 28",
		width: "24",
		children: /* @__PURE__ */ jsx("polygon", {
			points: "8,4 20,4 25,14 20,24 8,24 3,14",
			...common
		})
	});
	if (name === "pentagram") return /* @__PURE__ */ jsx("svg", {
		height: "24",
		viewBox: "0 0 28 28",
		width: "24",
		children: /* @__PURE__ */ jsx("polygon", {
			points: "14,3 17,11 26,11 18,16 21,25 14,20 7,25 10,16 2,11 11,11",
			...common
		})
	});
	if (name === "line") return /* @__PURE__ */ jsx("svg", {
		height: "24",
		viewBox: "0 0 28 28",
		width: "24",
		children: /* @__PURE__ */ jsx("line", {
			x1: "4",
			x2: "24",
			y1: "14",
			y2: "14",
			...common
		})
	});
	if (name === "text") return /* @__PURE__ */ jsx("svg", {
		height: "24",
		viewBox: "0 0 28 28",
		width: "24",
		children: /* @__PURE__ */ jsx("text", {
			dominantBaseline: "middle",
			fill: "#1f1f1f",
			fontSize: "14",
			textAnchor: "middle",
			x: "14",
			y: "15",
			children: "T"
		})
	});
	return /* @__PURE__ */ jsx("svg", {
		height: "24",
		viewBox: "0 0 28 28",
		width: "24",
		children: /* @__PURE__ */ jsx("rect", {
			height: "14",
			rx: "2",
			width: "20",
			x: "4",
			y: "7",
			...common
		})
	});
}
function PaletteTile({ disabled, engineRef, item, t }) {
	const addOnClick = () => {
		const engine = engineRef.current;
		if (!engine || disabled) return;
		try {
			engine.canvas.addCaches = [clonePen(item.pen)];
		} catch {}
	};
	return /* @__PURE__ */ jsxs("div", {
		draggable: !disabled,
		onClick: (event) => {
			event.stopPropagation();
			addOnClick();
		},
		onDragStart: (event) => {
			if (disabled) {
				event.preventDefault();
				return;
			}
			const payload = JSON.stringify(clonePen(item.pen));
			event.dataTransfer.setData("Meta2d", payload);
			event.dataTransfer.setData("Text", payload);
			event.dataTransfer.effectAllowed = "copy";
		},
		onKeyDown: (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				addOnClick();
			}
		},
		role: "button",
		style: {
			alignItems: "center",
			border: "1px solid #efefef",
			borderRadius: 6,
			cursor: disabled ? "not-allowed" : "grab",
			display: "flex",
			flexDirection: "column",
			gap: 4,
			justifyContent: "center",
			minHeight: 56,
			opacity: disabled ? .5 : 1,
			outline: "none",
			padding: 6
		},
		tabIndex: disabled ? -1 : 0,
		title: `${t(itemLabelLocaleKey(item.key)) || item.label} — drag or click to add`,
		children: [/* @__PURE__ */ jsx(ShapePreview, { name: String(item.pen.name ?? "rectangle") }), /* @__PURE__ */ jsx("span", {
			style: { fontSize: 11 },
			children: t(itemLabelLocaleKey(item.key)) || item.label
		})]
	});
}
function DiagramPalette({ disabled, engineRef }) {
	const { t } = useEditorLocale();
	const groups = useMemo(() => groupPalette(getPalette()), []);
	return /* @__PURE__ */ jsxs("aside", {
		style: {
			borderRight: "1px solid #f0f0f0",
			flexShrink: 0,
			maxHeight: "100%",
			overflowX: "hidden",
			overflowY: "auto",
			overscrollBehavior: "contain",
			padding: 12,
			touchAction: "pan-y",
			width: 240
		},
		children: [
			/* @__PURE__ */ jsx("div", {
				style: {
					fontSize: 13,
					fontWeight: 600,
					marginBottom: 4
				},
				children: t("meta2d.palette.title")
			}),
			/* @__PURE__ */ jsx("div", {
				style: {
					color: "#8c8c8c",
					fontSize: 12,
					marginBottom: 12
				},
				children: t("meta2d.palette.hint")
			}),
			groups.map(([group, items]) => /* @__PURE__ */ jsxs("div", {
				style: { marginBottom: 12 },
				children: [/* @__PURE__ */ jsx("div", {
					style: {
						color: "#8c8c8c",
						fontSize: 12,
						marginBottom: 6
					},
					children: t(GROUP_LOCALE_MAP[group] || group)
				}), /* @__PURE__ */ jsx("div", {
					style: {
						display: "grid",
						gap: 8,
						gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
					},
					children: items.map((item) => /* @__PURE__ */ jsx(PaletteTile, {
						disabled,
						engineRef,
						item,
						t
					}, item.key))
				})]
			}, group))
		]
	});
}
//#endregion
//#region src/plugins/meta2d/react/PenProps.tsx
const panelStyle = {
	borderLeft: "1px solid #f0f0f0",
	flexShrink: 0,
	maxHeight: "100%",
	overflowX: "hidden",
	overflowY: "auto",
	overscrollBehavior: "contain",
	touchAction: "pan-y",
	width: 220
};
const labelStyle = {
	color: "#8c8c8c",
	fontSize: 12,
	marginBottom: 4
};
const sectionStyle = {
	borderBottom: "1px solid #f0f0f0",
	padding: "10px 12px"
};
const rowStyle = {
	alignItems: "center",
	display: "flex",
	gap: 6,
	marginBottom: 6
};
const inputStyle = {
	background: "#fafafa",
	border: "1px solid #e5e5e5",
	borderRadius: 4,
	fontSize: 12,
	height: 28,
	outline: "none",
	padding: "0 6px"
};
const fieldLabel = {
	color: "#8c8c8c",
	fontSize: 11,
	minWidth: 22
};
const layerBtn = {
	background: "#fff",
	border: "1px solid #d9d9d9",
	borderRadius: 4,
	cursor: "pointer",
	fontSize: 11,
	minWidth: 48,
	padding: "4px 8px"
};
const TEXT_DEBOUNCE_MS = 120;
function PenProps({ engine }) {
	const { t } = useEditorLocale();
	const [pen, setPen] = useState(null);
	const [rect, setRect] = useState(null);
	/** Local draft so typing stays snappy; canvas updates are debounced. */
	const [textDraft, setTextDraft] = useState("");
	const textTimerRef = useRef(null);
	const penIdRef = useRef(null);
	const flushTextToEngine = useCallback((penId, value) => {
		if (!engine || penId === null || penId === void 0) return;
		engine.setValue({
			id: penId,
			text: value
		}, { render: true });
	}, [engine]);
	const selectHandler = useCallback((pens) => {
		if (!pens || pens.length !== 1) {
			if (textTimerRef.current) {
				clearTimeout(textTimerRef.current);
				textTimerRef.current = null;
			}
			setPen(null);
			setRect(null);
			setTextDraft("");
			penIdRef.current = null;
			return;
		}
		const p = pens[0];
		if (p.globalAlpha === null || p.globalAlpha === void 0) p.globalAlpha = 1;
		if (p.id !== penIdRef.current) {
			if (textTimerRef.current) {
				clearTimeout(textTimerRef.current);
				textTimerRef.current = null;
			}
			penIdRef.current = p.id;
			setTextDraft(p.text ?? "");
		}
		setPen(p);
		if (engine) try {
			setRect(engine.getPenRect(p));
		} catch {
			setRect(null);
		}
	}, [engine]);
	const inactiveHandler = useCallback(() => {
		if (textTimerRef.current) {
			clearTimeout(textTimerRef.current);
			textTimerRef.current = null;
		}
		setPen(null);
		setRect(null);
		setTextDraft("");
		penIdRef.current = null;
	}, []);
	useEffect(() => {
		if (!engine) return;
		engine.on("active", selectHandler);
		engine.on("inactive", inactiveHandler);
		return () => {
			engine.off("active", selectHandler);
			engine.off("inactive", inactiveHandler);
			if (textTimerRef.current) {
				clearTimeout(textTimerRef.current);
				textTimerRef.current = null;
			}
		};
	}, [
		engine,
		selectHandler,
		inactiveHandler
	]);
	if (!pen || !engine) return /* @__PURE__ */ jsx("aside", {
		style: panelStyle,
		children: /* @__PURE__ */ jsx("div", {
			style: {
				color: "#bbb",
				fontSize: 12,
				padding: 16,
				textAlign: "center"
			},
			children: t("meta2d.props.empty")
		})
	});
	const changeValue = (prop, value) => {
		const v = { id: pen.id };
		v[prop] = value;
		if (prop === "dash") v.lineDash = [void 0, [5, 5]][value];
		if (prop !== "text") setPen((prev) => prev ? {
			...prev,
			...v
		} : prev);
		engine.setValue(v, { render: true });
	};
	const changeText = (value) => {
		setTextDraft(value);
		const penId = pen.id;
		if (textTimerRef.current) clearTimeout(textTimerRef.current);
		textTimerRef.current = setTimeout(() => {
			textTimerRef.current = null;
			flushTextToEngine(penId, value);
		}, TEXT_DEBOUNCE_MS);
	};
	const commitText = () => {
		if (textTimerRef.current) {
			clearTimeout(textTimerRef.current);
			textTimerRef.current = null;
		}
		flushTextToEngine(pen.id, textDraft);
	};
	const changeRect = (prop, value) => {
		if (!rect) return;
		const updated = { id: pen.id };
		updated[prop] = value;
		engine.setValue(updated, { render: true });
		setRect((r) => r ? {
			...r,
			[prop]: value
		} : null);
	};
	const changeLayer = (fn) => {
		fn(engine);
		engine.render(true);
	};
	return /* @__PURE__ */ jsxs("aside", {
		style: panelStyle,
		children: [
			/* @__PURE__ */ jsxs("div", {
				style: sectionStyle,
				children: [/* @__PURE__ */ jsx("div", {
					style: labelStyle,
					children: t("meta2d.props.text")
				}), /* @__PURE__ */ jsx("div", {
					style: rowStyle,
					children: /* @__PURE__ */ jsx("input", {
						onBlur: commitText,
						onChange: (e) => changeText(e.target.value),
						onKeyDown: (e) => {
							e.stopPropagation();
							if (e.key === "Enter") {
								e.preventDefault();
								e.target.blur();
							}
						},
						style: {
							...inputStyle,
							flex: 1,
							width: "100%"
						},
						type: "text",
						value: textDraft
					})
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				style: sectionStyle,
				children: [
					/* @__PURE__ */ jsx("div", {
						style: {
							...labelStyle,
							marginBottom: 6
						},
						children: t("meta2d.props.appearance")
					}),
					/* @__PURE__ */ jsxs("div", {
						style: rowStyle,
						children: [/* @__PURE__ */ jsx("span", {
							style: fieldLabel,
							children: t("meta2d.props.color")
						}), /* @__PURE__ */ jsx("input", {
							onChange: (e) => changeValue("color", e.target.value),
							style: {
								...inputStyle,
								flex: 1
							},
							type: "color",
							value: pen.color || "#1f1f1f"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						style: rowStyle,
						children: [/* @__PURE__ */ jsx("span", {
							style: fieldLabel,
							children: t("meta2d.props.bg")
						}), /* @__PURE__ */ jsx("input", {
							onChange: (e) => changeValue("background", e.target.value),
							style: {
								...inputStyle,
								flex: 1
							},
							type: "color",
							value: pen.background || "#ffffff"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						style: rowStyle,
						children: [/* @__PURE__ */ jsx("span", {
							style: fieldLabel,
							children: t("meta2d.props.dash")
						}), /* @__PURE__ */ jsxs("select", {
							onChange: (e) => changeValue("dash", Number(e.target.value)),
							style: {
								...inputStyle,
								flex: 1
							},
							value: String(pen.dash ?? 0),
							children: [/* @__PURE__ */ jsx("option", {
								value: "0",
								children: t("meta2d.props.solid")
							}), /* @__PURE__ */ jsx("option", {
								value: "1",
								children: t("meta2d.props.dashLine")
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						style: rowStyle,
						children: [
							/* @__PURE__ */ jsx("span", {
								style: fieldLabel,
								children: t("meta2d.props.radius")
							}),
							/* @__PURE__ */ jsx("input", {
								max: 1,
								min: 0,
								onChange: (e) => changeValue("borderRadius", Number(e.target.value)),
								step: .01,
								style: {
									...inputStyle,
									flex: 1
								},
								type: "range",
								value: String(pen.borderRadius ?? 0)
							}),
							/* @__PURE__ */ jsx("span", {
								style: {
									color: "#8c8c8c",
									fontSize: 11,
									width: 32
								},
								children: pen.borderRadius ?? 0
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						style: rowStyle,
						children: [
							/* @__PURE__ */ jsx("span", {
								style: fieldLabel,
								children: t("meta2d.props.alpha")
							}),
							/* @__PURE__ */ jsx("input", {
								max: 1,
								min: 0,
								onChange: (e) => changeValue("globalAlpha", Number(e.target.value)),
								step: .01,
								style: {
									...inputStyle,
									flex: 1
								},
								type: "range",
								value: String(pen.globalAlpha ?? 1)
							}),
							/* @__PURE__ */ jsx("span", {
								style: {
									color: "#8c8c8c",
									fontSize: 11,
									width: 32
								},
								children: (pen.globalAlpha ?? 1).toFixed(2)
							})
						]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				style: sectionStyle,
				children: [/* @__PURE__ */ jsx("div", {
					style: {
						...labelStyle,
						marginBottom: 6
					},
					children: t("meta2d.props.position")
				}), [
					["X", "x"],
					["Y", "y"],
					["W", "width"],
					["H", "height"]
				].map(([label, key]) => /* @__PURE__ */ jsxs("div", {
					style: rowStyle,
					children: [/* @__PURE__ */ jsx("span", {
						style: fieldLabel,
						children: label
					}), /* @__PURE__ */ jsx("input", {
						onChange: (e) => changeRect(key, Number(e.target.value)),
						style: {
							...inputStyle,
							flex: 1
						},
						type: "number",
						value: rect ? rect[key] : 0
					})]
				}, key))]
			}),
			/* @__PURE__ */ jsxs("div", {
				style: sectionStyle,
				children: [
					/* @__PURE__ */ jsx("div", {
						style: {
							...labelStyle,
							marginBottom: 6
						},
						children: t("meta2d.props.textAlign")
					}),
					/* @__PURE__ */ jsxs("div", {
						style: rowStyle,
						children: [/* @__PURE__ */ jsx("span", {
							style: fieldLabel,
							children: t("meta2d.props.h")
						}), /* @__PURE__ */ jsxs("select", {
							onChange: (e) => changeValue("textAlign", e.target.value),
							style: {
								...inputStyle,
								flex: 1
							},
							value: pen.textAlign || "center",
							children: [
								/* @__PURE__ */ jsx("option", {
									value: "left",
									children: t("meta2d.props.left")
								}),
								/* @__PURE__ */ jsx("option", {
									value: "center",
									children: t("meta2d.props.center")
								}),
								/* @__PURE__ */ jsx("option", {
									value: "right",
									children: t("meta2d.props.right")
								})
							]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						style: rowStyle,
						children: [/* @__PURE__ */ jsx("span", {
							style: fieldLabel,
							children: t("meta2d.props.v")
						}), /* @__PURE__ */ jsxs("select", {
							onChange: (e) => changeValue("textBaseline", e.target.value),
							style: {
								...inputStyle,
								flex: 1
							},
							value: pen.textBaseline || "middle",
							children: [
								/* @__PURE__ */ jsx("option", {
									value: "top",
									children: t("meta2d.props.topAlign")
								}),
								/* @__PURE__ */ jsx("option", {
									value: "middle",
									children: t("meta2d.props.middle")
								}),
								/* @__PURE__ */ jsx("option", {
									value: "bottom",
									children: t("meta2d.props.bottomAlign")
								})
							]
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				style: sectionStyle,
				children: [/* @__PURE__ */ jsx("div", {
					style: {
						...labelStyle,
						marginBottom: 6
					},
					children: t("meta2d.props.layer")
				}), /* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						flexWrap: "wrap",
						gap: 4
					},
					children: [
						/* @__PURE__ */ jsx("button", {
							onClick: () => changeLayer((m) => m.top()),
							style: layerBtn,
							type: "button",
							children: t("meta2d.props.top")
						}),
						/* @__PURE__ */ jsx("button", {
							onClick: () => changeLayer((m) => m.up()),
							style: layerBtn,
							type: "button",
							children: t("meta2d.props.up")
						}),
						/* @__PURE__ */ jsx("button", {
							onClick: () => changeLayer((m) => m.down()),
							style: layerBtn,
							type: "button",
							children: t("meta2d.props.down")
						}),
						/* @__PURE__ */ jsx("button", {
							onClick: () => changeLayer((m) => m.bottom()),
							style: layerBtn,
							type: "button",
							children: t("meta2d.props.bottom")
						})
					]
				})]
			})
		]
	});
}
//#endregion
//#region src/plugins/meta2d/react/DiagramEditor.tsx
const buttonStyle = {
	background: "#fff",
	border: "1px solid #d9d9d9",
	borderRadius: 6,
	cursor: "pointer",
	minWidth: 68,
	padding: "6px 12px"
};
const toolBtnStyle = {
	...buttonStyle,
	fontSize: 12,
	minWidth: 52,
	padding: "4px 10px"
};
function useBodyScrollLock(active) {
	useEffect(() => {
		if (!active) return;
		const html = document.documentElement;
		const body = document.body;
		const prevHtml = html.style.overflow;
		const prevBody = body.style.overflow;
		html.style.overflow = "hidden";
		body.style.overflow = "hidden";
		return () => {
			html.style.overflow = prevHtml;
			body.style.overflow = prevBody;
		};
	}, [active]);
}
function DiagramEditor({ diagram, onClose, onSave }) {
	const { t } = useEditorLocale();
	const canvasRef = useRef(null);
	const engineRef = useRef(null);
	const initialDiagramRef = useRef(diagram);
	const onCloseRef = useRef(onClose);
	const [engine, setEngine] = useState(null);
	const [saving, setSaving] = useState(false);
	useBodyScrollLock(true);
	useLayoutEffect(() => {
		onCloseRef.current = onClose;
	});
	useEffect(() => {
		if (!canvasRef.current) return;
		ensureMeta2dShapes();
		const engine = new Meta2d(canvasRef.current, {
			grid: true,
			rule: false
		});
		engineRef.current = engine;
		setEngine(engine);
		try {
			const initialDiagram = initialDiagramRef.current;
			if (initialDiagram?.trim()) engine.open(JSON.parse(initialDiagram));
			else engine.open(createEmptyMeta2dData());
			normalizeMeta2dData(engine.data());
			engine.render(true);
		} catch {
			engine.open(createEmptyMeta2dData());
			normalizeMeta2dData(engine.data());
			engine.render(true);
		}
		const handleEsc = (event) => {
			if (event.key === "Escape") onCloseRef.current();
		};
		window.addEventListener("keydown", handleEsc);
		return () => {
			window.removeEventListener("keydown", handleEsc);
			try {
				engine.destroy();
			} catch {}
			engineRef.current = null;
		};
	}, []);
	const handleSave = async () => {
		const engine = engineRef.current;
		if (!engine) return;
		setSaving(true);
		try {
			normalizeMeta2dData(engine.data());
			engine.render(true);
			const sanitized = sanitizeMeta2dData(engine.data());
			const json = JSON.stringify(sanitized);
			onSave(json, await generateSvgFromMeta2d(engine) || await generateSvgFromDiagram(json) || "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"180\" viewBox=\"0 0 320 180\"><rect width=\"100%\" height=\"100%\" fill=\"#fafafa\" stroke=\"#eee\"/></svg>");
		} finally {
			setSaving(false);
		}
	};
	const runEngine = (fn) => {
		const m = engineRef.current;
		if (m) fn(m);
	};
	return /* @__PURE__ */ jsx("div", {
		onClick: onClose,
		style: {
			alignItems: "center",
			background: "rgb(0 0 0 / 35%)",
			display: "flex",
			inset: 0,
			justifyContent: "center",
			overflow: "hidden",
			position: "fixed",
			zIndex: 1e3
		},
		children: /* @__PURE__ */ jsxs("div", {
			onClick: (event) => event.stopPropagation(),
			onWheel: (event) => event.stopPropagation(),
			style: {
				background: "#fff",
				borderRadius: 10,
				boxShadow: "0 12px 30px rgb(0 0 0 / 20%)",
				display: "flex",
				flexDirection: "column",
				height: "86vh",
				maxHeight: "100%",
				maxWidth: "1200px",
				overflow: "hidden",
				width: "92vw"
			},
			children: [/* @__PURE__ */ jsxs("div", {
				style: {
					alignItems: "center",
					borderBottom: "1px solid #f0f0f0",
					display: "flex",
					flexWrap: "wrap",
					gap: 8,
					justifyContent: "space-between",
					padding: "10px 14px"
				},
				children: [/* @__PURE__ */ jsx("span", {
					style: { fontWeight: 600 },
					children: t("meta2d.editor.title")
				}), /* @__PURE__ */ jsxs("div", {
					style: {
						alignItems: "center",
						display: "flex",
						flexWrap: "wrap",
						gap: 8
					},
					children: [/* @__PURE__ */ jsxs("div", {
						style: {
							display: "flex",
							flexWrap: "wrap",
							gap: 6
						},
						children: [
							/* @__PURE__ */ jsx("button", {
								onClick: () => runEngine((m) => m.undo()),
								style: toolBtnStyle,
								title: `${t("meta2d.editor.undo")} (Ctrl+Z)`,
								type: "button",
								children: t("meta2d.editor.undo")
							}),
							/* @__PURE__ */ jsx("button", {
								onClick: () => runEngine((m) => m.redo()),
								style: toolBtnStyle,
								title: `${t("meta2d.editor.redo")} (Ctrl+Y)`,
								type: "button",
								children: t("meta2d.editor.redo")
							}),
							/* @__PURE__ */ jsx("button", {
								onClick: () => runEngine((m) => m.delete()),
								style: toolBtnStyle,
								title: t("meta2d.editor.delete"),
								type: "button",
								children: t("meta2d.editor.delete")
							}),
							/* @__PURE__ */ jsx("button", {
								onClick: () => runEngine((m) => m.fitView(true)),
								style: toolBtnStyle,
								title: t("meta2d.editor.fit"),
								type: "button",
								children: t("meta2d.editor.fit")
							}),
							/* @__PURE__ */ jsx("button", {
								onClick: () => runEngine((m) => {
									m.scale(1);
									m.centerView();
								}),
								style: toolBtnStyle,
								title: t("meta2d.editor.zoom100"),
								type: "button",
								children: t("meta2d.editor.zoom100")
							})
						]
					}), /* @__PURE__ */ jsxs("div", {
						style: {
							display: "flex",
							gap: 8
						},
						children: [/* @__PURE__ */ jsx("button", {
							onClick: onClose,
							style: buttonStyle,
							type: "button",
							children: t("meta2d.editor.close")
						}), /* @__PURE__ */ jsx("button", {
							disabled: saving,
							onClick: () => void handleSave(),
							style: {
								...buttonStyle,
								background: "#1677ff",
								border: "none",
								color: "#fff"
							},
							type: "button",
							children: saving ? t("meta2d.editor.saving") : t("meta2d.editor.save")
						})]
					})]
				})]
			}), /* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					flex: 1,
					minHeight: 0,
					overflow: "hidden"
				},
				children: [
					/* @__PURE__ */ jsx(DiagramPalette, { engineRef }),
					/* @__PURE__ */ jsx("div", {
						ref: canvasRef,
						style: {
							flex: 1,
							minHeight: 0,
							minWidth: 0
						}
					}),
					/* @__PURE__ */ jsx(PenProps, { engine })
				]
			})]
		})
	});
}
//#endregion
export { DiagramEditor };
