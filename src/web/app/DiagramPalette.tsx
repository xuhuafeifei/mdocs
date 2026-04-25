import { useMemo } from "react";
import { PALETTE, type PaletteItem } from "./diagram-pens";

export function DiagramPalette(props: { disabled?: boolean }) {
  const groups = useMemo(() => groupByGroup(PALETTE), []);
  return (
    <aside className="mdocs-palette">
      <div className="mdocs-palette-title">Components</div>
      <div className="mdocs-palette-hint muted">drag to canvas</div>
      {groups.map(([group, items]) => (
        <div key={group} className="mdocs-palette-group">
          <div className="mdocs-palette-group-title muted">{group}</div>
          <div className="mdocs-palette-grid">
            {items.map((item) => (
              <PaletteTile key={item.key} item={item} disabled={props.disabled} />
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}

function PaletteTile(props: { item: PaletteItem; disabled?: boolean }) {
  const { item } = props;
  return (
    <div
      className="mdocs-palette-tile"
      draggable={!props.disabled}
      title={item.label}
      onDragStart={(e) => {
        if (props.disabled) {
          e.preventDefault();
          return;
        }
        const payload = JSON.stringify(item.pen);
        e.dataTransfer.setData("Meta2d", payload);
        e.dataTransfer.setData("Text", payload);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <ShapePreview name={String(item.pen.name ?? "rectangle")} />
      <span className="mdocs-palette-tile-label">{item.label}</span>
    </div>
  );
}

function ShapePreview(props: { name: string }) {
  const common = { stroke: "#1f1f1f", fill: "#ffffff", strokeWidth: 1.2 } as const;
  switch (props.name) {
    case "circle":
      return (
        <svg width="28" height="28" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="10" {...common} />
        </svg>
      );
    case "diamond":
      return (
        <svg width="28" height="28" viewBox="0 0 28 28">
          <polygon points="14,3 25,14 14,25 3,14" {...common} />
        </svg>
      );
    case "triangle":
      return (
        <svg width="28" height="28" viewBox="0 0 28 28">
          <polygon points="14,4 25,24 3,24" {...common} />
        </svg>
      );
    case "pentagon":
      return (
        <svg width="28" height="28" viewBox="0 0 28 28">
          <polygon points="14,3 25,12 21,25 7,25 3,12" {...common} />
        </svg>
      );
    case "text":
      return (
        <svg width="28" height="28" viewBox="0 0 28 28">
          <text x="14" y="19" textAnchor="middle" fontSize="14" fill="#1f1f1f">T</text>
        </svg>
      );
    case "line":
      return (
        <svg width="28" height="28" viewBox="0 0 28 28">
          <line x1="4" y1="14" x2="24" y2="14" {...common} />
        </svg>
      );
    default:
      return (
        <svg width="28" height="28" viewBox="0 0 28 28">
          <rect x="4" y="7" width="20" height="14" rx="2" {...common} />
        </svg>
      );
  }
}

function groupByGroup(items: PaletteItem[]): [string, PaletteItem[]][] {
  const map = new Map<string, PaletteItem[]>();
  for (const item of items) {
    const arr = map.get(item.group) ?? [];
    arr.push(item);
    map.set(item.group, arr);
  }
  return Array.from(map.entries());
}
