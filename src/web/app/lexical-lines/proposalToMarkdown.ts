/**
 * 将按块提案合成完整 Markdown，供 live Editor overwriteAll 使用。
 */
import { createHeadlessEditor } from "@lobehub/editor";

import {
  buildProposedEditorState,
  type LexicalLinesMode,
} from "./buildProposedLexical";

export function proposalToMarkdown(
  baseLexicalJson: string,
  mode: LexicalLinesMode,
  lines: Record<string, string>,
  fullMarkdown?: string,
): string {
  if (mode === "replace_all" && typeof fullMarkdown === "string" && fullMarkdown.length > 0) {
    return fullMarkdown;
  }
  const state = buildProposedEditorState(baseLexicalJson, mode, lines, fullMarkdown);
  const editor = createHeadlessEditor();
  try {
    editor.hydrateEditorData(state);
    return editor.export().markdown ?? "";
  } finally {
    editor.destroy();
  }
}
