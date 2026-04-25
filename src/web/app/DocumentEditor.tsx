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
import { useDiagramPreview } from "../hooks/useDiagramPreview";
import { DiagramModal } from "./FlowDiagramModal";

const DIAGRAM_BLOCK_START = /^\s*```(meta2|meta)\b/;

export interface DocumentEditorHandle {
  triggerNewDiagram: () => void;
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

function insertDiagramBlock(editor: Vditor, data: unknown): void {
  const lines = ["", "```meta2", JSON.stringify(data), "```", ""];
  const block = lines.join("\n");
  const current = editor.getValue();
  const next = current.endsWith("\n") ? current + block : `${current}\n${block}`;
  editor.setValue(next);
}

function updateDiagramBlock(
  editor: Vditor,
  data: unknown,
  priorData: unknown,
  lineNo: number,
): void {
  const currentContent = editor.getValue();
  const lines = currentContent.split("\n");
  if (
    lineNo >= 0 &&
    lineNo < lines.length &&
    DIAGRAM_BLOCK_START.test(lines[lineNo - 1] ?? "") &&
    lines[lineNo + 1]?.includes("```")
  ) {
    lines[lineNo] = JSON.stringify(data);
    editor.setValue(lines.join("\n"));
  } else {
    const oldStr = JSON.stringify(priorData);
    const newStr = JSON.stringify(data);
    const pattern = new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    editor.setValue(currentContent.replace(pattern, newStr));
  }
}

export const DocumentEditor = forwardRef<DocumentEditorHandle, DocumentEditorProps>(
  function DocumentEditor(props, ref) {
    const [title, setTitle] = useState(props.document.title);
    const [busy, setBusy] = useState(false);

    const hostRef = useRef<HTMLDivElement | null>(null);
    const vditorRef = useRef<Vditor | null>(null);
    const readyRef = useRef(false);
    const pendingValueRef = useRef<string | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingChart, setEditingChart] = useState<unknown | null>(null);
    const [editingLineNumber, setEditingLineNumber] = useState(-1);
    const chartEditCtxRef = useRef<{ data: unknown | null; line: number }>({
      data: null,
      line: -1,
    });
    chartEditCtxRef.current = { data: editingChart, line: editingLineNumber };

    const handleEditFlow = useCallback((lineNumber: number, flowData: unknown) => {
      setEditingLineNumber(lineNumber);
      setEditingChart(flowData);
      setModalOpen(true);
    }, []);

    useDiagramPreview(hostRef, handleEditFlow, !props.canEdit);

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
          window.activeEditor = instance;
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
        if (window.activeEditor === instance) {
          window.activeEditor = undefined;
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
        if (v.getValue() !== props.document.content) {
          v.setValue(props.document.content);
        }
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
          setModalOpen(false);
          return;
        }
        setModalOpen(false);
        const v = vditorRef.current;
        if (!v) return;

        const { data: priorData, line: lineNo } = chartEditCtxRef.current;

        if (!priorData) {
          insertDiagramBlock(v, flowData);
        } else {
          updateDiagramBlock(v, flowData, priorData, lineNo);
        }
        setEditingChart(null);
        setEditingLineNumber(-1);
      },
      [props.canEdit],
    );

    const handleFlowCancel = useCallback(() => {
      setModalOpen(false);
      setEditingChart(null);
      setEditingLineNumber(-1);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        triggerNewDiagram() {
          setEditingChart(null);
          setEditingLineNumber(-1);
          setModalOpen(true);
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
              setEditingChart(null);
              setEditingLineNumber(-1);
              setModalOpen(true);
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
        <DiagramModal
          open={modalOpen}
          diagramKey={editingChart === null ? "flow-insert" : `flow-edit-${editingLineNumber}`}
          initialChart={editingChart}
          canEdit={props.canEdit}
          saveLabel={!editingChart ? "Save and insert" : "Save"}
          onCommit={handleFlowSave}
          onDismiss={handleFlowCancel}
        />
      </div>
    );
  },
);
