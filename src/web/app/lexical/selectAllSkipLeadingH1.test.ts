import { describe, expect, it } from "vitest";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  createEditor,
  ParagraphNode,
  SELECT_ALL_COMMAND,
  TextNode,
} from "lexical";
import { $createHeadingNode, HeadingNode } from "@lexical/rich-text";
import { applySelectAllSkipLeadingH1 } from "./selectAllSkipLeadingH1";

function makeTestEditor() {
  return createEditor({
    namespace: "selectAllSkipH1Test",
    nodes: [HeadingNode, ParagraphNode, TextNode],
    onError: (e) => {
      throw e;
    },
  });
}

function selectedText(): string {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return "";
  return sel.getTextContent();
}

describe("applySelectAllSkipLeadingH1", () => {
  it("skips leading h1 when selection is in body", async () => {
    const editor = makeTestEditor();
    await editor.update(() => {
      const root = $getRoot();
      root.clear();
      const h1 = $createHeadingNode("h1");
      h1.append($createTextNode("Title"));
      const p = $createParagraphNode();
      p.append($createTextNode("Body one"));
      const p2 = $createParagraphNode();
      p2.append($createTextNode("Body two"));
      root.append(h1, p, p2);
      p.select(0, 0);
    });
    await editor.update(() => {
      expect(applySelectAllSkipLeadingH1()).toBe(true);
      expect(selectedText().replace(/\n/g, "")).toBe("Body oneBody two");
    });
  });

  it("selects only h1 when anchor is in h1", async () => {
    const editor = makeTestEditor();
    await editor.update(() => {
      const root = $getRoot();
      root.clear();
      const h1 = $createHeadingNode("h1");
      h1.append($createTextNode("Title"));
      const p = $createParagraphNode();
      p.append($createTextNode("Body"));
      root.append(h1, p);
      h1.select(0, 0);
    });
    await editor.update(() => {
      expect(applySelectAllSkipLeadingH1()).toBe(true);
      expect(selectedText()).toBe("Title");
    });
  });

  it("returns false when first block is not h1", async () => {
    const editor = makeTestEditor();
    await editor.update(() => {
      const root = $getRoot();
      root.clear();
      const p = $createParagraphNode();
      p.append($createTextNode("Only"));
      root.append(p);
      p.select(0, 0);
    });
    await editor.update(() => {
      expect(applySelectAllSkipLeadingH1()).toBe(false);
    });
  });

  it("registers with SELECT_ALL_COMMAND via priority", async () => {
    const editor = makeTestEditor();
    let handled = false;
    editor.registerCommand(
      SELECT_ALL_COMMAND,
      () => {
        handled = applySelectAllSkipLeadingH1();
        return handled;
      },
      COMMAND_PRIORITY_HIGH,
    );
    await editor.update(() => {
      const root = $getRoot();
      root.clear();
      const h1 = $createHeadingNode("h1");
      h1.append($createTextNode("T"));
      const p = $createParagraphNode();
      p.append($createTextNode("B"));
      root.append(h1, p);
      p.selectEnd();
      handled = applySelectAllSkipLeadingH1();
    });
    expect(handled).toBe(true);
    editor.getEditorState().read(() => {
      expect(selectedText()).toBe("B");
    });
  });
});
