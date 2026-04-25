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

export const PALETTE: PaletteItem[] = [
  { key: "rect", label: "Rectangle", group: "Basic", pen: { ...baseShape, name: "rectangle", text: "Rectangle" } },
  { key: "roundRect", label: "Rounded", group: "Basic", pen: { ...baseShape, name: "rectangle", borderRadius: 0.2, text: "Rounded" } },
  { key: "circle", label: "Circle", group: "Basic", pen: { ...baseShape, name: "circle", width: 80, height: 80, text: "Circle" } },
  { key: "diamond", label: "Diamond", group: "Basic", pen: { ...baseShape, name: "diamond", width: 100, height: 100, text: "Diamond" } },
  { key: "triangle", label: "Triangle", group: "Basic", pen: { ...baseShape, name: "triangle", width: 100, height: 90, text: "Triangle" } },
  { key: "pentagon", label: "Pentagon", group: "Basic", pen: { ...baseShape, name: "pentagon", width: 100, height: 100, text: "Pentagon" } },
  { key: "text", label: "Text", group: "Basic", pen: { ...baseShape, name: "text", width: 120, height: 32, text: "text", background: "transparent", color: "transparent" } },
  { key: "line", label: "Line", group: "Basic", pen: { name: "line", lineWidth: 1, color: "#1f1f1f", width: 160, height: 1 } },

  { key: "flowData", label: "Data", group: "Flow", pen: { ...baseShape, name: "flowData", text: "Data" } },
  { key: "flowDb", label: "Database", group: "Flow", pen: { ...baseShape, name: "flowDb", width: 100, height: 100, text: "DB" } },
  { key: "flowDocument", label: "Document", group: "Flow", pen: { ...baseShape, name: "flowDocument", text: "Doc" } },
  { key: "flowDisplay", label: "Display", group: "Flow", pen: { ...baseShape, name: "flowDisplay", text: "Display" } },
  { key: "flowManually", label: "Manual", group: "Flow", pen: { ...baseShape, name: "flowManually", text: "Manual" } },
  { key: "flowParallel", label: "Parallel", group: "Flow", pen: { ...baseShape, name: "flowParallel", text: "Parallel" } },
  { key: "flowComment", label: "Comment", group: "Flow", pen: { ...baseShape, name: "flowComment", text: "Comment" } },
  { key: "flowSubprocess", label: "Subprocess", group: "Flow", pen: { ...baseShape, name: "flowSubprocess", text: "Subprocess" } },
  { key: "flowQueue", label: "Queue", group: "Flow", pen: { ...baseShape, name: "flowQueue", width: 140, height: 60, text: "Queue" } },
  { key: "flowInternalStorage", label: "Int. Storage", group: "Flow", pen: { ...baseShape, name: "flowInternalStorage", text: "Int. Storage" } },
  { key: "flowExternStorage", label: "Ext. Storage", group: "Flow", pen: { ...baseShape, name: "flowExternStorage", text: "Ext. Storage" } },
];
