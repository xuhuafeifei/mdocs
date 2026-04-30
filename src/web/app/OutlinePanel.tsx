"use client";

import { $isHeadingNode } from "@lexical/rich-text";
import {
  $createNodeSelection,
  $getRoot,
  $isElementNode,
  $setSelection,
  LexicalEditor,
} from "lexical";
import { type FC, useCallback, useEffect, useState } from "react";

import type { IEditor } from "@lobehub/editor";

interface HeadingItem {
  key: string;
  level: number;
  text: string;
}

interface OutlinePanelProps {
  editor: IEditor;
}

const noop = () => {};

const OutlinePanel: FC<OutlinePanelProps> = ({ editor }) => {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  const $buildHeadings = useCallback(() => {
    const items: HeadingItem[] = [];
    const root = $getRoot();

    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if ($isHeadingNode(node)) {
          const text = node.getTextContent().trim();
          if (text) {
            items.push({
              key: node.getKey(),
              level: parseInt(node.getTag()[1], 10),
              text,
            });
          }
        }
        if ($isElementNode(node)) {
          const children = node.getChildren();
          if (children.length > 0) {
            walk(children);
          }
        }
      }
    };
    walk(root.getChildren());

    setHeadings(items);
  }, []);

  useEffect(() => {
    const lexicalEditor = editor.getLexicalEditor();
    let cleanup: () => void = noop;

    const handleLexicalEditor = (lexicalEditor: LexicalEditor) => {
      cleanup = lexicalEditor.registerUpdateListener(({ editorState }) => {
        editorState.read($buildHeadings);
      });
      lexicalEditor.getEditorState().read($buildHeadings);
      return cleanup;
    };

    if (lexicalEditor) {
      return handleLexicalEditor(lexicalEditor);
    }

    editor.on("initialized", handleLexicalEditor as any);
    return () => {
      cleanup();
      editor.off("initialized", handleLexicalEditor as any);
    };
  }, [editor, $buildHeadings]);

  const handleClick = useCallback(
    (key: string) => {
      const lexicalEditor = editor.getLexicalEditor();
      if (!lexicalEditor) return;

      lexicalEditor.update(() => {
        const selection = $createNodeSelection();
        selection.add(key);
        $setSelection(selection);
      });

      requestAnimationFrame(() => {
        const element = lexicalEditor.getElementByKey(key);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    },
    [editor],
  );

  if (headings.length === 0) return null;

  return (
    <div className="mdocs-outline">
      <div className="mdocs-outline-title">OUTLINE</div>
      {headings.map((h) => (
        <button
          type="button"
          key={h.key}
          className="mdocs-outline-item"
          style={{ paddingLeft: (h.level - 1) * 16 + 8 }}
          onClick={() => handleClick(h.key)}
        >
          {h.text}
        </button>
      ))}
    </div>
  );
};

export default OutlinePanel;
