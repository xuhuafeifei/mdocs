/**
 * 隐藏编辑器：将 Lexical JSON 导出为 Markdown（供 Merge 三栏使用）。
 */
import { useEffect, useRef, useState } from "react";
import { Editor } from "@lobehub/editor/react";
import { ReactMarkdownPlugin, type IEditor } from "@lobehub/editor";

interface LexicalMarkdownBridgeProps {
  lexicalJson: string;
  onMarkdown: (md: string) => void;
  onError?: () => void;
}

export function LexicalMarkdownBridge({
  lexicalJson,
  onMarkdown,
  onError,
}: LexicalMarkdownBridgeProps) {
  const [editor, setEditor] = useState<IEditor | null>(null);
  const exportedRef = useRef(false);

  useEffect(() => {
    exportedRef.current = false;
  }, [lexicalJson]);

  useEffect(() => {
    if (!editor || exportedRef.current) return;
    try {
      editor.setDocument("json", lexicalJson);
      const md = editor.getDocument("markdown");
      if (typeof md === "string") {
        exportedRef.current = true;
        onMarkdown(md);
      }
    } catch {
      onError?.();
    }
  }, [editor, lexicalJson, onMarkdown, onError]);

  return (
    <div className="mdocs-lexical-md-bridge" aria-hidden>
      <Editor
        content={lexicalJson}
        type="json"
        editable={false}
        onInit={setEditor}
        plugins={[ReactMarkdownPlugin]}
      />
    </div>
  );
}
