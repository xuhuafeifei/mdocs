import { useEffect } from "react";
import { useI18n } from "../i18n";
import { DiagramEditor } from "./DiagramEditor";

/**
 * Same role as markdown-docs `FlowEditorModal`: save returns sanitized Meta2d JSON
 * for ` ```meta2 ` fenced blocks in Markdown.
 */
export function FlowDiagramModal(props: {
  open: boolean;
  flowKey: string;
  initialData: unknown | null;
  canEdit: boolean;
  saveLabel: string;
  onSave: (flowData: unknown) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onCancel]);

  if (!props.open) return null;

  return (
    <div className="mdocs-modal-backdrop" onClick={props.onCancel}>
      <div className="mdocs-modal mdocs-flow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mdocs-modal-header">
          <span>{props.initialData ? t("editDiagram") : t("newDiagram")}</span>
          <button type="button" onClick={props.onCancel}>
            {t("close")}
          </button>
        </div>
        <div className="mdocs-modal-body">
          <DiagramEditor
            key={props.flowKey}
            initial={props.initialData ?? { pens: [] }}
            canEdit={props.canEdit}
            saveLabel={props.saveLabel}
            compact
            onSaved={(data) => props.onSave(data)}
          />
        </div>
      </div>
    </div>
  );
}
