import { o as normalizeMeta2dData, r as EMPTY_META2D_PLACEHOLDER_SVG } from "./meta2dLight-JnDieCPZ.js";
import { Meta2d, isShowChild, register, registerAnchors, registerCanvasDraw } from "@meta2d/core";
import C2S from "canvas2svg";
import { activityDiagram, activityDiagramByCtx } from "@meta2d/activity-diagram";
import { register as register$1 } from "@meta2d/chart-diagram";
import { classPens } from "@meta2d/class-diagram";
import { flowAnchors, flowPens } from "@meta2d/flow-diagram";
import { formPens } from "@meta2d/form-diagram";
import { ftaAnchors, ftaPens, ftaPensbyCtx } from "@meta2d/fta-diagram";
import { chartsPens } from "@meta2d/le5le-charts";
import { sequencePens, sequencePensbyCtx } from "@meta2d/sequence-diagram";
//#region src/plugins/meta2d/utils/registerPens.ts
/**
* Registers all Meta2d shape libraries (aligned with mdocs `registerPens.ts`)
* so palette items from flow / activity / sequence / class / FTA / charts work.
*/
let registered = false;
function registerAllShapeLibraries() {
	if (registered) return;
	register(flowPens());
	registerAnchors(flowAnchors());
	register(activityDiagram());
	registerCanvasDraw(activityDiagramByCtx());
	register(classPens());
	register(sequencePens());
	registerCanvasDraw(sequencePensbyCtx());
	register$1();
	registerCanvasDraw(formPens());
	registerCanvasDraw(chartsPens());
	register(ftaPens());
	registerCanvasDraw(ftaPensbyCtx());
	registerAnchors(ftaAnchors());
	registered = true;
}
//#endregion
//#region src/plugins/meta2d/utils/meta2dEngine.ts
/**
* Heavy Meta2d runtime — only load via dynamic import when a diagram is rendered/edited.
*/
let shapesReady = false;
function ensureMeta2dShapes() {
	if (shapesReady) return;
	registerAllShapeLibraries();
	shapesReady = true;
}
function destroyEngine(engine, host) {
	try {
		engine?.destroy();
	} catch {}
	try {
		host.remove();
	} catch {}
}
function patchCanvas2SvgFont(ctx) {
	let rawFontValue = ctx.font;
	Object.defineProperty(ctx, "font", {
		configurable: true,
		get: () => rawFontValue,
		set: (value) => {
			rawFontValue = typeof value === "string" ? value.replace(/(\d+(?:\.\d+)?(?:px|pt|pc|em|ex|%|in|cm|mm))\s*\/\s*(\d+(?:\.\d+)?)(?=\s|$)/, "$1/normal") : value;
			if (ctx.__ctx) ctx.__ctx.font = rawFontValue;
		}
	});
}
function patchCanvas2SvgEllipse(ctx) {
	if (typeof ctx.ellipse === "function") return;
	ctx.ellipse = (x, y, radiusX, radiusY, rotation = 0, startAngle = 0, endAngle = Math.PI * 2, counterclockwise = false) => {
		if (radiusX < 0 || radiusY < 0) throw new Error("IndexSizeError: The radius provided is negative.");
		if (ctx.__currentElement?.nodeName !== "path") ctx.beginPath();
		const twoPi = Math.PI * 2;
		const delta = Math.abs(endAngle - startAngle);
		const fullEllipse = delta >= twoPi - 1e-4 || delta === 0;
		const rotationDeg = rotation * 180 / Math.PI;
		const sweepFlag = counterclockwise ? 0 : 1;
		const pointAt = (angle) => {
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			const rotateCos = Math.cos(rotation);
			const rotateSin = Math.sin(rotation);
			return {
				x: x + radiusX * cos * rotateCos - radiusY * sin * rotateSin,
				y: y + radiusX * cos * rotateSin + radiusY * sin * rotateCos
			};
		};
		const addArc = (largeArcFlag, end) => {
			ctx.__addPathCommand(`A ${radiusX} ${radiusY} ${rotationDeg} ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`);
			ctx.__currentPosition = end;
		};
		const start = pointAt(startAngle);
		ctx.moveTo(start.x, start.y);
		if (fullEllipse) {
			addArc(1, pointAt(startAngle + Math.PI));
			addArc(1, start);
			return;
		}
		const end = pointAt(endAngle);
		addArc(delta > Math.PI ? 1 : 0, end);
	};
}
function waitFrame() {
	return new Promise((resolve) => {
		requestAnimationFrame(() => resolve());
	});
}
async function waitForMeta2dRender() {
	await waitFrame();
	await waitFrame();
}
function resolveCanvas2SvgCtor() {
	const moduleCtor = C2S.default ?? C2S.C2S ?? C2S;
	if (typeof moduleCtor === "function") return moduleCtor;
	const windowCtor = window.C2S;
	if (typeof windowCtor === "function") return windowCtor;
	return null;
}
async function generateSvgFromMeta2d(engine, Canvas2SvgCtor = resolveCanvas2SvgCtor()) {
	if (!Canvas2SvgCtor) {
		console.error("[meta2d] preview failed: canvas2svg constructor missing");
		return "";
	}
	normalizeMeta2dData(engine.data());
	engine.render(true);
	await waitForMeta2dRender();
	const store = engine.store;
	const pens = store?.data?.pens;
	const penCount = Array.isArray(pens) ? pens.length : 0;
	const padding = 10;
	const sourceRect = engine.getRect();
	if (!sourceRect || !Number.isFinite(sourceRect.width) || !Number.isFinite(sourceRect.height) || sourceRect.width <= 0 || sourceRect.height <= 0) {
		if (penCount === 0) return EMPTY_META2D_PLACEHOLDER_SVG;
		console.error("[meta2d] preview failed: invalid bounds", sourceRect);
		return "";
	}
	const rect = {
		...sourceRect,
		x: sourceRect.x - padding,
		y: sourceRect.y - padding
	};
	const ctx = new Canvas2SvgCtor(Math.ceil(sourceRect.width + padding * 2), Math.ceil(sourceRect.height + padding * 2));
	ctx.textBaseline = "middle";
	ctx.strokeStyle = store?.styles?.color || "#1f1f1f";
	patchCanvas2SvgFont(ctx);
	patchCanvas2SvgEllipse(ctx);
	if (Array.isArray(pens) && store) for (const pen of pens) {
		if (pen?.visible === false || !isShowChild(pen, store)) continue;
		try {
			engine.renderPenRaw(ctx, pen, rect, true);
		} catch (error) {
			console.error("[meta2d] preview failed: render pen", pen, error);
		}
	}
	const svg = ctx.getSerializedSvg?.()?.replace(/--le5le--/g, "&#x") ?? "";
	if (!svg.trim()) {
		if (penCount === 0) return EMPTY_META2D_PLACEHOLDER_SVG;
		console.error("[meta2d] preview failed: serialized SVG is empty", { pensCount: penCount });
		return "";
	}
	return svg;
}
async function generateSvgFromDiagram(diagramJson) {
	const Canvas2SvgCtor = resolveCanvas2SvgCtor();
	if (!Canvas2SvgCtor) {
		console.error("[meta2d] preview failed: canvas2svg constructor missing");
		return "";
	}
	ensureMeta2dShapes();
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;left:-20000px;top:0;width:1200px;height:800px;pointer-events:none;z-index:-1;";
	document.body.append(host);
	let engine = null;
	try {
		let parsed;
		try {
			parsed = JSON.parse(diagramJson);
		} catch (error) {
			console.error("[meta2d] preview failed: invalid diagram JSON", error, diagramJson);
			return "";
		}
		engine = new Meta2d(host, {
			background: "#fff",
			grid: false,
			rule: false
		});
		normalizeMeta2dData(parsed);
		engine.open(parsed);
		engine.render(true);
		await waitForMeta2dRender();
		return generateSvgFromMeta2d(engine, Canvas2SvgCtor);
	} catch (error) {
		console.error("[meta2d] preview failed: unexpected error", error);
		return "";
	} finally {
		destroyEngine(engine, host);
	}
}
//#endregion
export { ensureMeta2dShapes, generateSvgFromDiagram, generateSvgFromMeta2d };
