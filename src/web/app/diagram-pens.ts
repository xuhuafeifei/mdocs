import type { TranslationKey } from "../i18n/types";

export interface PaletteItem {
  key: string;
  label: string;
  group: string;
  pen: Record<string, unknown>;
}

const baseShape = {
  width: 120,
  height: 60,
  lineWidth: 1,
  color: "#1f1f1f",
  background: "#ffffff",
  textColor: "#1f1f1f",
};

export function getPalette(t: (key: TranslationKey) => string): PaletteItem[] {
  return [
    { key: "rect", label: t("shapeRectangle"), group: "Basic", pen: { ...baseShape, name: "rectangle", text: t("shapeRectangle") } },
    { key: "roundRect", label: t("shapeRounded"), group: "Basic", pen: { ...baseShape, name: "rectangle", borderRadius: 0.2, text: t("shapeRounded") } },
    { key: "circle", label: t("shapeCircle"), group: "Basic", pen: { ...baseShape, name: "circle", width: 80, height: 80, text: t("shapeCircle") } },
    { key: "diamond", label: t("shapeDiamond"), group: "Basic", pen: { ...baseShape, name: "diamond", width: 100, height: 100, text: t("shapeDiamond") } },
    { key: "triangle", label: t("shapeTriangle"), group: "Basic", pen: { ...baseShape, name: "triangle", width: 100, height: 90, text: t("shapeTriangle") } },
    { key: "pentagon", label: t("shapePentagon"), group: "Basic", pen: { ...baseShape, name: "pentagon", width: 100, height: 100, text: t("shapePentagon") } },
    { key: "text", label: t("shapeText"), group: "Basic", pen: { ...baseShape, name: "text", width: 120, height: 32, text: "text", background: "transparent", color: "transparent" } },
    { key: "line", label: t("shapeLine"), group: "Basic", pen: { name: "line", lineWidth: 1, color: "#1f1f1f", width: 160, height: 1 } },

    { key: "flowData", label: t("shapeData"), group: "Flow", pen: { ...baseShape, name: "flowData", text: t("shapeData") } },
    { key: "flowDb", label: t("shapeDatabase"), group: "Flow", pen: { ...baseShape, name: "flowDb", width: 100, height: 100, text: "DB" } },
    { key: "flowDocument", label: t("shapeDocument"), group: "Flow", pen: { ...baseShape, name: "flowDocument", text: "Doc" } },
    { key: "flowDisplay", label: t("shapeDisplay"), group: "Flow", pen: { ...baseShape, name: "flowDisplay", text: t("shapeDisplay") } },
    { key: "flowManually", label: t("shapeManual"), group: "Flow", pen: { ...baseShape, name: "flowManually", text: t("shapeManual") } },
    { key: "flowParallel", label: t("shapeParallel"), group: "Flow", pen: { ...baseShape, name: "flowParallel", text: t("shapeParallel") } },
    { key: "flowComment", label: t("shapeComment"), group: "Flow", pen: { ...baseShape, name: "flowComment", text: t("shapeComment") } },
    { key: "flowSubprocess", label: t("shapeSubprocess"), group: "Flow", pen: { ...baseShape, name: "flowSubprocess", text: t("shapeSubprocess") } },
    { key: "flowQueue", label: t("shapeQueue"), group: "Flow", pen: { ...baseShape, name: "flowQueue", width: 140, height: 60, text: t("shapeQueue") } },
    { key: "flowInternalStorage", label: t("shapeIntStorage"), group: "Flow", pen: { ...baseShape, name: "flowInternalStorage", text: t("shapeIntStorage") } },
    { key: "flowExternStorage", label: t("shapeExtStorage"), group: "Flow", pen: { ...baseShape, name: "flowExternStorage", text: t("shapeExtStorage") } },
  ];
}
