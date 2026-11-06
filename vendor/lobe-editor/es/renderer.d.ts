import { Klass, LexicalNode, SerializedEditorState, SerializedLexicalNode } from "lexical";
import * as _$react_jsx_runtime0 from "react/jsx-runtime";
import { CSSProperties, JSX, ReactElement, ReactNode } from "react";

//#region src/renderer/diff/style.d.ts
type DiffAppearance = 'borderless' | 'default';
//#endregion
//#region src/renderer/diff/types.d.ts
type LexicalDiffRowKind = 'delete' | 'equal' | 'insert' | 'modify';
interface LexicalDiffCell {
  baseBlockType: string | null;
  /** Decorated block for diff UI (may include inline delete/insert styles). */
  block: SerializedLexicalNode | null;
  blockType: string | null;
  /** Undecorated source block — use this when accepting / writing back to the editor. */
  sourceBlock: SerializedLexicalNode | null;
}
interface LexicalDiffRow {
  kind: LexicalDiffRowKind;
  newCell: LexicalDiffCell | null;
  oldCell: LexicalDiffCell | null;
}
interface LexicalDiffBlockRenderContext {
  baseBlockType: string | null;
  blockType: string | null;
  newBaseBlockType: string | null;
  newBlockType: string | null;
  oldBaseBlockType: string | null;
  oldBlockType: string | null;
  renderDefaultNew: () => ReactNode;
  renderDefaultOld: () => ReactNode;
  row: LexicalDiffRow;
}
type LexicalDiffBlockRenderer = (context: LexicalDiffBlockRenderContext) => {
  new?: ReactNode;
  old?: ReactNode;
} | null;
//#endregion
//#region src/renderer/diff/compute.d.ts
declare function computeLexicalDiffRows(oldState: SerializedEditorState, newState: SerializedEditorState): LexicalDiffRow[];
//#endregion
//#region src/renderer/engine/shiki.d.ts
declare function loadLanguage(language: string): Promise<void>;
//#endregion
//#region src/renderer/types.d.ts
type NodeRenderer = (node: Record<string, any>, key: string, children: ReactNode[] | null) => ReactNode;
type RendererRegistry = Map<string, NodeRenderer>;
interface LexicalRendererContext {
  extra?: Record<string, unknown>;
}
interface HeadlessRenderContext extends LexicalRendererContext {
  children: ReactNode[] | null;
  key: string;
  variant?: 'default' | 'chat';
}
interface HeadlessRenderableNode {
  renderHeadless(context: HeadlessRenderContext): ReactNode;
}
interface LexicalRendererProps {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  extraNodes?: Array<Klass<LexicalNode>>;
  overrides?: Record<string, NodeRenderer>;
  renderContext?: LexicalRendererContext;
  style?: CSSProperties;
  value: SerializedEditorState;
  variant?: 'default' | 'chat';
}
//#endregion
//#region src/renderer/LexicalDiff.d.ts
interface LexicalDiffProps {
  appearance?: DiffAppearance;
  blockRenderers?: Record<string, LexicalDiffBlockRenderer>;
  className?: string;
  extraNodes?: LexicalRendererProps['extraNodes'];
  labels?: {
    new?: ReactNode;
    old?: ReactNode;
  };
  newValue: SerializedEditorState;
  oldValue: SerializedEditorState;
  overrides?: LexicalRendererProps['overrides'];
  renderBlockDiff?: LexicalDiffBlockRenderer;
  renderContext?: LexicalRendererProps['renderContext'];
  style?: CSSProperties;
  variant?: LexicalRendererProps['variant'];
}
declare function LexicalDiff({
  oldValue,
  newValue,
  variant,
  appearance,
  extraNodes,
  overrides,
  renderContext,
  labels,
  blockRenderers,
  renderBlockDiff,
  className,
  style
}: LexicalDiffProps): _$react_jsx_runtime0.JSX.Element;
//#endregion
//#region src/renderer/LexicalRenderer.d.ts
declare function LexicalRenderer({
  value,
  overrides,
  extraNodes,
  renderContext,
  as: Tag,
  className,
  style,
  variant
}: LexicalRendererProps): ReactElement;
//#endregion
//#region src/renderer/nodes/index.d.ts
declare const rendererNodes: Array<Klass<LexicalNode>>;
//#endregion
//#region src/renderer/renderers/index.d.ts
declare function createDefaultRenderers(): RendererRegistry;
//#endregion
export { type DiffAppearance, type HeadlessRenderContext, type HeadlessRenderableNode, LexicalDiff, type LexicalDiffBlockRenderContext, type LexicalDiffBlockRenderer, type LexicalDiffCell, type LexicalDiffProps, type LexicalDiffRow, type LexicalDiffRowKind, LexicalRenderer, type LexicalRendererContext, type LexicalRendererProps, type NodeRenderer, type RendererRegistry, computeLexicalDiffRows, createDefaultRenderers, loadLanguage, rendererNodes };