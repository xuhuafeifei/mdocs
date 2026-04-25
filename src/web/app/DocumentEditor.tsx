import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";
import type { DocumentDetail } from "../../shared/types/document";
import { useFlowRenderer } from "../hooks/useFlowRenderer";
import { FlowDiagramModal } from "./FlowDiagramModal";

/** Same fence as markdown-docs (`EditorPanel` / `useFlowRenderer`). */
const FLOW_OPEN_FENCE = /^\s*```(meta2|meta)\b/;

export interface DocumentEditorHandle {
  /** Opens the flow editor for a new ` ```meta2 ` block (toolbar / parent). */
  openInsertFlowEditor: () => void;
}

interface DocumentEditorProps {
  document: DocumentDetail;
  canEdit: boolean;
  onSave: (content: string, title: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

const VDITOR_TOOLBAR = [
  "headings",
  "bold",
  "italic",
  "strike",
  "link",
  "|",
  "list",
  "ordered-list",
  "check",
  "|",
  "quote",
  "line",
  "code",
  "inline-code",
  "|",
  "edit-mode",
  "both",
];

export const DocumentEditor = forwardRef<DocumentEditorHandle, DocumentEditorProps>(
  function DocumentEditor(props, ref) {
    const [title, setTitle] = useState(props.document.title);
    const [busy, setBusy] = useState(false);

    const hostRef = useRef<HTMLDivElement | null>(null);
    const vditorRef = useRef<Vditor | null>(null);
    const readyRef = useRef(false);
    const pendingValueRef = useRef<string | null>(null);

    const [flowModalOpen, setFlowModalOpen] = useState(false);
    const [editingFlowData, setEditingFlowData] = useState<unknown | null>(null);
    const [editingLineNumber, setEditingLineNumber] = useState(-1);
    /** Always matches latest modal context so Save never reads stale closure. */
    const flowEditCtxRef = useRef<{ data: unknown | null; line: number }>({
      data: null,
      line: -1,
    });
    flowEditCtxRef.current = { data: editingFlowData, line: editingLineNumber };

    const handleEditFlow = useCallback((lineNumber: number, flowData: unknown) => {
      setEditingLineNumber(lineNumber);
      setEditingFlowData(flowData);
      setFlowModalOpen(true);
    }, []);

    useFlowRenderer(hostRef, handleEditFlow, !props.canEdit);

    useEffect(() => {
      if (!hostRef.current) return;
      const host = hostRef.current;
      readyRef.current = false;
      pendingValueRef.current = null;

      const instance = new Vditor(host, {
        height: "100%",
        mode: "wysiwyg",
        toolbar: VDITOR_TOOLBAR,
        cache: { enable: false },
        toolbarConfig: { pin: true },
        value: props.document.content,
        after: () => {
          readyRef.current = true;
          window.vditorInstance = instance;
          if (pendingValueRef.current !== null) {
            instance.setValue(pendingValueRef.current);
            pendingValueRef.current = null;
          }
          if (!props.canEdit) {
            instance.disabled();
          }
        },
      });
      vditorRef.current = instance;

      return () => {
        readyRef.current = false;
        if (window.vditorInstance === instance) {
          window.vditorInstance = undefined;
        }
        try {
          instance.destroy();
        } catch {
          // ignore
        }
        vditorRef.current = null;
      };
    }, []);

    useEffect(() => {
      setTitle(props.document.title);
      const v = vditorRef.current;
      if (!v) return;
      if (readyRef.current) {
        v.setValue(props.document.content);
      } else {
        pendingValueRef.current = props.document.content;
      }
    }, [props.document.documentId, props.document.content, props.document.title]);

    useEffect(() => {
      const v = vditorRef.current;
      if (!v || !readyRef.current) return;
      if (props.canEdit) {
        v.enable();
      } else {
        v.disabled();
      }
    }, [props.canEdit]);

    const handleFlowSave = useCallback(
      (flowData: unknown) => {
        if (!props.canEdit) {
          setFlowModalOpen(false);
          return;
        }
        setFlowModalOpen(false);
        const v = vditorRef.current;
        if (!v) return;

        const { data: priorData, line: lineNo } = flowEditCtxRef.current;

        if (!priorData) {
          const block = `\n\n\`\`\`meta2\n${JSON.stringify(flowData)}\n\`\`\`\n\n`;
          const current = v.getValue();
          const next = current.endsWith("\n") ? current + block : `${current}\n${block}`;
          v.setValue(next);
        } else {
          const currentContent = v.getValue();
          const lines = currentContent.split("\n");
          if (
            lineNo >= 0 &&
            lineNo < lines.length &&
            FLOW_OPEN_FENCE.test(lines[lineNo - 1] ?? "") &&
            lines[lineNo + 1]?.includes("```")
          ) {
            lines[lineNo] = JSON.stringify(flowData);
            v.setValue(lines.join("\n"));
          } else {
            const oldStr = JSON.stringify(priorData);
            const newStr = JSON.stringify(flowData);
            v.setValue(currentContent.replace(oldStr, newStr));
          }
        }
        setEditingFlowData(null);
        setEditingLineNumber(-1);
      },
      [props.canEdit],
    );

    const handleFlowCancel = useCallback(() => {
      setFlowModalOpen(false);
      setEditingFlowData(null);
      setEditingLineNumber(-1);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        openInsertFlowEditor() {
          setEditingFlowData(null);
          setEditingLineNumber(-1);
          setFlowModalOpen(true);
        },
      }),
      [],
    );

    async function save(): Promise<void> {
      const v = vditorRef.current;
      if (!v) return;
      const content = v.getValue();
      setBusy(true);
      try {
        await props.onSave(content, title);
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="mdocs-editor">
        <div className="mdocs-editor-toolbar">
          <input
            style={{ flex: 1 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="document title"
            disabled={!props.canEdit}
          />
          <span className="mdocs-editor-path">{props.document.relativePath}</span>
          <button
            type="button"
            disabled={!props.canEdit || busy}
            onClick={() => {
              setEditingFlowData(null);
              setEditingLineNumber(-1);
              setFlowModalOpen(true);
            }}
          >
            Insert diagram
          </button>
          <button type="button" className="primary" disabled={!props.canEdit || busy} onClick={() => void save()}>
            {busy ? "saving..." : "Save"}
          </button>
          <button type="button" disabled={!props.canEdit || busy} onClick={props.onDelete}>
            Delete
          </button>
        </div>
        <div className="mdocs-editor-body">
          <div ref={hostRef} className="mdocs-vditor-host" />
        </div>
        <FlowDiagramModal
          open={flowModalOpen}
          flowKey={editingFlowData === null ? "flow-insert" : `flow-edit-${editingLineNumber}`}
          initialData={editingFlowData}
          canEdit={props.canEdit}
          saveLabel={!editingFlowData ? "Save and insert" : "Save"}
          onSave={handleFlowSave}
          onCancel={handleFlowCancel}
        />
      </div>
    );
  },
);
