import {
  forwardRef,
  useEffect,
  useRef,
  useState,
} from "react";
import { Meta2d } from "@meta2d/core";
import { DiagramPalette } from "./DiagramPalette";
import { initializeShapeLibrary } from "../diagram/registerPens";

export interface DiagramEditorHandle {
  triggerNewDiagram: () => void;
}

interface DiagramEditorProps {
  initial: unknown;
  canEdit: boolean;
  onSaved?: (data: unknown) => void;
  saveLabel?: string;
  compact?: boolean;
}

function stripInternalFields(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map(stripInternalFields);
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "calculative" || k === "__meta__") continue;
    result[k] = stripInternalFields(v);
  }
  return result;
}

export const DiagramEditor = forwardRef<DiagramEditorHandle, DiagramEditorProps>(
  function DiagramEditor(props, ref) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const meta2dRef = useRef<Meta2d | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
      if (!hostRef.current) return;
      const host = hostRef.current;
      if (!window._shapesReady) {
        try {
          initializeShapeLibrary();
        } catch {
          // ignore duplicate registration on HMR
        }
        window._shapesReady = true;
      }
      const instance = new Meta2d(host, { grid: true, rule: false });
      meta2dRef.current = instance;
      try {
        const initial = props.initial ?? { pens: [] };
        instance.open(initial as never);
      } catch (err) {
        setMessage(`open failed: ${errorMessage(err)}`);
      }
      return () => {
        try {
          instance.destroy();
        } catch {
          // ignore
        }
        meta2dRef.current = null;
      };
    }, []);

    async function save(): Promise<void> {
      const m = meta2dRef.current;
      if (!m) return;
      setBusy(true);
      try {
        const content = m.data();
        const sanitized = stripInternalFields(content);
        props.onSaved?.(sanitized);
        setMessage("saved");
        window.setTimeout(() => setMessage(null), 800);
      } catch (err) {
        setMessage(errorMessage(err));
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className={"mdocs-editor" + (props.compact ? " mdocs-editor-compact" : "")}>
        <div className="mdocs-editor-toolbar">
          <button
            type="button"
            className="primary"
            disabled={!props.canEdit || busy}
            onClick={() => void save()}
          >
            {busy ? "saving..." : (props.saveLabel ?? "Save")}
          </button>
        </div>
        <div className="mdocs-editor-body mdocs-diagram-body">
          <DiagramPalette disabled={!props.canEdit} />
          <div ref={hostRef} className="mdocs-meta2d-host" />
        </div>
        {message && <div className="mdocs-toast">{message}</div>}
      </div>
    );
  },
);

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
