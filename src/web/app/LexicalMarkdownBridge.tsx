/**
 * 隐藏编辑器：将 Lexical JSON 导出为 Markdown（供 Merge 三栏使用）。
 * 插件集须与 DocumentEditor 正文节点对齐，否则 list/table 等节点反序列化会丢，
 * merge 里「别人的」会被截成标题后空白。
 */
import { useEffect, useRef, useState } from "react";
import {
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMarkdownPlugin,
  ReactMarkmapPlugin,
  ReactMathPlugin,
  ReactMeta2dPlugin,
  ReactTablePlugin,
  type IEditor,
} from "@lobehub/editor";
import { Editor } from "@lobehub/editor/react";

interface LexicalMarkdownBridgeProps {
  lexicalJson: string;
  onMarkdown: (md: string) => void;
  onError?: () => void;
}

/** 与 DocumentEditor 一致：能 round-trip 正文节点的插件（不含 Toolbar / File） */
const BRIDGE_PLUGINS = [
  ReactMarkdownPlugin,
  ReactListPlugin,
  ReactLinkPlugin,
  ReactImagePlugin,
  ReactCodemirrorPlugin,
  ReactHRPlugin,
  ReactTablePlugin,
  ReactMathPlugin,
  ReactMeta2dPlugin,
  ReactMarkmapPlugin,
  ReactCodePlugin,
];

function detectContentType(content: string): "json" | "markdown" {
  try {
    const parsed = JSON.parse(content) as { root?: { children?: unknown[] } };
    return parsed?.root?.children ? "json" : "markdown";
  } catch {
    return "markdown";
  }
}

export function LexicalMarkdownBridge({
  lexicalJson,
  onMarkdown,
  onError,
}: LexicalMarkdownBridgeProps) {
  const [editor, setEditor] = useState<IEditor | null>(null);
  const exportedRef = useRef(false);
  const contentType = detectContentType(lexicalJson);

  useEffect(() => {
    exportedRef.current = false;
  }, [lexicalJson]);

  // 已是 markdown（极少见）：无需进编辑器
  useEffect(() => {
    if (contentType !== "markdown" || exportedRef.current) return;
    exportedRef.current = true;
    onMarkdown(lexicalJson);
  }, [contentType, lexicalJson, onMarkdown]);

  useEffect(() => {
    if (contentType !== "json" || !editor || exportedRef.current) return;
    let cancelled = false;

    const runExport = (): void => {
      if (cancelled || exportedRef.current) return;
      try {
        editor.setDocument("json", lexicalJson);
        const md = editor.getDocument("markdown");
        if (typeof md === "string") {
          exportedRef.current = true;
          onMarkdown(md);
        }
      } catch {
        if (!cancelled) onError?.();
      }
    };

    // 与 DocumentEditor handleInit 一致：等 DataSource 就绪后再 set/get
    queueMicrotask(() => {
      queueMicrotask(() => {
        if (cancelled) return;
        try {
          runExport();
        } catch {
          requestAnimationFrame(() => {
            if (!cancelled) runExport();
          });
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [editor, lexicalJson, contentType, onMarkdown, onError]);

  if (contentType === "markdown") {
    return null;
  }

  return (
    <div className="mdocs-lexical-md-bridge" aria-hidden>
      <Editor
        content={lexicalJson}
        type="json"
        editable={false}
        onInit={setEditor}
        plugins={BRIDGE_PLUGINS}
      />
    </div>
  );
}
