import { useEffect } from "react";
import { DiagramEditor } from "./DiagramEditor";

export function DiagramModal(props: {
  open: boolean;
  diagramKey: string;
  initialChart: unknown | null;
  canEdit: boolean;
  saveLabel: string;
  onCommit: (flowData: unknown) => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onDismiss]);

  if (!props.open) return null;

  return (
    <div className="mdocs-modal-backdrop" onClick={props.onDismiss}>
      <div className="mdocs-modal mdocs-flow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mdocs-modal-header">
          <span>{props.initialChart ? "Edit diagram" : "New diagram"}</span>
          <button type="button" onClick={props.onDismiss}>
            Close
          </button>
        </div>
        <div className="mdocs-modal-body">
          <DiagramEditor
            key={props.diagramKey}
            initial={props.initialChart ?? { pens: [] }}
            canEdit={props.canEdit}
            saveLabel={props.saveLabel}
            compact
            onSaved={(data) => props.onCommit(data)}
          />
        </div>
      </div>
    </div>
  );
}
