//#region src/plugins/meta2d/utils/meta2dLight.ts
/** Lightweight meta2d helpers — no @meta2d / canvas2svg imports. */
const DEFAULT_STROKE_COLOR = "#1f1f1f";
const DEFAULT_LINE_WIDTH = 1;
const NO_DEFAULT_STROKE_NAMES = new Set(["text"]);
function createEmptyMeta2dData() {
	return { pens: [] };
}
/** Canonical empty diagram JSON for new blocks and markdown defaults. */
const EMPTY_META2D_DIAGRAM_JSON = JSON.stringify(createEmptyMeta2dData());
/** Inline SVG used when the canvas has no drawable content yet (HUD + layout need a truthy svg). */
const EMPTY_META2D_PLACEHOLDER_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"180\" viewBox=\"0 0 320 180\"><rect width=\"100%\" height=\"100%\" fill=\"#fafafa\" stroke=\"#eee\"/></svg>";
/** When loading from markdown without cached svg, use placeholder for empty diagrams to avoid async flicker. */
function initialSvgForDiagram(diagram) {
	if (!diagram.trim()) return EMPTY_META2D_PLACEHOLDER_SVG;
	try {
		const data = JSON.parse(diagram);
		if (data && Array.isArray(data.pens) && data.pens.length === 0) return EMPTY_META2D_PLACEHOLDER_SVG;
	} catch {}
	return "";
}
function isRecord(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function shouldApplyDefaultStroke(pen) {
	return !NO_DEFAULT_STROKE_NAMES.has(String(pen.name ?? ""));
}
function normalizeMeta2dPen(pen) {
	if (shouldApplyDefaultStroke(pen)) {
		if (pen.color === void 0 && pen.strokeStyle === void 0) pen.color = DEFAULT_STROKE_COLOR;
		if (pen.lineWidth === void 0 && pen.strokeStyle !== "transparent") pen.lineWidth = DEFAULT_LINE_WIDTH;
	}
	if (pen.text && pen.textColor === void 0) pen.textColor = DEFAULT_STROKE_COLOR;
	return pen;
}
function normalizeMeta2dData(data) {
	if (!isRecord(data) || !Array.isArray(data.pens)) return data;
	data.pens.forEach((pen) => {
		if (isRecord(pen)) normalizeMeta2dPen(pen);
	});
	return data;
}
function sanitizeMeta2dData(data) {
	return JSON.parse(JSON.stringify(data, (key, value) => {
		if (key === "__meta__" || key === "calculative") return void 0;
		return value;
	}));
}
//#endregion
export { initialSvgForDiagram as a, sanitizeMeta2dData as c, createEmptyMeta2dData as i, EMPTY_META2D_DIAGRAM_JSON as n, normalizeMeta2dData as o, EMPTY_META2D_PLACEHOLDER_SVG as r, normalizeMeta2dPen as s, DEFAULT_STROKE_COLOR as t };
