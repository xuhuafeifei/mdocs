import { useEffect, useRef, type MutableRefObject } from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState, Range, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType, keymap, lineNumbers } from "@codemirror/view";
import { useI18n } from "../../i18n";
import {
  assembleMergedMarkdown,
  isConflictPlaceholderLine,
  type ConflictResolution,
  type MergeConflictSegment,
  type MergeSegment,
} from "./merge-plan";

type ConflictLabels = {
  paneLocal: string;
  paneRemote: string;
  paneBase: string;
  acceptLocal: string;
  acceptRemote: string;
  acceptBoth: string;
  acceptManual: string;
};

type MergeUiMeta = {
  segments: MergeSegment[];
  labels: ConflictLabels;
  onResolve: (id: string, resolution: ConflictResolution, manualLines?: string[]) => void;
};

const setMergeUiEffect = StateEffect.define<MergeUiMeta>();

const mergeUiField = StateField.define<MergeUiMeta>({
  create: () => ({
    segments: [],
    labels: {
      paneLocal: "",
      paneRemote: "",
      paneBase: "",
      acceptLocal: "",
      acceptRemote: "",
      acceptBoth: "",
      acceptManual: "",
    },
    onResolve: () => {},
  }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setMergeUiEffect)) return effect.value;
    }
    return value;
  },
});

class ConflictWidget extends WidgetType {
  constructor(
    private readonly conflict: MergeConflictSegment,
    private readonly labels: ConflictLabels,
    private readonly onResolve: MergeUiMeta["onResolve"],
  ) {
    super();
  }

  eq(other: ConflictWidget): boolean {
    return other.conflict.id === this.conflict.id && other.conflict.resolution === this.conflict.resolution;
  }

  get block(): boolean {
    return true;
  }

  get estimatedHeight(): number {
    const lines = Math.max(
      this.conflict.baseLines.length,
      this.conflict.localLines.length,
      this.conflict.remoteLines.length,
      1,
    );
    return 88 + lines * 20;
  }

  toDOM(view?: EditorView): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "mdocs-merge-inline-conflict";

    const chunks = document.createElement("div");
    chunks.className = "mdocs-merge-inline-chunks";

    const baseBlock = document.createElement("div");
    baseBlock.className = "mdocs-merge-chunk mdocs-merge-chunk-base";
    baseBlock.innerHTML = `<div class="mdocs-merge-chunk-label">${this.labels.paneBase}</div><pre class="mdocs-merge-chunk-body">${escapeHtml(this.conflict.baseLines.join("\n") || " ")}</pre>`;

    const localBlock = document.createElement("div");
    localBlock.className = "mdocs-merge-chunk mdocs-merge-chunk-local";
    localBlock.innerHTML = `<div class="mdocs-merge-chunk-label">${this.labels.paneLocal}</div><pre class="mdocs-merge-chunk-body">${escapeHtml(this.conflict.localLines.join("\n") || " ")}</pre>`;

    const remoteBlock = document.createElement("div");
    remoteBlock.className = "mdocs-merge-chunk mdocs-merge-chunk-remote";
    remoteBlock.innerHTML = `<div class="mdocs-merge-chunk-label">${this.labels.paneRemote}</div><pre class="mdocs-merge-chunk-body">${escapeHtml(this.conflict.remoteLines.join("\n") || " ")}</pre>`;

    chunks.append(baseBlock, localBlock, remoteBlock);

    const actions = document.createElement("div");
    actions.className = "mdocs-merge-inline-actions";

    const mkBtn = (
      label: string,
      resolution: ConflictResolution,
      active: boolean,
      manualLines?: string[],
    ) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (active) btn.className = "active";
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onResolve(this.conflict.id, resolution, manualLines);
      });
      return btn;
    };

    actions.append(
      mkBtn(this.labels.acceptLocal, "local", this.conflict.resolution === "local"),
      mkBtn(this.labels.acceptRemote, "remote", this.conflict.resolution === "remote"),
      mkBtn(this.labels.acceptBoth, "both", this.conflict.resolution === "both"),
      mkBtn(this.labels.acceptManual, "manual", this.conflict.resolution === "manual", [
        ...this.conflict.localLines,
        ...this.conflict.remoteLines,
      ]),
    );

    wrap.append(chunks, actions);
    if (view) {
      queueMicrotask(() => view.requestMeasure());
    }
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildConflictDecorations(meta: MergeUiMeta, doc: EditorState["doc"]): DecorationSet {
  const builder: Range<Decoration>[] = [];
  const conflicts = meta.segments.filter((s): s is MergeConflictSegment => s.kind === "conflict");

  for (let lineNo = 1; lineNo <= doc.lines; lineNo += 1) {
    const line = doc.line(lineNo);
    const id = isConflictPlaceholderLine(line.text);
    if (!id) continue;
    const conflict = conflicts.find((c) => c.id === id);
    if (!conflict || conflict.resolution !== "unresolved") continue;
    builder.push(
      Decoration.replace({
        widget: new ConflictWidget(conflict, meta.labels, meta.onResolve),
        block: true,
      }).range(line.from, line.to),
    );
  }

  return Decoration.set(builder, true);
}

const conflictDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    return buildConflictDecorations(state.field(mergeUiField), state.doc);
  },
  update(deco, tr) {
    if (tr.docChanged || tr.effects.some((e) => e.is(setMergeUiEffect))) {
      return buildConflictDecorations(tr.state.field(mergeUiField), tr.state.doc);
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const editorTheme = EditorView.theme({
  "&": { height: "100%" },
  ".cm-scroller": { fontFamily: "ui-monospace, monospace", fontSize: "13px" },
  ".cm-line": { lineHeight: "1.5", padding: "0 2px" },
  ".cm-gutterElement": { lineHeight: "1.5" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-line:has(.mdocs-merge-inline-conflict)": { padding: 0, lineHeight: "normal" },
});

function dispatchMergeUi(view: EditorView, meta: MergeUiMeta, doc?: string): void {
  const effects: StateEffect<unknown>[] = [setMergeUiEffect.of(meta)];
  if (doc !== undefined) {
    const cur = view.state.doc.toString();
    if (cur !== doc) {
      view.dispatch({
        changes: { from: 0, to: cur.length, insert: doc },
        effects,
      });
      return;
    }
  }
  view.dispatch({ effects });
}

export function MergeResultEditor(props: {
  segments: MergeSegment[];
  onResolve: (id: string, resolution: ConflictResolution, manualLines?: string[]) => void;
  onDocumentEdited?: () => void;
  getTextRef?: MutableRefObject<(() => string) | null>;
}) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onResolveRef = useRef(props.onResolve);
  onResolveRef.current = props.onResolve;

  const labels: ConflictLabels = {
    paneLocal: t("mergeLocal"),
    paneRemote: t("mergeRemote"),
    paneBase: t("mergeBase"),
    acceptLocal: t("mergeAcceptLocal"),
    acceptRemote: t("mergeAcceptRemote"),
    acceptBoth: t("mergeAcceptBoth"),
    acceptManual: t("mergeAcceptManual"),
  };

  const assembled = assembleMergedMarkdown(props.segments);

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return;

    const meta: MergeUiMeta = {
      segments: props.segments,
      labels,
      onResolve: (id, res, manual) => onResolveRef.current(id, res, manual),
    };

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: assembled,
        extensions: [
          lineNumbers(),
          history(),
          editorTheme,
          mergeUiField,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          conflictDecorationsField,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) props.onDocumentEdited?.();
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (props.getTextRef) {
      props.getTextRef.current = () => view.state.doc.toString();
    }

    dispatchMergeUi(view, meta);

    return () => {
      if (props.getTextRef) props.getTextRef.current = null;
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const meta: MergeUiMeta = {
      segments: props.segments,
      labels,
      onResolve: (id, res, manual) => onResolveRef.current(id, res, manual),
    };
    dispatchMergeUi(view, meta, assembled);
  }, [assembled, props.segments, labels]);

  return <div ref={hostRef} className="mdocs-merge-cm-host mdocs-merge-result-cm" />;
}
