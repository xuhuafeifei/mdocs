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
import { getStoredToken } from "../api/client";
import { findMeta2BlockRange } from "../diagram/meta2Markdown";
import { useFlowRenderer } from "../hooks/useDiagramPreview";
import { FlowDiagramModal } from "./FlowDiagramModal";

/** Same fence as markdown-docs (`EditorPanel` / `useFlowRenderer`). */
const FLOW_OPEN_FENCE = /^\s*```(meta2|meta)\b/;

/** Shown only in the editor surface for non-owners; not persisted (Save is disabled). */
const READ_ONLY_MD_PREFIX = "> 您无权限编辑\n\n";

function withReadOnlyNotice(content: string, canEdit: boolean): string {
  if (canEdit) return content;
  if (content.startsWith(READ_ONLY_MD_PREFIX)) return content;
  return READ_ONLY_MD_PREFIX + content;
}

export interface DocumentEditorHandle {
  openInsertFlowEditor: () => void;
}

interface DocumentEditorProps {
  document: DocumentDetail;
  canEdit: boolean;
  onSave: (content: string, title: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

/**
 * Same order as `markdown-docs/frontend/src/hooks/useVditor.ts` `FULL_TOOLBAR`.
 * `upload` is omitted when the user cannot edit (no owner token / read-only).
 */
const VDITOR_TOOLBAR_FULL: string[] = [
  "undo",
  "redo",
  "table",
  "outline",
  "|",
  "headings",
  "bold",
  "italic",
  "strike",
  "link",
  "|",
  "list",
  "ordered-list",
  "check",
  "outdent",
  "indent",
  "|",
  "quote",
  "line",
  "code",
  "inline-code",
  "insert-before",
  "insert-after",
  "|",
  "upload",
  "|",
  "edit-mode",
  "both",
];

const UPLOAD_MAX_BYTES = 12 * 1024 * 1024;

function buildToolbar(canEdit: boolean): string[] {
  if (canEdit) return [...VDITOR_TOOLBAR_FULL];
  return VDITOR_TOOLBAR_FULL.filter((x) => x !== "upload");
}

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
    const [editingBlockIndex, setEditingBlockIndex] = useState(-1);
    const [editingRawJson, setEditingRawJson] = useState("");

    const flowEditCtxRef = useRef<{
      data: unknown | null;
      line: number;
      blockIndex: number;
      rawJson: string;
    }>({
      data: null,
      line: -1,
      blockIndex: -1,
      rawJson: "",
    });
    flowEditCtxRef.current = {
      data: editingFlowData,
      line: editingLineNumber,
      blockIndex: editingBlockIndex,
      rawJson: editingRawJson,
    };

    const handleEditFlow = useCallback(
      (_lineNumber: number, flowData: unknown, blockIndex: number, rawJson: string) => {
        setEditingLineNumber(_lineNumber);
        setEditingFlowData(flowData);
        setEditingBlockIndex(blockIndex);
        setEditingRawJson(rawJson);
        setFlowModalOpen(true);
      },
      [],
    );

    useFlowRenderer(hostRef, handleEditFlow, !props.canEdit);

    useEffect(() => {
      if (!hostRef.current) return;
      const host = hostRef.current;
      readyRef.current = false;
      pendingValueRef.current = null;

      const uploadOpts = props.canEdit
        ? {
            upload: {
              url: "/api/assets/upload",
              linkToImgUrl: `/api/assets/link-to-img?documentId=${encodeURIComponent(props.document.documentId)}`,
              max: UPLOAD_MAX_BYTES,
              fieldName: "file[]",
              accept: "image/*",
              multiple: true,
              filename: (name: string) => name,
              extraData: { documentId: props.document.documentId },
              setHeaders: () => ({
                "x-visitor-token": getStoredToken() ?? "",
              }),
            },
          }
        : {};

      const instance = new Vditor(host, {
        height: "100%",
        minHeight: 360,
        mode: "wysiwyg",
        /** 不设时 `fixTab` 不生效，按 Tab 会走浏览器默认＝焦点离开编辑器，代码块内既无缩进也「像丢了编辑区」。 */
        tab: "    ",
        typewriterMode: false,
        outline: { enable: false, position: "left" },
        toolbar: buildToolbar(props.canEdit),
        cache: { enable: false },
        toolbarConfig: { pin: false },
        counter: { enable: false },
        preview: {
          actions: ["desktop", "tablet", "mobile"],
          markdown: {
            toc: true,
            autoSpace: true,
            footnotes: true,
            /** Allow `![](http...)` in trusted self-hosted editor (markdown-docs relies on server-side hygiene). */
            sanitize: false,
          },
        },
        ...uploadOpts,
        value: withReadOnlyNotice(props.document.content, props.canEdit),
        after: () => {
          readyRef.current = true;
          window.vditorInstance = instance;
          if (pendingValueRef.current !== null) {
            instance.setValue(pendingValueRef.current);
            pendingValueRef.current = null;
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
    }, [props.document.documentId, props.canEdit]);

    useEffect(() => {
      setTitle(props.document.title);
      const v = vditorRef.current;
      if (!v) return;
      const display = withReadOnlyNotice(props.document.content, props.canEdit);
      if (readyRef.current) {
        v.setValue(display);
      } else {
        pendingValueRef.current = display;
      }
    }, [props.document.documentId, props.document.content, props.document.title, props.canEdit]);

    const handleFlowSave = useCallback(
      (flowData: unknown) => {
        if (!props.canEdit) {
          setFlowModalOpen(false);
          return;
        }
        setFlowModalOpen(false);
        const v = vditorRef.current;
        if (!v) return;

        const { data: priorData, line: lineNo, blockIndex: blockIdx, rawJson } =
          flowEditCtxRef.current;

        if (!priorData) {
          const block = `\n\n\`\`\`meta2\n${JSON.stringify(flowData)}\n\`\`\`\n\n`;
          const current = v.getValue();
          const next = current.endsWith("\n") ? current + block : `${current}\n${block}`;
          v.setValue(next);
        } else {
          const md = v.getValue();
          const newJsonLine = JSON.stringify(flowData);
          let applied = false;

          if (blockIdx >= 0) {
            const range = findMeta2BlockRange(md, blockIdx);
            if (range) {
              const [start, end] = range;
              const lines = md.split("\n");
              const openLine = lines[start] ?? "```meta2";
              const langMatch = /```\s*(meta2|meta)\b/.exec(openLine);
              const lang = langMatch?.[1] ?? "meta2";
              const newFence = [`\`\`\`${lang}`, newJsonLine, "```"];
              lines.splice(start, end - start + 1, ...newFence);
              v.setValue(lines.join("\n"));
              applied = true;
            }
          }

          if (!applied && rawJson && md.includes(rawJson)) {
            v.setValue(md.replace(rawJson, newJsonLine));
            applied = true;
          }

          if (!applied) {
            const lines = md.split("\n");
            if (
              lineNo >= 1 &&
              lineNo < lines.length &&
              FLOW_OPEN_FENCE.test(lines[lineNo - 1] ?? "") &&
              lines.slice(lineNo + 1).some((l) => /^\s*```\s*$/.test(l ?? ""))
            ) {
              let closeIdx = -1;
              for (let k = lineNo + 1; k < lines.length; k++) {
                if (/^\s*```\s*$/.test(lines[k] ?? "")) {
                  closeIdx = k;
                  break;
                }
              }
              if (closeIdx > lineNo) {
                const langMatch = /```\s*(meta2|meta)\b/.exec(lines[lineNo - 1] ?? "");
                const lang = langMatch?.[1] ?? "meta2";
                const newFence = [`\`\`\`${lang}`, newJsonLine, "```"];
                lines.splice(lineNo - 1, closeIdx - (lineNo - 1) + 1, ...newFence);
                v.setValue(lines.join("\n"));
                applied = true;
              }
            }
          }

          if (!applied) {
            const oldStr = JSON.stringify(priorData);
            if (md.includes(oldStr)) {
              v.setValue(md.replace(oldStr, newJsonLine));
            }
          }
        }

        setEditingFlowData(null);
        setEditingLineNumber(-1);
        setEditingBlockIndex(-1);
        setEditingRawJson("");
      },
      [props.canEdit],
    );

    const handleFlowCancel = useCallback(() => {
      setFlowModalOpen(false);
      setEditingFlowData(null);
      setEditingLineNumber(-1);
      setEditingBlockIndex(-1);
      setEditingRawJson("");
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        openInsertFlowEditor() {
          setEditingFlowData(null);
          setEditingLineNumber(-1);
          setEditingBlockIndex(-1);
          setEditingRawJson("");
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
              setEditingBlockIndex(-1);
              setEditingRawJson("");
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
          flowKey={editingFlowData === null ? "flow-insert" : `flow-edit-${editingBlockIndex}-${editingLineNumber}`}
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
