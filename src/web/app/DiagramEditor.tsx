import { useEffect, useRef, useState } from "react";
import { Meta2d } from "@meta2d/core";
import { useI18n } from "../i18n";
import { DiagramPalette } from "./DiagramPalette";
import { registerAllShapeLibraries } from "../meta2d/registerPens";

/**
 * Meta2d editor shell. Pen registration matches markdown-docs `registerPens.ts`.
 * Save sanitisation matches `FlowEditorModal.handleSave`.
 */
export function DiagramEditor(props: {
  initial: unknown;
  canEdit: boolean;
  /** Called with serialisable flow JSON (calculative / __meta__ stripped). */
  onSaved?: (data: unknown) => void;
  saveLabel?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const meta2dRef = useRef<Meta2d | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    if (!window._pensRegistered) {
      try {
        registerAllShapeLibraries();
      } catch {
        // ignore duplicate registration on HMR
      }
      window._pensRegistered = true;
    }
    const instance = new Meta2d(host, { grid: true, rule: false });
    meta2dRef.current = instance;
    try {
      const initial = props.initial ?? { pens: [] };
      instance.open(initial as never);
    } catch (err) {
      setMessage(t("openFailed", { message: errorMessage(err) }));
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
      const sanitized = JSON.parse(
        JSON.stringify(content, (key, value) => {
          if (key === "calculative" || key === "__meta__") return undefined;
          return value;
        }),
      );
      props.onSaved?.(sanitized);
      setMessage(t("saved"));
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
          {busy ? t("saving") : (props.saveLabel ?? t("save"))}
        </button>
      </div>
      <div className="mdocs-editor-body mdocs-diagram-body">
        <DiagramPalette disabled={!props.canEdit} />
        <div ref={hostRef} className="mdocs-meta2d-host" />
      </div>
      {message && <div className="mdocs-toast">{message}</div>}
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
