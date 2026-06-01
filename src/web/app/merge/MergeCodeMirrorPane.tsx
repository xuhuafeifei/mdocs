import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";

const readOnlyTheme = EditorView.theme({
  "&": { height: "100%" },
  ".cm-scroller": { fontFamily: "ui-monospace, monospace", fontSize: "13px" },
});

export function MergeCodeMirrorPane(props: {
  doc: string;
  readOnly?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return;

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: props.doc,
        extensions: [
          lineNumbers(),
          readOnlyTheme,
          EditorView.editable.of(!props.readOnly),
          EditorState.readOnly.of(Boolean(props.readOnly)),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const cur = view.state.doc.toString();
    if (cur !== props.doc) {
      view.dispatch({
        changes: { from: 0, to: cur.length, insert: props.doc },
      });
    }
  }, [props.doc]);

  return <div ref={hostRef} className={props.className ?? "mdocs-merge-cm-host"} />;
}
