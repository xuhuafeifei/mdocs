import { classPens as cp } from "@meta2d/class-diagram";
import {
  register as r,
  registerAnchors as ra,
  registerCanvasDraw as rc,
} from "@meta2d/core";
import {
  activityDiagram as ad,
  activityDiagramByCtx as adc,
} from "@meta2d/activity-diagram";
import { register as ech } from "@meta2d/chart-diagram";
import {
  ftaPens as ft,
  ftaPensbyCtx as ftc,
  ftaAnchors as fta,
} from "@meta2d/fta-diagram";
import { formPens as fm } from "@meta2d/form-diagram";
import { flowPens as fp, flowAnchors as fa } from "@meta2d/flow-diagram";
import { chartsPens as ch } from "@meta2d/le5le-charts";
import {
  sequencePens as sp,
  sequencePensbyCtx as spc,
} from "@meta2d/sequence-diagram";

export function registerAllShapeLibraries(): void {
  r(fp());
  ra(fa());
  r(ad());
  rc(adc());
  r(cp());
  r(sp());
  rc(spc());
  ech();
  rc(fm());
  rc(ch());
  r(ft());
  rc(ftc());
  ra(fta());
}

export const initializeShapeLibrary = registerAllShapeLibraries;
