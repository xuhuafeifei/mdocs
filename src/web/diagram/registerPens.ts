import {
  register as penRegister,
  registerAnchors as anchorRegister,
  registerCanvasDraw as canvasRegister,
} from "@meta2d/core";
import { flowPens, flowAnchors } from "@meta2d/flow-diagram";
import {
  activityDiagram,
  activityDiagramByCtx,
} from "@meta2d/activity-diagram";
import { classPens } from "@meta2d/class-diagram";
import {
  sequencePens,
  sequencePensbyCtx,
} from "@meta2d/sequence-diagram";
import { register as chartPluginInit } from "@meta2d/chart-diagram";
import { formPens } from "@meta2d/form-diagram";
import { chartsPens } from "@meta2d/le5le-charts";
import {
  ftaPens,
  ftaPensbyCtx,
  ftaAnchors,
} from "@meta2d/fta-diagram";

type ShapeEntry =
  | { kind: "pen"; loader: () => any }
  | { kind: "anchor"; loader: () => any }
  | { kind: "canvas"; loader: () => any };

const SHAPES: ShapeEntry[] = [
  { kind: "pen", loader: flowPens },
  { kind: "anchor", loader: flowAnchors },
  { kind: "pen", loader: activityDiagram },
  { kind: "canvas", loader: activityDiagramByCtx },
  { kind: "pen", loader: classPens },
  { kind: "pen", loader: sequencePens },
  { kind: "canvas", loader: sequencePensbyCtx },
  { kind: "canvas", loader: formPens },
  { kind: "canvas", loader: chartsPens },
  { kind: "pen", loader: ftaPens },
  { kind: "canvas", loader: ftaPensbyCtx },
  { kind: "anchor", loader: ftaAnchors },
];

export function initializeShapeLibrary(): void {
  chartPluginInit();
  for (const entry of SHAPES) {
    const payload = entry.loader();
    switch (entry.kind) {
      case "pen":
        penRegister(payload);
        break;
      case "anchor":
        anchorRegister(payload);
        break;
      case "canvas":
        canvasRegister(payload);
        break;
    }
  }
}
