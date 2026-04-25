/**
 * Copied from markdown-docs `frontend/src/diagram-editor/utils/registerPens.ts`
 * (same dependency set and registration order).
 */
import { register, registerAnchors, registerCanvasDraw } from "@meta2d/core";
import { flowPens, flowAnchors } from "@meta2d/flow-diagram";
import {
  activityDiagram,
  activityDiagramByCtx,
} from "@meta2d/activity-diagram";
import { classPens } from "@meta2d/class-diagram";
import { sequencePens, sequencePensbyCtx } from "@meta2d/sequence-diagram";
import { register as registerEcharts } from "@meta2d/chart-diagram";
import { formPens } from "@meta2d/form-diagram";
import { chartsPens } from "@meta2d/le5le-charts";
import { ftaPens, ftaPensbyCtx, ftaAnchors } from "@meta2d/fta-diagram";

/** Name used by markdown-docs / `useFlowRenderer`. */
export function registerAllPens(): void {
  register(flowPens());
  registerAnchors(flowAnchors());
  register(activityDiagram());
  registerCanvasDraw(activityDiagramByCtx());
  register(classPens());
  register(sequencePens());
  registerCanvasDraw(sequencePensbyCtx());
  registerEcharts();
  registerCanvasDraw(formPens());
  registerCanvasDraw(chartsPens());
  register(ftaPens());
  registerCanvasDraw(ftaPensbyCtx());
  registerAnchors(ftaAnchors());
}

/** Legacy name used elsewhere in mdocs. */
export const initializeShapeLibrary = registerAllPens;
