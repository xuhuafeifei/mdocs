import { $ as HotkeysEvent, A as $createCursorNode, B as IDecorator, C as ReactEditorContent, D as MarkmapWithErrorBoundary, E as MermaidWithErrorBoundary, F as IMapNode, G as IPlugin, H as IEditor, I as countNodes, J as ILocaleKeys, K as ISelectionObject, L as setFoldAll, M as $isCursorNode, N as CardLikeElementNode, O as CommonPlugin, P as cursorNodeSerialized, Q as HotkeyOptions, R as INSERT_HEADING_COMMAND, S as ReactPlainText, T as ReactPlainTextProps, U as IEditorKernel, V as IDocumentOptions, W as IEditorPluginConstructor, Y as enUS, Z as zhCN, a as ReactSlashOptionProps, at as HotkeyScopeId, b as MentionNode, c as ITriggerContext, ct as DataSource, d as ISlashMenuOption, et as getHotkeyById, f as ISlashOption, g as ChatInputActionItem, i as MenuRenderProps, it as HotkeyScopeEnum, j as $isCardLikeElementNode, k as CommonPluginOptions, l as SlashPlugin, m as SlashOptions, n as ReactSlashOption, nt as HotkeyId, o as ReactSlashPluginProps, ot as KeyEnum, p as ISlashService, q as IServiceID, r as SlashMenu, rt as HotkeyItem, s as SlashMenuProps, st as ModifierCombination, t as ReactSlashPlugin, tt as HotkeyEnum, u as SlashPluginOptions, v as ReactMentionPlugin, w as ReactEditorContentProps, x as SerializedMentionNode, y as ReactMentionPluginProps, z as INSERT_QUOTE_COMMAND } from "./index-B8hrjelq.js";
import { HistoryState, HistoryStateEntry } from "@lexical/history";
import { InsertTableCommandPayloadHeaders } from "@lexical/table";
import EventEmitter from "eventemitter3";
import * as _$lexical from "lexical";
import { BaseSelection, CommandListener, CommandListenerPriority, CommandPayloadType, DOMConversionMap, DOMExportOutput, DecoratorNode, EditorConfig, EditorState, EditorThemeClasses, ElementNode, LexicalCommand, LexicalEditor, LexicalNode, LexicalNodeConfig, LexicalUpdateJSON, NodeKey, RangeSelection, SerializedEditorState, SerializedElementNode, SerializedLexicalNode, SerializedRootNode, SerializedTextNode, Spread, TextFormatType, TextNode, resetRandomKey } from "lexical";
import createDebug from "debug";
import React, { CSSProperties, FC, JSX, PropsWithChildren, ReactNode } from "react";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND, UPDATE_LIST_START_COMMAND } from "@lexical/list";
//#region src/editor-kernel/utils.d.ts
declare const DOM_ELEMENT_TYPE = 1;
declare const DOM_TEXT_TYPE = 3;
declare const DOM_DOCUMENT_TYPE = 9;
declare const DOM_DOCUMENT_FRAGMENT_TYPE = 11;
declare function genServiceId<T>(name: string): IServiceID<T>;
declare const noop: () => void;
declare function createEmptyEditorState(): _$lexical.EditorState;
declare function assert(cond?: boolean, message?: string): asserts cond;
declare function getNodeKeyFromDOMNode(dom: Node, editor: LexicalEditor): NodeKey | undefined;
declare function $getNodeFromDOMNode(dom: Node, editor: LexicalEditor, editorState?: ReturnType<LexicalEditor['getEditorState']>): LexicalNode | null;
/**
 * @param x - The element being tested
 * @returns Returns true if x is a DOM Node, false otherwise.
 */
declare function isDOMNode(x: unknown): x is Node;
/**
 * @param x - The element being testing
 * @returns Returns true if x is a document fragment, false otherwise.
 */
declare function isDocumentFragment(x: unknown): x is DocumentFragment;
declare function getParentElement(node: Node): HTMLElement | null;
declare function $getNearestNodeFromDOMNode(startingDOM: Node, editor: LexicalEditor, editorState?: ReturnType<LexicalEditor['getEditorState']>): LexicalNode | null;
declare function getKernelFromEditor(editor: LexicalEditor): IEditorKernel;
declare const EDITOR_THEME_KEY = "__editorId";
declare function generateEditorId(): string;
declare function registerEditorKernel(id: string, kernel: IEditorKernel): void;
declare function unregisterEditorKernel(id: string): void;
declare function getKernelFromEditorConfig(config: EditorConfig): IEditorKernel | null;
/**
 *
 * @param nodeA
 * @param nodeB
 * @returns
 */
declare function compareNodeOrder(nodeA: LexicalNode, nodeB: LexicalNode): number;
declare function $closest(node: LexicalNode | ElementNode | null, test: (node: LexicalNode) => boolean): LexicalNode | null;
declare function $closestNodeType(node: LexicalNode | ElementNode | null, type: string | string[]): LexicalNode | null;
declare function moment(): Promise<unknown>;
declare function reconcileDecorator(activeEditor: LexicalEditor, key: NodeKey, decorator: unknown): void;
//#endregion
//#region src/editor-kernel/event.d.ts
declare const HOVER_COMMAND: _$lexical.LexicalCommand<MouseEvent>;
//#endregion
//#region src/editor-kernel/react/LexicalErrorBoundary.d.ts
type LexicalErrorBoundaryProps = {
  children: JSX.Element;
  onError: (error: unknown) => void;
};
declare function LexicalErrorBoundary({
  children,
  onError
}: LexicalErrorBoundaryProps): JSX.Element;
//#endregion
//#region src/editor-kernel/react/PortalContainer.d.ts
interface PortalContainerProps {
  children: React.ReactNode;
  className?: string;
  editor: LexicalEditor;
  node: LexicalNode;
  style?: React.CSSProperties;
}
declare const LexicalPortalContainer: React.ForwardRefExoticComponent<PortalContainerProps & React.RefAttributes<HTMLDivElement | null>>;
//#endregion
//#region src/editor-kernel/react/react-context.d.ts
type LexicalComposerContextType = {
  getTheme: () => EditorThemeClasses | null | undefined;
};
type LexicalComposerContextWithEditor = [IEditor, LexicalComposerContextType];
declare function useLexicalComposerContext(): LexicalComposerContextWithEditor;
//#endregion
//#region src/editor-kernel/react/react-editor.d.ts
interface IReactEditorProps {
  children?: ReactNode | undefined;
  /** Editor configuration */
  config?: Record<string, any>;
  /** Editor instance to use */
  editor?: IEditor;
  /** Callback called when editor is initialized */
  onInit?: (editor: IEditor) => void;
}
declare const ReactEditor: FC<IReactEditorProps>;
//#endregion
//#region src/editor-kernel/react/useLexicalEditor.d.ts
declare function useLexicalEditor(handleEditor: (lexicalEditor: LexicalEditor) => (() => void) | undefined, deps?: any[]): void;
//#endregion
//#region src/headless/index.d.ts
type HeadlessDocumentType = 'json' | 'markdown' | (string & object);
interface HeadlessEditorHydrationInput {
  content: unknown;
  options?: IDocumentOptions;
  type: HeadlessDocumentType;
}
interface HeadlessEditorExportOptions {}
interface HeadlessEditorExport {
  editorData: SerializedEditorState<SerializedLexicalNode>;
  markdown: string;
}
interface HeadlessEditorOptions {
  additionalPlugins?: ReadonlyArray<IPlugin>;
  initialValue?: HeadlessEditorHydrationInput;
  plugins?: ReadonlyArray<IPlugin>;
}
declare const DEFAULT_HEADLESS_EDITOR_PLUGINS: ReadonlyArray<IPlugin>;
declare class HeadlessEditor {
  readonly kernel: IEditor;
  constructor(options?: HeadlessEditorOptions);
  hydrate(input: HeadlessEditorHydrationInput): this;
  hydrateEditorData(editorData: SerializedEditorState<SerializedLexicalNode> | string, options?: IDocumentOptions): this;
  hydrateMarkdown(markdown: string, options?: IDocumentOptions): this;
  export(_options?: HeadlessEditorExportOptions): HeadlessEditorExport;
  exportState(options?: HeadlessEditorExportOptions): HeadlessEditorExport;
  destroy(): void;
}
declare function createHeadlessEditor(options?: HeadlessEditorOptions): HeadlessEditor;
//#endregion
//#region src/plugins/auto-complete/plugin/index.d.ts
interface AutoCompletePluginOptions {
  /** Delay in milliseconds before triggering auto-complete (default: 1000ms) */
  delay?: number;
  onAutoComplete?: (opt: {
    abortSignal: AbortSignal;
    afterText: string;
    editor: IEditor;
    input: string;
    selectionType: string;
  }) => Promise<string | null>;
  theme?: {
    placeholderBlock?: string;
    placeholderInline?: string;
  };
}
declare const AutoCompletePlugin: IEditorPluginConstructor<AutoCompletePluginOptions>;
//#endregion
//#region src/plugins/auto-complete/react/type.d.ts
interface ReactAutoCompletePluginProps {
  delay?: number;
  onAutoComplete?: (opt: {
    abortSignal: AbortSignal;
    afterText: string;
    editor: IEditor;
    input: string;
    selectionType: string;
  }) => Promise<string | null>;
}
//#endregion
//#region src/plugins/auto-complete/react/ReactAutoCompletePlugin.d.ts
declare const ReactAutoCompletePlugin: FC<ReactAutoCompletePluginProps>;
//#endregion
//#region src/plugins/code/command/index.d.ts
declare const INSERT_CODEINLINE_COMMAND: _$lexical.LexicalCommand<undefined>;
//#endregion
//#region src/plugins/code/plugin/index.d.ts
interface CodePluginOptions {
  enableHotkey?: boolean;
  theme?: string;
}
declare const CodePlugin: IEditorPluginConstructor<CodePluginOptions>;
//#endregion
//#region src/plugins/code/react/type.d.ts
interface ReactCodePluginProps {
  className?: string;
  enableHotkey?: boolean;
}
//#endregion
//#region src/plugins/code/react/CodeReactPlugin.d.ts
declare const ReactCodePlugin: FC<ReactCodePluginProps>;
//#endregion
//#region src/editor-kernel/inode/i-element-node.d.ts
type IElementNode = SerializedElementNode;
//#endregion
//#region src/editor-kernel/inode/i-node.d.ts
type INode = SerializedLexicalNode;
//#endregion
//#region src/editor-kernel/inode/root-node.d.ts
/**
 * Root node
 */
type IRootNode = SerializedRootNode;
//#endregion
//#region src/editor-kernel/inode/text-node.d.ts
/**
 * Text node
 */
type ITextNode = SerializedTextNode;
//#endregion
//#region src/plugins/codeblock/command/index.d.ts
declare const UPDATE_CODEBLOCK_LANG: _$lexical.LexicalCommand<{
  lang: string;
}>;
//#endregion
//#region src/plugins/codeblock/plugin/index.d.ts
interface CodeblockPluginOptions {
  /** Shiki theme name to use for syntax highlighting */
  shikiTheme?: string | {
    dark: string;
    light: string;
  };
  /** Custom CSS theme configuration */
  theme?: {
    code?: string;
  };
}
declare const CodeblockPlugin: IEditorPluginConstructor<CodeblockPluginOptions>;
//#endregion
//#region src/plugins/codeblock/react/type.d.ts
interface ReactCodeblockPluginProps extends CodeblockPluginOptions {
  className?: string;
  shikiTheme?: string;
}
//#endregion
//#region src/plugins/codeblock/react/ReactCodeblockPlugin.d.ts
declare const ReactCodeblockPlugin: FC<ReactCodeblockPluginProps>;
//#endregion
//#region node_modules/.pnpm/@types+unist@3.0.3/node_modules/@types/unist/index.d.ts
// ## Interfaces
/**
 * Info associated with nodes by the ecosystem.
 *
 * This space is guaranteed to never be specified by unist or specifications
 * implementing unist.
 * But you can use it in utilities and plugins to store data.
 *
 * This type can be augmented to register custom data.
 * For example:
 *
 * ```ts
 * declare module 'unist' {
 *   interface Data {
 *     // `someNode.data.myId` is typed as `number | undefined`
 *     myId?: number | undefined
 *   }
 * }
 * ```
 */
interface Data$1 {}
/**
 * One place in a source file.
 */
interface Point {
  /**
   * Line in a source file (1-indexed integer).
   */
  line: number;
  /**
   * Column in a source file (1-indexed integer).
   */
  column: number;
  /**
   * Character in a source file (0-indexed integer).
   */
  offset?: number | undefined;
}
/**
 * Position of a node in a source document.
 *
 * A position is a range between two points.
 */
interface Position {
  /**
   * Place of the first character of the parsed source region.
   */
  start: Point;
  /**
   * Place of the first character after the parsed source region.
   */
  end: Point;
}
/**
 * Abstract unist node.
 *
 * The syntactic unit in unist syntax trees are called nodes.
 *
 * This interface is supposed to be extended.
 * If you can use {@link Literal} or {@link Parent}, you should.
 * But for example in markdown, a `thematicBreak` (`***`), is neither literal
 * nor parent, but still a node.
 */
interface Node$2 {
  /**
   * Node type.
   */
  type: string;
  /**
   * Info from the ecosystem.
   */
  data?: Data$1 | undefined;
  /**
   * Position of a node in a source document.
   *
   * Nodes that are generated (not in the original source document) must not
   * have a position.
   */
  position?: Position | undefined;
}
//#endregion
//#region node_modules/.pnpm/@shikijs+vscode-textmate@10.0.2/node_modules/@shikijs/vscode-textmate/dist/index.d.ts
declare const ruleIdSymbol: unique symbol;
type RuleId = {
  __brand: typeof ruleIdSymbol;
};
interface IRawGrammar extends ILocatable {
  repository: IRawRepository;
  readonly scopeName: ScopeName;
  readonly patterns: IRawRule[];
  readonly injections?: {
    [expression: string]: IRawRule;
  };
  readonly injectionSelector?: string;
  readonly fileTypes?: string[];
  readonly name?: string;
  readonly firstLineMatch?: string;
}
/**
 * Allowed values:
 * * Scope Name, e.g. `source.ts`
 * * Top level scope reference, e.g. `source.ts#entity.name.class`
 * * Relative scope reference, e.g. `#entity.name.class`
 * * self, e.g. `$self`
 * * base, e.g. `$base`
 */
type IncludeString = string;
type RegExpString = string | RegExp;
interface IRawRepositoryMap {
  [name: string]: IRawRule;
}
type IRawRepository = IRawRepositoryMap & ILocatable;
interface IRawRule extends ILocatable {
  id?: RuleId;
  readonly include?: IncludeString;
  readonly name?: ScopeName;
  readonly contentName?: ScopeName;
  readonly match?: RegExpString;
  readonly captures?: IRawCaptures;
  readonly begin?: RegExpString;
  readonly beginCaptures?: IRawCaptures;
  readonly end?: RegExpString;
  readonly endCaptures?: IRawCaptures;
  readonly while?: RegExpString;
  readonly whileCaptures?: IRawCaptures;
  readonly patterns?: IRawRule[];
  readonly repository?: IRawRepository;
  readonly applyEndPatternLast?: boolean;
}
type IRawCaptures = IRawCapturesMap & ILocatable;
interface IRawCapturesMap {
  [captureId: string]: IRawRule;
}
interface ILocation {
  readonly filename: string;
  readonly line: number;
  readonly char: number;
}
interface ILocatable {
  readonly $vscodeTextmateLocation?: ILocation;
}
/**
 * Identifiers with a binary dot operator.
 * Examples: `baz` or `foo.bar`
*/
type ScopeName = string;
/**
 * An expression language of ScopeNames with a binary space (to indicate nesting) operator.
 * Examples: `foo.bar boo.baz`
*/
//#endregion
//#region node_modules/.pnpm/@shikijs+types@3.23.0/node_modules/@shikijs/types/dist/index.d.mts
type Awaitable<T> = T | Promise<T>;
type MaybeGetter<T> = Awaitable<MaybeModule<T>> | (() => Awaitable<MaybeModule<T>>);
type MaybeModule<T> = T | {
  default: T;
};
type MaybeArray<T> = T | T[];
type LanguageInput = MaybeGetter<MaybeArray<LanguageRegistration>>;
interface LanguageRegistration extends IRawGrammar {
  name: string;
  scopeName: string;
  displayName?: string;
  aliases?: string[];
  /**
   * A list of languages the current language embeds.
   * If manually specifying languages to load, make sure to load the embedded
   * languages for each parent language.
   */
  embeddedLangs?: string[];
  embeddedLanguages?: string[];
  /**
   * A list of languages that embed the current language.
   * Unlike `embeddedLangs`, the embedded languages will not be loaded automatically.
   */
  embeddedLangsLazy?: string[];
  balancedBracketSelectors?: string[];
  unbalancedBracketSelectors?: string[];
  foldingStopMarker?: string;
  foldingStartMarker?: string;
  /**
   * Inject this language to other scopes.
   * Same as `injectTo` in VSCode's `contributes.grammars`.
   *
   * @see https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#injection-grammars
   */
  injectTo?: string[];
}
//#endregion
//#region src/plugins/codeblock/supported-shiki-languages.d.ts
/**
 * Curated Shiki languages for @fgbg/lobe-editor.
 *
 * Do NOT import `bundledLanguagesInfo` from `shiki` — that module references
 * every language and forces Vite to emit ~300+ lang chunks. Only list langs
 * here with explicit `import('@shikijs/langs/...')` so the build stays lean.
 *
 * Unknown fence languages fall back to plaintext (content is preserved).
 */
type SupportedLanguageInfo = {
  aliases?: string[];
  id: string;
  import: () => Promise<LanguageInput>;
  name: string;
};
/** Canonical ids kept for syntax highlighting (aliases documented in each entry). */
declare const SUPPORTED_SHIKI_LANGUAGE_IDS: readonly ["markdown", "mdx", "javascript", "typescript", "jsx", "tsx", "html", "css", "scss", "less", "vue", "svelte", "json", "jsonc", "yaml", "toml", "xml", "ini", "python", "java", "kotlin", "go", "rust", "c", "cpp", "csharp", "ruby", "php", "swift", "lua", "shellscript", "shellsession", "powershell", "docker", "nginx", "make", "cmake", "sql", "graphql", "diff", "proto", "wasm"];
declare const supportedLanguagesInfo: SupportedLanguageInfo[];
//#endregion
//#region src/plugins/codemirror-block/command/index.d.ts
declare const INSERT_CODEMIRROR_COMMAND: _$lexical.LexicalCommand<unknown>;
declare const SELECT_BEFORE_CODEMIRROR_COMMAND: _$lexical.LexicalCommand<{
  key: string;
}>;
declare const SELECT_AFTER_CODEMIRROR_COMMAND: _$lexical.LexicalCommand<{
  key: string;
}>;
//#endregion
//#region src/plugins/codemirror-block/node/CodeMirrorNode.d.ts
interface CodeMirrorOptions {
  indentWithTabs: boolean;
  lineNumbers: boolean;
  tabSize: number;
}
type SerializedCodeMirrorNode = Spread<{
  code: string;
  codeTheme: string;
  language: string;
  options: {
    indentWithTabs: boolean;
    lineNumbers: boolean;
    tabSize: number;
  };
}, SerializedLexicalNode>;
declare class CodeMirrorNode extends DecoratorNode<any> {
  private __lang;
  private __code;
  private __codeTheme;
  private __options;
  static getType(): string;
  static clone(node: CodeMirrorNode): CodeMirrorNode;
  static importJSON(serializedNode: SerializedCodeMirrorNode): CodeMirrorNode;
  static importDOM(): DOMConversionMap | null;
  constructor(lang: string, code: string, codeTheme: string, options: CodeMirrorOptions, key?: string);
  get lang(): string;
  get code(): string;
  get codeTheme(): string;
  get options(): CodeMirrorOptions;
  exportDOM(editor: LexicalEditor): DOMExportOutput;
  exportJSON(): SerializedCodeMirrorNode;
  setLang(lang: string): this;
  setCode(code: string): this;
  setCodeTheme(codeTheme: string): this;
  setTabSize(tabSize: number): this;
  setIndentWithTabs(indentWithTabs: boolean): this;
  setLineNumbers(lineNumbers: boolean): this;
  createDOM(config: EditorConfig): HTMLElement;
  getTextContent(): string;
  isInline(): false;
  updateDOM(): boolean;
  decorate(editor: LexicalEditor): any;
}
//#endregion
//#region src/plugins/codemirror-block/plugin/index.d.ts
interface CodemirrorPluginOptions {
  decorator: (node: CodeMirrorNode, editor: LexicalEditor) => any;
  theme?: string;
}
declare const CodemirrorPlugin: IEditorPluginConstructor<CodemirrorPluginOptions>;
//#endregion
//#region src/plugins/codemirror-block/react/type.d.ts
interface ReactCodemirrorPluginProps {
  className?: string;
}
//#endregion
//#region src/plugins/codemirror-block/react/ReactCodemirrorNode.d.ts
declare const ReactCodemirrorPlugin: FC<ReactCodemirrorPluginProps>;
//#endregion
//#region src/plugins/diff/node/DiffHunkNode.d.ts
type DiffHunkKind = 'update' | 'delete' | 'insert';
type SerializedDiffHunkNode = Spread<{
  kind: DiffHunkKind; /** Serialized original block for reject / delete restore. */
  oldBlock: SerializedLexicalNode | null;
  opId: string;
}, SerializedElementNode>;
/**
 * Top-level ElementNode hunk:
 * - children[0] = DiffChrome (buttons + optional red old text)
 * - children[1..] = editable block content (new for update/insert, old body for delete)
 */
declare class DiffHunkNode extends ElementNode {
  __opId: string;
  __kind: DiffHunkKind;
  __oldBlock: SerializedLexicalNode | null;
  static getType(): string;
  static clone(node: DiffHunkNode): DiffHunkNode;
  static importJSON(serializedNode: SerializedDiffHunkNode): DiffHunkNode;
  constructor(opId: string, kind: DiffHunkKind, oldBlock: SerializedLexicalNode | null, key?: NodeKey);
  get opId(): string;
  get kind(): DiffHunkKind;
  get oldBlock(): SerializedLexicalNode | null;
  createDOM(config: EditorConfig): HTMLElement;
  updateDOM(prev: DiffHunkNode, dom: HTMLElement): boolean;
  exportDOM(): DOMExportOutput;
  exportJSON(): SerializedDiffHunkNode;
  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedDiffHunkNode>): this;
  canBeEmpty(): false;
}
declare function $createDiffHunkNode(payload: {
  kind: DiffHunkKind;
  oldBlock?: SerializedLexicalNode | null;
  opId: string;
}): DiffHunkNode;
declare function $isDiffHunkNode(node: LexicalNode | null | undefined): node is DiffHunkNode;
//#endregion
//#region src/plugins/diff/command/index.d.ts
type DiffOpPayload = {
  kind: 'update';
  newBlock: SerializedLexicalNode;
  slot?: number;
} | {
  kind: 'delete';
  slot?: number;
} | {
  afterSlot?: number;
  kind: 'insert_after';
  newBlock: SerializedLexicalNode;
};
declare const APPLY_DIFF_OP_COMMAND: _$lexical.LexicalCommand<DiffOpPayload>;
declare const ACCEPT_DIFF_OP_COMMAND: _$lexical.LexicalCommand<string>;
declare const REJECT_DIFF_OP_COMMAND: _$lexical.LexicalCommand<string>;
declare function acceptDiffOp(editor: LexicalEditor, opId: string): void;
declare function rejectDiffOp(editor: LexicalEditor, opId: string): void;
declare function acceptAllDiffOps(editor: LexicalEditor): void;
declare function rejectAllDiffOps(editor: LexicalEditor): void;
declare function hasPendingDiff(editor: LexicalEditor): boolean;
/** Host publish gate: block when any DiffHunk is pending. */
declare function assertCanPublish(editor: LexicalEditor): {
  ok: true;
} | {
  ok: false;
  error: string;
};
/** @deprecated use acceptDiffOp */
declare function acceptDiffHunkByKey(editor: LexicalEditor, key: string): void;
/** @deprecated use rejectDiffOp */
declare function rejectDiffHunkByKey(editor: LexicalEditor, key: string): void;
//#endregion
//#region src/plugins/diff/api.d.ts
type DiffApiResult = {
  ok: true;
} | {
  ok: false;
  error: string;
};
type FlattenMode = 'keep' | 'reject';
/** Pure: strip DiffHunk from serialized state (does not mutate the live editor). */
declare function flattenCanonicalState(state: SerializedEditorState, mode?: FlattenMode): SerializedEditorState;
declare function getCanonicalEditorState(editor: LexicalEditor, mode?: FlattenMode): SerializedEditorState;
declare function updateSlot(editor: LexicalEditor, slot: number, md: string): DiffApiResult;
declare function insertAfterSlot(editor: LexicalEditor, slot: number, md: string): DiffApiResult;
declare function removeSlot(editor: LexicalEditor, slot: number): DiffApiResult;
/**
 * Full-document propose (approach B): LCS current vs md → multiple DiffHunks.
 * Any pending hunks are Undo All'd first so LCS runs against the restored base.
 */
declare function overwriteAll(editor: LexicalEditor, md: string): DiffApiResult;
/**
 * Same as overwriteAll, but new side is already Lexical JSON.
 * Prefer this for batch_update_slots: avoid Lexical→MD→Lexical round-trip that
 * rewrites every unchanged block and paints the whole doc as modified.
 */
declare function overwriteAllFromState(editor: LexicalEditor, newState: SerializedEditorState): DiffApiResult;
/** Mutate live tree via accept/reject all. Prefer getCanonicalEditorState for export. */
declare function materializeCanonical(editor: LexicalEditor, mode: FlattenMode): void;
//#endregion
//#region src/plugins/diff/node/DiffChromeNode.d.ts
type SerializedDiffChromeNode = Spread<{
  kind: DiffHunkKind;
  oldText: string;
  opId: string;
}, SerializedLexicalNode>;
/** Toolbar + optional red "old" preview inside a DiffHunk ElementNode. */
declare class DiffChromeNode extends DecoratorNode<unknown> {
  __opId: string;
  __kind: DiffHunkKind;
  __oldText: string;
  static getType(): string;
  static clone(node: DiffChromeNode): DiffChromeNode;
  static importJSON(serializedNode: SerializedDiffChromeNode): DiffChromeNode;
  constructor(opId: string, kind: DiffHunkKind, oldText: string, key?: string);
  get opId(): string;
  get kind(): DiffHunkKind;
  get oldText(): string;
  createDOM(config: EditorConfig): HTMLElement;
  updateDOM(): boolean;
  exportDOM(): DOMExportOutput;
  isInline(): false;
  isKeyboardSelectable(): boolean;
  getTextContent(): string;
  exportJSON(): SerializedDiffChromeNode;
  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedDiffChromeNode>): this;
  decorate(editor: LexicalEditor): unknown;
}
declare function $createDiffChromeNode(payload: {
  kind: DiffHunkKind;
  oldText?: string;
  opId: string;
}): DiffChromeNode;
declare function $isDiffChromeNode(node: LexicalNode | null | undefined): node is DiffChromeNode;
//#endregion
//#region src/plugins/diff/plugin/index.d.ts
interface DiffPluginOptions {
  decorator: (node: DiffChromeNode, editor: LexicalEditor) => unknown;
  theme?: string;
}
declare const DiffPlugin: IEditorPluginConstructor<DiffPluginOptions>;
//#endregion
//#region src/plugins/diff/react/type.d.ts
type ReactDiffPluginProps = {
  className?: string;
};
//#endregion
//#region src/plugins/diff/react/ReactDiffPlugin.d.ts
/**
 * Register during render (useMemo) before ReactPlainText setRootElement.
 * Top bar: ▲/▼ + Keep All / Undo All; hover a hunk → Keep/Undo under it.
 */
declare const ReactDiffPlugin: FC<ReactDiffPluginProps>;
//#endregion
//#region src/plugins/diff/utils/sample-block.d.ts
/** Demo helper: plain paragraph serialized block. */
declare function makeParagraphBlock(text: string): SerializedLexicalNode;
declare function blockPlainText(block: SerializedLexicalNode | null | undefined): string;
//#endregion
//#region src/plugins/file/command/index.d.ts
declare const INSERT_FILE_COMMAND: _$lexical.LexicalCommand<{
  file: File;
}>;
//#endregion
//#region src/plugins/file/node/FileNode.d.ts
type SerializedFileNode = Spread<{
  fileUrl?: string;
  message?: string;
  name: string;
  size?: number;
  status?: 'pending' | 'uploaded' | 'error';
}, SerializedLexicalNode>;
declare class FileNode extends DecoratorNode<any> {
  static getType(): string;
  static clone(node: FileNode): FileNode;
  static importJSON(serializedNode: SerializedFileNode): FileNode;
  static importDOM(): DOMConversionMap | null;
  __name: string;
  __fileUrl: string | undefined;
  __size: number | undefined;
  __status: 'pending' | 'uploaded' | 'error';
  __message?: string;
  get name(): string;
  get fileUrl(): string | undefined;
  get size(): number | undefined;
  get status(): 'pending' | 'uploaded' | 'error';
  get message(): string | undefined;
  constructor(name: string, fileUrl?: string, size?: number, status?: 'pending' | 'uploaded' | 'error', message?: string, key?: string);
  setUploaded(url: string): void;
  setError(message: string): void;
  exportDOM(): DOMExportOutput;
  createDOM(config: EditorConfig): HTMLElement;
  exportJSON(): SerializedFileNode;
  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedFileNode>): this;
  getTextContent(): string;
  updateDOM(): boolean;
  decorate(editor: LexicalEditor): any;
}
//#endregion
//#region src/plugins/file/utils/matchFile.d.ts
interface FileMatchOptions {
  /** Extensions without dot, e.g. `zip`, `mp3`. Case-insensitive. */
  allowedExtensions?: string[];
  /**
   * Exact MIME types, or prefixes ending with `/` (e.g. `audio/`).
   * Empty / omitted together with extensions means accept all.
   */
  allowedMimeTypes?: string[];
}
//#endregion
//#region src/plugins/file/plugin/index.d.ts
interface FilePluginOptions extends FileMatchOptions {
  decorator: (node: FileNode, editor: LexicalEditor) => any;
  handleUpload: (file: File) => Promise<{
    url: string;
  }>;
  markdownWriter?: (file: FileNode) => string;
  theme?: {
    file?: string;
  };
}
declare const FilePlugin: IEditorPluginConstructor<FilePluginOptions>;
//#endregion
//#region src/plugins/file/react/type.d.ts
interface ReactFilePluginProps extends FileMatchOptions {
  className?: string;
  handleUpload: (file: File) => Promise<{
    url: string;
  }>;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
  markdownWriter?: (file: FileNode) => string;
  theme?: {
    file?: string;
  };
}
//#endregion
//#region src/plugins/file/react/ReactFilePlugin.d.ts
declare const ReactFilePlugin: FC<ReactFilePluginProps>;
//#endregion
//#region src/plugins/hr/command/index.d.ts
declare const INSERT_HORIZONTAL_RULE_COMMAND: _$lexical.LexicalCommand<unknown>;
//#endregion
//#region src/plugins/hr/node/HorizontalRuleNode.d.ts
type SerializedHorizontalRuleNode = SerializedLexicalNode;
declare class HorizontalRuleNode extends DecoratorNode<any> {
  static getType(): string;
  static clone(node: HorizontalRuleNode): HorizontalRuleNode;
  static importJSON(serializedNode: SerializedHorizontalRuleNode): HorizontalRuleNode;
  static importDOM(): DOMConversionMap | null;
  exportDOM(): DOMExportOutput;
  createDOM(config: EditorConfig): HTMLElement;
  getTextContent(): string;
  isInline(): false;
  updateDOM(): boolean;
  decorate(editor: LexicalEditor): any;
}
//#endregion
//#region src/plugins/hr/plugin/index.d.ts
interface HRPluginOptions {
  decorator: (node: HorizontalRuleNode, editor: LexicalEditor) => any;
  theme?: string;
}
declare const HRPlugin: IEditorPluginConstructor<HRPluginOptions>;
//#endregion
//#region src/plugins/hr/react/type.d.ts
interface ReactHRPluginProps {
  className?: string;
}
//#endregion
//#region src/plugins/hr/react/ReactHRPlugin.d.ts
declare const ReactHRPlugin: FC<ReactHRPluginProps>;
//#endregion
//#region src/plugins/image/command/index.d.ts
declare const INSERT_IMAGE_COMMAND: _$lexical.LexicalCommand<{
  block?: boolean;
  file: File;
  maxWidth?: number;
  range?: Range | null;
}>;
//#endregion
//#region src/plugins/image/node/basie-image-node.d.ts
type SerializedImageNode = Spread<{
  altText: string;
  height?: number;
  maxWidth: number;
  src: string;
  status?: 'uploaded' | 'loading' | 'error';
  width?: number;
}, SerializedLexicalNode>;
declare class BaseImageNode extends DecoratorNode<any> {
  __src: string;
  __altText: string;
  __width: 'inherit' | number;
  __height: 'inherit' | number;
  __maxWidth: number;
  static clone(node: BaseImageNode): BaseImageNode;
  static importJSON(serializedNode: SerializedImageNode): BaseImageNode;
  static getType(): string;
  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedImageNode>): this;
  exportDOM(): DOMExportOutput;
  constructor(src: string, altText: string, maxWidth: number, width?: 'inherit' | number, height?: 'inherit' | number, key?: NodeKey);
  exportJSON(): SerializedImageNode;
  setWidthAndHeight(width: 'inherit' | number, height: 'inherit' | number): void;
  isInline(): boolean;
  createDOM(config: EditorConfig): HTMLElement;
  updateDOM(): false;
  getSrc(): string;
  getAltText(): string;
}
//#endregion
//#region src/plugins/image/node/block-image-node.d.ts
declare class BlockImageNode extends BaseImageNode {
  private static _decorate;
  static setDecorate(decorate: (node: BlockImageNode) => any): void;
  static getType(): string;
  private __loading;
  private __status;
  private __message;
  private __extra;
  get isLoading(): boolean;
  get status(): 'uploaded' | 'loading' | 'error';
  get message(): string | null;
  get src(): string;
  get altText(): string;
  get maxWidth(): number;
  get width(): number | string;
  get height(): number | string;
  constructor(opt: {
    altText: string;
    height?: 'inherit' | number;
    key?: NodeKey;
    maxWidth: number;
    src: string;
    status?: 'uploaded' | 'loading' | 'error';
    width?: 'inherit' | number;
  });
  isInline(): boolean;
  setMaxWidth(maxWidth: number): void;
  setWidth(width: number): void;
  setStatus(status: 'uploaded' | 'loading' | 'error'): void;
  setUploaded(url: string): void;
  setError(message: string): void;
  static clone(node: BlockImageNode): BlockImageNode;
  static importJSON(serializedNode: SerializedImageNode): BlockImageNode;
  static importDOM(): DOMConversionMap | null;
  decorate(): any;
  createDOM(config: EditorConfig): HTMLElement;
}
//#endregion
//#region src/plugins/image/node/image-node.d.ts
declare class ImageNode extends BaseImageNode {
  private static _decorate;
  static setDecorate(decorate: (node: ImageNode) => any): void;
  static getType(): string;
  private __loading;
  private __status;
  private __message;
  private __extra;
  constructor(opt: {
    altText: string;
    height?: 'inherit' | number;
    key?: NodeKey;
    maxWidth: number;
    src: string;
    status?: 'uploaded' | 'loading' | 'error';
    width?: 'inherit' | number;
  });
  get isLoading(): boolean;
  get status(): 'uploaded' | 'loading' | 'error';
  get message(): string | null;
  get src(): string;
  get altText(): string;
  get maxWidth(): number;
  get width(): number | string;
  get height(): number | string;
  setMaxWidth(maxWidth: number): void;
  setStatus(status: 'uploaded' | 'loading' | 'error'): void;
  setWidth(width: number): void;
  setUploaded(url: string): void;
  setError(message: string): void;
  static clone(node: ImageNode): ImageNode;
  static importJSON(serializedNode: SerializedImageNode): ImageNode;
  static importDOM(): DOMConversionMap | null;
  decorate(): any;
}
//#endregion
//#region src/plugins/image/plugin/index.d.ts
interface ImagePluginOptions {
  defaultBlockImage?: boolean;
  handleRehost?: (url: string) => Promise<{
    url: string;
  }>;
  handleUpload: (file: File) => Promise<{
    url: string;
  }>;
  needRehost?: (url: string) => boolean;
  renderImage: (node: ImageNode | BlockImageNode) => JSX.Element | null;
  theme?: {
    blockImage?: string;
    image?: string;
  };
}
declare const ImagePlugin: IEditorPluginConstructor<ImagePluginOptions>;
//#endregion
//#region src/plugins/image/react/type.d.ts
interface ReactImagePluginProps {
  className?: string;
  /** Click image to open antd-style fullscreen preview. Default `true`. */
  enableImagePreview?: boolean;
  defaultBlockImage?: boolean;
  handleRehost?: (url: string) => Promise<{
    url: string;
  }>;
  handleUpload?: (file: File) => Promise<{
    url: string;
  }>;
  needRehost?: (url: string) => boolean;
  /**
   * Custom file picker for environments where programmatic input.click() is blocked (e.g. Electron).
   * When provided, this will be called instead of triggering the hidden file input.
   */
  onPickFile?: () => Promise<File | null>;
  theme?: {
    blockImage?: string;
    image?: string;
  };
}
//#endregion
//#region src/plugins/image/react/ReactImagePlugin.d.ts
declare const ReactImagePlugin: FC<ReactImagePluginProps>;
//#endregion
//#region src/plugins/inode/plugin/index.d.ts
/**
 * NodePluginOptions - Configuration options for the Node plugin
 */
interface INodePluginOptions {
  /**
   * Enable or disable the node data source
   * @default true
   */
  enabled?: boolean;
}
declare const INodePlugin: IEditorPluginConstructor<INodePluginOptions>;
//#endregion
//#region src/plugins/inode/react/index.d.ts
declare const ReactNodePlugin: FC<void>;
//#endregion
//#region src/plugins/inode/service/index.d.ts
interface INodeService {
  processNodeTree(inode: {
    root: IRootNode;
  }): void;
  registerProcessNodeTree(process: (inode: {
    root: IRootNode;
  }) => void): void;
}
/**
 * Service ID for Node service
 */
declare const INodeService: IServiceID<INodeService>;
//#endregion
//#region src/plugins/link/command/index.d.ts
declare const INSERT_LINK_COMMAND: _$lexical.LexicalCommand<{
  title?: string;
  url?: string;
}>;
//#endregion
//#region src/plugins/link/node/LinkNode.d.ts
type LinkAttributes = {
  rel?: null | string;
  target?: null | string;
  title?: null | string;
};
//#endregion
//#region src/plugins/link/plugin/index.d.ts
interface LinkPluginOptions {
  attributes?: LinkAttributes;
  enableHotkey?: boolean;
  linkRegex?: RegExp;
  theme?: {
    link?: string;
  };
  validateUrl?: (url: string) => boolean;
}
declare const LinkPlugin: IEditorPluginConstructor<LinkPluginOptions>;
//#endregion
//#region src/plugins/link/react/type.d.ts
interface ReactLinkPluginProps {
  attributes?: LinkAttributes;
  className?: string;
  enableHotkey?: boolean;
  theme?: {
    link?: string;
  };
  validateUrl?: (url: string) => boolean;
}
//#endregion
//#region src/plugins/link/react/ReactLinkPlugin.d.ts
declare const ReactLinkPlugin: FC<ReactLinkPluginProps>;
//#endregion
//#region src/plugins/link/service/i-link-service.d.ts
interface ILinkService {
  setLinkToolbar(enable: boolean): void;
}
declare const ILinkService: IServiceID<ILinkService>;
//#endregion
//#region src/plugins/link-highlight/command/index.d.ts
declare const INSERT_LINK_HIGHLIGHT_COMMAND: _$lexical.LexicalCommand<undefined>;
declare function registerLinkHighlightCommand(editor: LexicalEditor): () => void;
//#endregion
//#region src/plugins/link-highlight/plugin/index.d.ts
interface LinkHighlightPluginOptions {
  enableHotkey?: boolean;
  /**
   * Enable auto-highlight when pasting URLs
   * @default true
   */
  enablePasteAutoHighlight?: boolean;
  theme?: string;
  /**
   * Custom URL validation regex
   */
  urlRegex?: RegExp;
}
declare const LinkHighlightPlugin: IEditorPluginConstructor<LinkHighlightPluginOptions>;
//#endregion
//#region src/plugins/link-highlight/react/type.d.ts
interface ReactLinkHighlightPluginProps {
  className?: string;
  /**
   * Enable keyboard shortcut (Ctrl+K / Cmd+K)
   * @default true
   */
  enableHotkey?: boolean;
  /**
   * Enable auto-highlight when pasting URLs
   * @default true
   */
  enablePasteAutoHighlight?: boolean;
}
//#endregion
//#region src/plugins/link-highlight/react/ReactLinkHighlightPlugin.d.ts
declare const ReactLinkHighlightPlugin: FC<ReactLinkHighlightPluginProps>;
//#endregion
//#region src/plugins/list/plugin/checkList.d.ts
declare const INSERT_CHECK_LIST_COMMAND: LexicalCommand<void>;
//#endregion
//#region src/plugins/list/plugin/index.d.ts
interface ListPluginOptions {
  enableHotkey?: boolean;
  theme?: string;
}
declare const ListPlugin: IEditorPluginConstructor<ListPluginOptions>;
//#endregion
//#region src/plugins/list/react/type.d.ts
interface ReactListPluginProps {
  className?: string;
  enableHotkey?: boolean;
}
//#endregion
//#region src/plugins/list/react/ReactListPlugin.d.ts
declare const ReactListPlugin: FC<ReactListPluginProps>;
//#endregion
//#region node_modules/.pnpm/@types+mdast@4.0.4/node_modules/@types/mdast/index.d.ts
// ## Enumeration
/**
 * How phrasing content is aligned
 * ({@link https://drafts.csswg.org/css-text/ | [CSSTEXT]}).
 *
 * * `'left'`: See the
 *   {@link https://drafts.csswg.org/css-text/#valdef-text-align-left | left}
 *   value of the `text-align` CSS property
 * * `'right'`: See the
 *   {@link https://drafts.csswg.org/css-text/#valdef-text-align-right | right}
 *   value of the `text-align` CSS property
 * * `'center'`: See the
 *   {@link https://drafts.csswg.org/css-text/#valdef-text-align-center | center}
 *   value of the `text-align` CSS property
 * * `null`: phrasing content is aligned as defined by the host environment
 *
 * Used in GFM tables.
 */
type AlignType = "center" | "left" | "right" | null;
/**
 * Explicitness of a reference.
 *
 * `'shortcut'`: the reference is implicit, its identifier inferred from its
 *   content
 * `'collapsed'`: the reference is explicit, its identifier inferred from its
 *   content
 * `'full'`: the reference is explicit, its identifier explicitly set
 */
type ReferenceType = "shortcut" | "collapsed" | "full";
// ## Mixin
/**
 * Node with a fallback.
 */
interface Alternative {
  /**
   * Equivalent content for environments that cannot represent the node as
   * intended.
   */
  alt?: string | null | undefined;
}
/**
 * Internal relation from one node to another.
 *
 * Whether the value of `identifier` is expected to be a unique identifier or
 * not depends on the type of node including the Association.
 * An example of this is that they should be unique on {@link Definition},
 * whereas multiple {@link LinkReference}s can be non-unique to be associated
 * with one definition.
 */
interface Association {
  /**
   * Relation of association.
   *
   * `identifier` is a source value: character escapes and character
   * references are not parsed.
   *
   * It can match another node.
   *
   * Its value must be normalized.
   * To normalize a value, collapse markdown whitespace (`[\t\n\r ]+`) to a space,
   * trim the optional initial and/or final space, and perform Unicode-aware
   * case-folding.
   */
  identifier: string;
  /**
   * Relation of association, in parsed form.
   *
   * `label` is a `string` value: it works just like `title` on {@link Link}
   * or a `lang` on {@link Code}: character escapes and character references
   * are parsed.
   *
   * It can match another node.
   */
  label?: string | null | undefined;
}
/**
 * Marker that is associated to another node.
 */
interface Reference extends Association {
  /**
   * Explicitness of the reference.
   */
  referenceType: ReferenceType;
}
/**
 * Reference to resource.
 */
interface Resource {
  /**
   * URL to the referenced resource.
   */
  url: string;
  /**
   * Advisory information for the resource, such as would be appropriate for
   * a tooltip.
   */
  title?: string | null | undefined;
}
// ## Interfaces
/**
 * Info associated with mdast nodes by the ecosystem.
 *
 * This space is guaranteed to never be specified by unist or mdast.
 * But you can use it in utilities and plugins to store data.
 *
 * This type can be augmented to register custom data.
 * For example:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface Data {
 *     // `someNode.data.myId` is typed as `number | undefined`
 *     myId?: number | undefined
 *   }
 * }
 * ```
 */
interface Data extends Data$1 {}
// ## Content maps
/**
 * Union of registered mdast nodes that can occur where block content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link BlockContentMap}.
 * They will be automatically added here.
 */
type BlockContent = BlockContentMap[keyof BlockContentMap];
/**
 * Registry of all mdast nodes that can occur where {@link BlockContent} is
 * expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface BlockContentMap {
 *     // Allow using MDX ESM nodes defined by `remark-mdx`.
 *     mdxjsEsm: MdxjsEsm;
 *   }
 * }
 * ```
 *
 * For a union of all block content, see {@link RootContent}.
 */
interface BlockContentMap {
  blockquote: Blockquote;
  code: Code;
  heading: Heading;
  html: Html;
  list: List;
  paragraph: Paragraph;
  table: Table;
  thematicBreak: ThematicBreak;
}
/**
 * Union of registered mdast nodes that can occur where definition content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link DefinitionContentMap}.
 * They will be automatically added here.
 */
type DefinitionContent = DefinitionContentMap[keyof DefinitionContentMap];
/**
 * Registry of all mdast nodes that can occur where {@link DefinitionContent}
 * is expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface DefinitionContentMap {
 *     custom: Custom;
 *   }
 * }
 * ```
 *
 * For a union of all definition content, see {@link RootContent}.
 */
interface DefinitionContentMap {
  definition: Definition;
  footnoteDefinition: FootnoteDefinition;
}
/**
 * Union of registered mdast nodes that can occur where list content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link ListContentMap}.
 * They will be automatically added here.
 */
type ListContent = ListContentMap[keyof ListContentMap];
/**
 * Registry of all mdast nodes that can occur where {@link ListContent}
 * is expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface ListContentMap {
 *     custom: Custom;
 *   }
 * }
 * ```
 *
 * For a union of all list content, see {@link RootContent}.
 */
interface ListContentMap {
  listItem: ListItem;
}
/**
 * Union of registered mdast nodes that can occur where phrasing content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link PhrasingContentMap}.
 * They will be automatically added here.
 */
type PhrasingContent = PhrasingContentMap[keyof PhrasingContentMap];
/**
 * Registry of all mdast nodes that can occur where {@link PhrasingContent}
 * is expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface PhrasingContentMap {
 *     // Allow using MDX JSX (text) nodes defined by `remark-mdx`.
 *     mdxJsxTextElement: MDXJSXTextElement;
 *   }
 * }
 * ```
 *
 * For a union of all phrasing content, see {@link RootContent}.
 */
interface PhrasingContentMap {
  break: Break;
  delete: Delete;
  emphasis: Emphasis;
  footnoteReference: FootnoteReference;
  html: Html;
  image: Image;
  imageReference: ImageReference;
  inlineCode: InlineCode;
  link: Link;
  linkReference: LinkReference;
  strong: Strong;
  text: Text;
}
/**
 * Union of registered mdast nodes that can occur in {@link Root}.
 *
 * To register custom mdast nodes, add them to {@link RootContentMap}.
 * They will be automatically added here.
 */
type RootContent = RootContentMap[keyof RootContentMap];
/**
 * Registry of all mdast nodes that can occur as children of {@link Root}.
 *
 * > **Note**: {@link Root} does not need to be an entire document.
 * > it can also be a fragment.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface RootContentMap {
 *     // Allow using toml nodes defined by `remark-frontmatter`.
 *     toml: TOML;
 *   }
 * }
 * ```
 *
 * For a union of all {@link Root} children, see {@link RootContent}.
 */
interface RootContentMap {
  blockquote: Blockquote;
  break: Break;
  code: Code;
  definition: Definition;
  delete: Delete;
  emphasis: Emphasis;
  footnoteDefinition: FootnoteDefinition;
  footnoteReference: FootnoteReference;
  heading: Heading;
  html: Html;
  image: Image;
  imageReference: ImageReference;
  inlineCode: InlineCode;
  link: Link;
  linkReference: LinkReference;
  list: List;
  listItem: ListItem;
  paragraph: Paragraph;
  strong: Strong;
  table: Table;
  tableCell: TableCell;
  tableRow: TableRow;
  text: Text;
  thematicBreak: ThematicBreak;
  yaml: Yaml;
}
/**
 * Union of registered mdast nodes that can occur where row content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link RowContentMap}.
 * They will be automatically added here.
 */
type RowContent = RowContentMap[keyof RowContentMap];
/**
 * Registry of all mdast nodes that can occur where {@link RowContent}
 * is expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface RowContentMap {
 *     custom: Custom;
 *   }
 * }
 * ```
 *
 * For a union of all row content, see {@link RootContent}.
 */
interface RowContentMap {
  tableCell: TableCell;
}
/**
 * Union of registered mdast nodes that can occur where table content is
 * expected.
 *
 * To register custom mdast nodes, add them to {@link TableContentMap}.
 * They will be automatically added here.
 */
type TableContent = TableContentMap[keyof TableContentMap];
/**
 * Registry of all mdast nodes that can occur where {@link TableContent}
 * is expected.
 *
 * This interface can be augmented to register custom node types:
 *
 * ```ts
 * declare module 'mdast' {
 *   interface TableContentMap {
 *     custom: Custom;
 *   }
 * }
 * ```
 *
 * For a union of all table content, see {@link RootContent}.
 */
interface TableContentMap {
  tableRow: TableRow;
}
// ## Abstract nodes
/**
 * Abstract mdast node that contains the smallest possible value.
 *
 * This interface is supposed to be extended if you make custom mdast nodes.
 *
 * For a union of all registered mdast literals, see {@link Literals}.
 */
interface Literal extends Node$1 {
  /**
   * Plain-text value.
   */
  value: string;
}
/**
 * Abstract mdast node.
 *
 * This interface is supposed to be extended.
 * If you can use {@link Literal} or {@link Parent}, you should.
 * But for example in markdown, a thematic break (`***`) is neither literal nor
 * parent, but still a node.
 *
 * To register custom mdast nodes, add them to {@link RootContentMap} and other
 * places where relevant (such as {@link ElementContentMap}).
 *
 * For a union of all registered mdast nodes, see {@link Nodes}.
 */
interface Node$1 extends Node$2 {
  /**
   * Info from the ecosystem.
   */
  data?: Data | undefined;
}
/**
 * Abstract mdast node that contains other mdast nodes (*children*).
 *
 * This interface is supposed to be extended if you make custom mdast nodes.
 *
 * For a union of all registered mdast parents, see {@link Parents}.
 */
interface Parent extends Node$1 {
  /**
   * List of children.
   */
  children: RootContent[];
}
// ## Concrete nodes
/**
 * Markdown block quote.
 */
interface Blockquote extends Parent {
  /**
   * Node type of mdast block quote.
   */
  type: "blockquote";
  /**
   * Children of block quote.
   */
  children: Array<BlockContent | DefinitionContent>;
  /**
   * Data associated with the mdast block quote.
   */
  data?: BlockquoteData | undefined;
}
/**
 * Info associated with mdast block quote nodes by the ecosystem.
 */
interface BlockquoteData extends Data {}
/**
 * Markdown break.
 */
interface Break extends Node$1 {
  /**
   * Node type of mdast break.
   */
  type: "break";
  /**
   * Data associated with the mdast break.
   */
  data?: BreakData | undefined;
}
/**
 * Info associated with mdast break nodes by the ecosystem.
 */
interface BreakData extends Data {}
/**
 * Markdown code (flow) (block).
 */
interface Code extends Literal {
  /**
   * Node type of mdast code (flow).
   */
  type: "code";
  /**
   * Language of computer code being marked up.
   */
  lang?: string | null | undefined;
  /**
   * Custom information relating to the node.
   *
   * If the lang field is present, a meta field can be present.
   */
  meta?: string | null | undefined;
  /**
   * Data associated with the mdast code (flow).
   */
  data?: CodeData | undefined;
}
/**
 * Info associated with mdast code (flow) (block) nodes by the ecosystem.
 */
interface CodeData extends Data {}
/**
 * Markdown definition.
 */
interface Definition extends Node$1, Association, Resource {
  /**
   * Node type of mdast definition.
   */
  type: "definition";
  /**
   * Data associated with the mdast definition.
   */
  data?: DefinitionData | undefined;
}
/**
 * Info associated with mdast definition nodes by the ecosystem.
 */
interface DefinitionData extends Data {}
/**
 * Markdown GFM delete (strikethrough).
 */
interface Delete extends Parent {
  /**
   * Node type of mdast GFM delete.
   */
  type: "delete";
  /**
   * Children of GFM delete.
   */
  children: PhrasingContent[];
  /**
   * Data associated with the mdast GFM delete.
   */
  data?: DeleteData | undefined;
}
/**
 * Info associated with mdast GFM delete nodes by the ecosystem.
 */
interface DeleteData extends Data {}
/**
 * Markdown emphasis.
 */
interface Emphasis extends Parent {
  /**
   * Node type of mdast emphasis.
   */
  type: "emphasis";
  /**
   * Children of emphasis.
   */
  children: PhrasingContent[];
  /**
   * Data associated with the mdast emphasis.
   */
  data?: EmphasisData | undefined;
}
/**
 * Info associated with mdast emphasis nodes by the ecosystem.
 */
interface EmphasisData extends Data {}
/**
 * Markdown GFM footnote definition.
 */
interface FootnoteDefinition extends Parent, Association {
  /**
   * Node type of mdast GFM footnote definition.
   */
  type: "footnoteDefinition";
  /**
   * Children of GFM footnote definition.
   */
  children: Array<BlockContent | DefinitionContent>;
  /**
   * Data associated with the mdast GFM footnote definition.
   */
  data?: FootnoteDefinitionData | undefined;
}
/**
 * Info associated with mdast GFM footnote definition nodes by the ecosystem.
 */
interface FootnoteDefinitionData extends Data {}
/**
 * Markdown GFM footnote reference.
 */
interface FootnoteReference extends Association, Node$1 {
  /**
   * Node type of mdast GFM footnote reference.
   */
  type: "footnoteReference";
  /**
   * Data associated with the mdast GFM footnote reference.
   */
  data?: FootnoteReferenceData | undefined;
}
/**
 * Info associated with mdast GFM footnote reference nodes by the ecosystem.
 */
interface FootnoteReferenceData extends Data {}
/**
 * Markdown heading.
 */
interface Heading extends Parent {
  /**
   * Node type of mdast heading.
   */
  type: "heading";
  /**
   * Heading rank.
   *
   * A value of `1` is said to be the highest rank and `6` the lowest.
   */
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Children of heading.
   */
  children: PhrasingContent[];
  /**
   * Data associated with the mdast heading.
   */
  data?: HeadingData | undefined;
}
/**
 * Info associated with mdast heading nodes by the ecosystem.
 */
interface HeadingData extends Data {}
/**
 * Markdown HTML.
 */
interface Html extends Literal {
  /**
   * Node type of mdast HTML.
   */
  type: "html";
  /**
   * Data associated with the mdast HTML.
   */
  data?: HtmlData | undefined;
}
/**
 * Info associated with mdast HTML nodes by the ecosystem.
 */
interface HtmlData extends Data {}
/**
 * Markdown image.
 */
interface Image extends Alternative, Node$1, Resource {
  /**
   * Node type of mdast image.
   */
  type: "image";
  /**
   * Data associated with the mdast image.
   */
  data?: ImageData | undefined;
}
/**
 * Info associated with mdast image nodes by the ecosystem.
 */
interface ImageData extends Data {}
/**
 * Markdown image reference.
 */
interface ImageReference extends Alternative, Node$1, Reference {
  /**
   * Node type of mdast image reference.
   */
  type: "imageReference";
  /**
   * Data associated with the mdast image reference.
   */
  data?: ImageReferenceData | undefined;
}
/**
 * Info associated with mdast image reference nodes by the ecosystem.
 */
interface ImageReferenceData extends Data {}
/**
 * Markdown code (text) (inline).
 */
interface InlineCode extends Literal {
  /**
   * Node type of mdast code (text).
   */
  type: "inlineCode";
  /**
   * Data associated with the mdast code (text).
   */
  data?: InlineCodeData | undefined;
}
/**
 * Info associated with mdast code (text) (inline) nodes by the ecosystem.
 */
interface InlineCodeData extends Data {}
/**
 * Markdown link.
 */
interface Link extends Parent, Resource {
  /**
   * Node type of mdast link.
   */
  type: "link";
  /**
   * Children of link.
   */
  children: PhrasingContent[];
  /**
   * Data associated with the mdast link.
   */
  data?: LinkData | undefined;
}
/**
 * Info associated with mdast link nodes by the ecosystem.
 */
interface LinkData extends Data {}
/**
 * Markdown link reference.
 */
interface LinkReference extends Parent, Reference {
  /**
   * Node type of mdast link reference.
   */
  type: "linkReference";
  /**
   * Children of link reference.
   */
  children: PhrasingContent[];
  /**
   * Data associated with the mdast link reference.
   */
  data?: LinkReferenceData | undefined;
}
/**
 * Info associated with mdast link reference nodes by the ecosystem.
 */
interface LinkReferenceData extends Data {}
/**
 * Markdown list.
 */
interface List extends Parent {
  /**
   * Node type of mdast list.
   */
  type: "list";
  /**
   * Whether the items have been intentionally ordered (when `true`), or that
   * the order of items is not important (when `false` or not present).
   */
  ordered?: boolean | null | undefined;
  /**
   * The starting number of the list, when the `ordered` field is `true`.
   */
  start?: number | null | undefined;
  /**
   * Whether one or more of the children are separated with a blank line from
   * its siblings (when `true`), or not (when `false` or not present).
   */
  spread?: boolean | null | undefined;
  /**
   * Children of list.
   */
  children: ListContent[];
  /**
   * Data associated with the mdast list.
   */
  data?: ListData | undefined;
}
/**
 * Info associated with mdast list nodes by the ecosystem.
 */
interface ListData extends Data {}
/**
 * Markdown list item.
 */
interface ListItem extends Parent {
  /**
   * Node type of mdast list item.
   */
  type: "listItem";
  /**
   * Whether the item is a tasklist item (when `boolean`).
   *
   * When `true`, the item is complete.
   * When `false`, the item is incomplete.
   */
  checked?: boolean | null | undefined;
  /**
   * Whether one or more of the children are separated with a blank line from
   * its siblings (when `true`), or not (when `false` or not present).
   */
  spread?: boolean | null | undefined;
  /**
   * Children of list item.
   */
  children: Array<BlockContent | DefinitionContent>;
  /**
   * Data associated with the mdast list item.
   */
  data?: ListItemData | undefined;
}
/**
 * Info associated with mdast list item nodes by the ecosystem.
 */
interface ListItemData extends Data {}
/**
 * Markdown paragraph.
 */
interface Paragraph extends Parent {
  /**
   * Node type of mdast paragraph.
   */
  type: "paragraph";
  /**
   * Children of paragraph.
   */
  children: PhrasingContent[];
  /**
   * Data associated with the mdast paragraph.
   */
  data?: ParagraphData | undefined;
}
/**
 * Info associated with mdast paragraph nodes by the ecosystem.
 */
interface ParagraphData extends Data {}
/**
 * Document fragment or a whole document.
 *
 * Should be used as the root of a tree and must not be used as a child.
 */
interface Root extends Parent {
  /**
   * Node type of mdast root.
   */
  type: "root";
  /**
   * Data associated with the mdast root.
   */
  data?: RootData | undefined;
}
/**
 * Info associated with mdast root nodes by the ecosystem.
 */
interface RootData extends Data {}
/**
 * Markdown strong.
 */
interface Strong extends Parent {
  /**
   * Node type of mdast strong.
   */
  type: "strong";
  /**
   * Children of strong.
   */
  children: PhrasingContent[];
  /**
   * Data associated with the mdast strong.
   */
  data?: StrongData | undefined;
}
/**
 * Info associated with mdast strong nodes by the ecosystem.
 */
interface StrongData extends Data {}
/**
 * Markdown GFM table.
 */
interface Table extends Parent {
  /**
   * Node type of mdast GFM table.
   */
  type: "table";
  /**
   * How cells in columns are aligned.
   */
  align?: AlignType[] | null | undefined;
  /**
   * Children of GFM table.
   */
  children: TableContent[];
  /**
   * Data associated with the mdast GFM table.
   */
  data?: TableData | undefined;
}
/**
 * Info associated with mdast GFM table nodes by the ecosystem.
 */
interface TableData extends Data {}
/**
 * Markdown GFM table row.
 */
interface TableRow extends Parent {
  /**
   * Node type of mdast GFM table row.
   */
  type: "tableRow";
  /**
   * Children of GFM table row.
   */
  children: RowContent[];
  /**
   * Data associated with the mdast GFM table row.
   */
  data?: TableRowData | undefined;
}
/**
 * Info associated with mdast GFM table row nodes by the ecosystem.
 */
interface TableRowData extends Data {}
/**
 * Markdown GFM table cell.
 */
interface TableCell extends Parent {
  /**
   * Node type of mdast GFM table cell.
   */
  type: "tableCell";
  /**
   * Children of GFM table cell.
   */
  children: PhrasingContent[];
  /**
   * Data associated with the mdast GFM table cell.
   */
  data?: TableCellData | undefined;
}
/**
 * Info associated with mdast GFM table cell nodes by the ecosystem.
 */
interface TableCellData extends Data {}
/**
 * Markdown text.
 */
interface Text extends Literal {
  /**
   * Node type of mdast text.
   */
  type: "text";
  /**
   * Data associated with the mdast text.
   */
  data?: TextData | undefined;
}
/**
 * Info associated with mdast text nodes by the ecosystem.
 */
interface TextData extends Data {}
/**
 * Markdown thematic break (horizontal rule).
 */
interface ThematicBreak extends Node$1 {
  /**
   * Node type of mdast thematic break.
   */
  type: "thematicBreak";
  /**
   * Data associated with the mdast thematic break.
   */
  data?: ThematicBreakData | undefined;
}
/**
 * Info associated with mdast thematic break nodes by the ecosystem.
 */
interface ThematicBreakData extends Data {}
/**
 * Markdown YAML.
 */
interface Yaml extends Literal {
  /**
   * Node type of mdast YAML.
   */
  type: "yaml";
  /**
   * Data associated with the mdast YAML.
   */
  data?: YamlData | undefined;
}
/**
 * Info associated with mdast YAML nodes by the ecosystem.
 */
interface YamlData extends Data {}
//#endregion
//#region src/plugins/markdown/data-source/markdown/parse.d.ts
type MarkdownReadNode = INode | ITextNode | IElementNode;
type MarkdownNode = Root | RootContent | PhrasingContent;
type MarkdownReaderFunc<K> = (node: Extract<MarkdownNode, {
  type: K;
}>, children: MarkdownReadNode[], index: number) => MarkdownReadNode | MarkdownReadNode[] | false;
type TransformerRecord = { [K in MarkdownNode['type']]?: MarkdownReaderFunc<K> | Array<MarkdownReaderFunc<K>> };
//#endregion
//#region src/plugins/markdown/service/transformers.d.ts
type TextFormatTransformer = Readonly<{
  format?: ReadonlyArray<TextFormatType>;
  intraword?: boolean;
  process?: (selection: RangeSelection) => boolean | void;
  tag: string;
  type: 'text-format';
}>;
type TextMatchTransformer = Readonly<{
  /**
   * For import operations, this function can be used to determine the end index of the match, after `importRegExp` has matched.
   * Without this function, the end index will be determined by the length of the match from `importRegExp`. Manually determining the end index can be useful if
   * the match from `importRegExp` is not the entire text content of the node. That way, `importRegExp` can be used to match only the start of the node, and `getEndIndex`
   * can be used to match the end of the node.
   *
   * @returns The end index of the match, or false if the match was unsuccessful and a different transformer should be tried.
   */
  getEndIndex?: (node: TextNode, match: RegExpMatchArray) => number | false;
  /**
   * This regex determines what text is matched during markdown imports
   */
  importRegExp?: RegExp;
  /**
   * This regex determines what text is matched for markdown shortcuts while typing in the editor
   */
  regExp: RegExp;
  /**
   * Determines how the matched markdown text should be transformed into a node during the markdown import process
   *
   * @returns nothing, or a TextNode that may be a child of the new node that is created.
   * If a TextNode is returned, text format matching will be applied to it (e.g. bold, italic, etc.)
   */
  replace?: (node: TextNode, match: RegExpMatchArray) => void | TextNode;
  /**
   * Single character that allows the transformer to trigger when typed in the editor. This does not affect markdown imports outside of the markdown shortcut plugin.
   * If the trigger is matched, the `regExp` will be used to match the text in the second step.
   */
  trigger?: string;
  type: 'text-match';
}>;
type ElementTransformer = {
  regExp: RegExp;
  /**
   * `replace` is called when markdown is imported or typed in the editor
   *
   * @return return false to cancel the transform, even though the regex matched. Lexical will then search for the next transformer.
   */
  replace: (parentNode: ElementNode, children: Array<LexicalNode>, match: Array<string>,
  /**
   * Whether the match is from an import operation (e.g. through `$convertFromMarkdownString`) or not (e.g. through typing in the editor).
   */

  isImport: boolean) => boolean | void;
  trigger?: 'enter';
  type: 'element';
};
type Transformer = ElementTransformer | TextFormatTransformer | TextMatchTransformer;
//#endregion
//#region src/plugins/markdown/service/shortcut.d.ts
interface IMarkdownWriterContext {
  /**
   * Add processor
   * @param processor
   */
  addProcessor(processor: (before: string, content: string, after: string) => string): void;
  /**
   * Direct output
   * @param line
   * @returns
   */
  appendLine: (line: string) => void;
  /**
   * Control child node to markdown
   * @param parentCtx
   * @param child
   * @returns
   */
  processChild: (parentCtx: IMarkdownWriterContext, child: LexicalNode) => void;
  /**
   * Wrap child elements
   * @param before
   * @param after
   * @returns
   */
  wrap: (before: string, after: string) => void;
}
declare const MARKDOWN_WRITER_LEVEL_MAX = 0;
declare const MARKDOWN_READER_LEVEL_HIGH = 1;
declare const MARKDOWN_READER_LEVEL_NORMAL = 2;
type MARKDOWN_READER_LEVEL = typeof MARKDOWN_READER_LEVEL_HIGH | typeof MARKDOWN_READER_LEVEL_NORMAL | typeof MARKDOWN_WRITER_LEVEL_MAX;
interface IMarkdownShortCutService {
  insertIRootNode(editor: LexicalEditor, root: IRootNode, selection: BaseSelection): void;
  parseMarkdownToLexical(markdown: string): IRootNode;
  /**
   * Register Markdown reader
   */
  registerMarkdownReader<K extends keyof TransformerRecord>(type: K, reader: MarkdownReaderFunc<K>, level?: MARKDOWN_READER_LEVEL): void;
  registerMarkdownShortCut(transformer: Transformer): void;
  registerMarkdownShortCuts(transformers: Transformer[]): void;
  /**
   * Register Markdown writer
   * @param type Lexical Node type
   * @param writer
   */
  registerMarkdownWriter(type: string, writer: (ctx: IMarkdownWriterContext, node: LexicalNode) => void | boolean): void;
}
declare const IMarkdownShortCutService: IServiceID<IMarkdownShortCutService>;
//#endregion
//#region src/plugins/markdown/command/index.d.ts
declare const INSERT_MARKDOWN_COMMAND: _$lexical.LexicalCommand<{
  editorState?: EditorState;
  historyState: HistoryStateEntry | null;
  markdown: string;
  replaceDocument?: boolean;
}>;
declare const GET_MARKDOWN_SELECTION_COMMAND: _$lexical.LexicalCommand<{
  onResult: (_startLine: number, _endLine: number) => void;
}>;
//#endregion
//#region src/plugins/markdown/plugin/index.d.ts
/**
 * Plain-text Mermaid / diagram snippets look like “multi-paragraph Markdown” (blank lines → high score)
 * but must not go through markdown paste auto-convert — it breaks diagrams and fenced-code expectations.
 */
declare function looksLikeMermaidDiagramSyntax(text: string): boolean;
interface MarkdownPluginOptions {
  /**
   * Automatically convert pasted markdown once the detection threshold is reached
   * @default true
   */
  autoFormatMarkdown?: boolean;
  /**
   * Enable automatic markdown conversion for pasted content
   * @default true
   */
  enablePasteMarkdown?: boolean;
  /**
   * Callback when markdown is detected in pasted text.
   * If provided, the paste is intercepted and the callback decides whether to convert.
   * Return `true` to convert to markdown nodes, `false` to paste as plain text.
   * Supports async (Promise<boolean>) for confirmation dialogs.
   */
  onPasteMarkdown?: (text: string) => boolean | Promise<boolean>;
}
declare const MarkdownPlugin: IEditorPluginConstructor<MarkdownPluginOptions>;
//#endregion
//#region src/plugins/markdown/react/index.d.ts
declare const ReactMarkdownPlugin: FC<void>;
//#endregion
//#region src/plugins/markdown/utils/index.d.ts
/**
 * Checks if a character is a punctuation character.
 * @param char The character to check.
 * @returns True if the character is a punctuation character, false otherwise.
 */
declare function isPunctuationChar(char: string): boolean;
//#endregion
//#region src/plugins/markdown/utils/detectLanguage.d.ts
/**
 * Language detection utility for code snippets
 * Uses pattern matching and heuristics to identify programming languages
 */
interface LanguageDetectionResult {
  confidence: number;
  language: string;
}
/**
 * Detect the programming language of a code snippet
 * @param code - The code snippet to analyze
 * @returns Language detection result with confidence score
 */
declare function detectLanguage(code: string): LanguageDetectionResult | null;
/**
 * Simple detection for common formats with high confidence
 * Falls back to detectLanguage for more complex detection
 */
declare function detectCodeLanguage(code: string): string | null;
//#endregion
//#region src/utils/url.d.ts
/**
 * Shared URL validation utilities
 */
/**
 * Validates if a string is a valid URL
 * @param url - The URL to validate
 * @returns true if the URL is valid, false otherwise
 */
declare function isValidUrl(url: string): boolean;
/**
 * Checks if text is a pure URL (single URL without other text)
 * @param text - The text to check
 * @returns true if text is a pure URL, false otherwise
 */
declare function isPureUrl(text: string): boolean;
//#endregion
//#region src/plugins/markmap/command/index.d.ts
declare const INSERT_MARKMAP_COMMAND: LexicalCommand<void>;
//#endregion
//#region src/plugins/markmap/node/index.d.ts
type SerializedMarkmapNode = Spread<{
  markdown: string;
}, SerializedLexicalNode>;
declare class MarkmapNode extends DecoratorNode<unknown> {
  static getType(): string;
  static clone(node: MarkmapNode): MarkmapNode;
  static importJSON(serializedNode: SerializedMarkmapNode): MarkmapNode;
  __markdown: string;
  /** When true, decorator opens the editor once after insert (not persisted in markdown). */
  __autoOpenEditor: boolean;
  constructor(markdown?: string, key?: string, autoOpenEditor?: boolean);
  clearAutoOpenEditor(): void;
  createDOM(config: EditorConfig): HTMLElement;
  decorate(editor: LexicalEditor): unknown;
  exportJSON(): SerializedMarkmapNode;
  getTextContent(): string;
  isInline(): boolean;
  updateMarkdown(markdown: string): void;
  updateDOM(): boolean;
}
type CreateMarkmapNodeOptions = {
  autoOpenEditor?: boolean;
};
declare function $createMarkmapNode(markdown?: string, options?: CreateMarkmapNodeOptions): MarkmapNode;
declare function $isMarkmapNode(node: LexicalNode): node is MarkmapNode;
//#endregion
//#region src/plugins/markmap/plugin/index.d.ts
interface MarkmapPluginOptions {
  decorator?: (node: MarkmapNode, editor: LexicalEditor) => unknown;
  theme?: {
    markmap?: string;
  };
}
declare const MarkmapPlugin: IEditorPluginConstructor<MarkmapPluginOptions>;
//#endregion
//#region src/plugins/markmap/react/index.d.ts
interface ReactMarkmapPluginProps {
  className?: string;
  theme?: {
    markmap?: string;
  };
}
declare function ReactMarkmapPlugin({
  className,
  theme
}: ReactMarkmapPluginProps): null;
//#endregion
//#region src/plugins/math/command/index.d.ts
declare const INSERT_MATH_COMMAND: _$lexical.LexicalCommand<{
  code: string;
}>;
//#endregion
//#region src/plugins/math/node/index.d.ts
type SerializedMathInlineNode = Spread<{
  code: string;
}, SerializedLexicalNode>;
declare class MathInlineNode extends DecoratorNode<unknown> {
  static getType(): string;
  static clone(node: MathInlineNode): MathInlineNode;
  static importJSON(serializedNode: SerializedMathInlineNode): MathInlineNode;
  static importDOM(): DOMConversionMap | null;
  __code: string;
  constructor(code?: string, key?: string);
  get code(): string;
  updateCode(newCode: string): void;
  exportDOM(): DOMExportOutput;
  createDOM(config: EditorConfig): HTMLElement;
  exportJSON(): SerializedMathInlineNode;
  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedMathInlineNode>): this;
  getTextContent(): string;
  isInline(): boolean;
  updateDOM(): boolean;
  decorate(editor: LexicalEditor): unknown;
}
declare class MathBlockNode extends DecoratorNode<unknown> {
  static getType(): string;
  static clone(node: MathBlockNode): MathBlockNode;
  static importJSON(serializedNode: SerializedMathInlineNode): MathBlockNode;
  static importDOM(): DOMConversionMap | null;
  __code: string;
  constructor(code?: string, key?: string);
  get code(): string;
  updateCode(newCode: string): void;
  exportDOM(): DOMExportOutput;
  createDOM(config: EditorConfig): HTMLElement;
  exportJSON(): SerializedMathInlineNode;
  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedMathInlineNode>): this;
  getTextContent(): string;
  isInline(): boolean;
  updateDOM(): boolean;
  decorate(editor: LexicalEditor): unknown;
}
//#endregion
//#region src/plugins/math/plugin/index.d.ts
interface MathPluginOptions {
  decorator: (node: MathInlineNode | MathBlockNode, editor: LexicalEditor) => unknown;
  theme?: {
    mathBlock?: string;
    mathInline?: string;
  };
}
declare const MathPlugin: IEditorPluginConstructor<MathPluginOptions>;
//#endregion
//#region src/plugins/math/react/type.d.ts
interface ReactMathPluginProps {
  className?: string;
  /** 自定义渲染组件，接收 MathEditorContent 作为子节点 */
  renderComp?: FC<{
    children: ReactNode;
    open?: boolean;
  }>;
  theme?: {
    mathBlock?: string;
    mathInline?: string;
  };
}
//#endregion
//#region src/plugins/math/react/index.d.ts
declare const ReactMathPlugin: FC<ReactMathPluginProps>;
//#endregion
//#region src/plugins/mention/command/index.d.ts
declare const INSERT_MENTION_COMMAND: _$lexical.LexicalCommand<{
  label: string;
  metadata?: Record<string, unknown>;
}>;
//#endregion
//#region src/plugins/mention/plugin/index.d.ts
interface MentionPluginOptions {
  decorator: (node: MentionNode, editor: LexicalEditor) => any;
  markdownReader?: (node: Html, children: INode[]) => SerializedMentionNode | null | false;
  markdownWriter?: (mention: MentionNode) => string;
  theme?: {
    mention?: string;
  };
}
declare const MentionPlugin: IEditorPluginConstructor<MentionPluginOptions>;
//#endregion
//#region src/plugins/meta2d/command/index.d.ts
interface InsertMeta2dPayload {
  /** Default true — open diagram editor after slash / command insert (parity with markmap). */
  autoOpenEditor?: boolean;
  diagram?: string;
  svg?: string;
}
declare const INSERT_META2D_COMMAND: LexicalCommand<InsertMeta2dPayload | undefined>;
//#endregion
//#region src/plugins/meta2d/node/index.d.ts
type SerializedMeta2dNode = Spread<{
  diagram: string;
  svg: string;
}, SerializedLexicalNode>;
declare class Meta2dNode extends DecoratorNode<unknown> {
  static getType(): string;
  static clone(node: Meta2dNode): Meta2dNode;
  static importJSON(serializedNode: SerializedMeta2dNode): Meta2dNode;
  __diagram: string;
  __svg: string;
  /** When true, decorator opens the editor once after insert (not persisted in markdown). */
  __autoOpenEditor: boolean;
  constructor(diagram?: string, svg?: string, key?: string, autoOpenEditor?: boolean);
  clearAutoOpenEditor(): void;
  createDOM(config: EditorConfig): HTMLElement;
  decorate(editor: LexicalEditor): unknown;
  exportJSON(): SerializedMeta2dNode;
  getTextContent(): string;
  isInline(): boolean;
  updateDiagram(diagram: string, svg: string): void;
  updateDOM(): boolean;
}
type CreateMeta2dNodeOptions = {
  autoOpenEditor?: boolean;
};
declare function $createMeta2dNode(diagram?: string, svg?: string, options?: CreateMeta2dNodeOptions): Meta2dNode;
declare function $isMeta2dNode(node: LexicalNode): node is Meta2dNode;
//#endregion
//#region src/plugins/meta2d/plugin/index.d.ts
interface Meta2dPluginOptions {
  decorator?: (node: Meta2dNode, editor: LexicalEditor) => unknown;
  theme?: {
    meta2d?: string;
  };
}
declare const Meta2dPlugin: IEditorPluginConstructor<Meta2dPluginOptions>;
//#endregion
//#region src/plugins/meta2d/react/index.d.ts
interface ReactMeta2dPluginProps {
  className?: string;
  theme?: {
    meta2d?: string;
  };
}
declare function ReactMeta2dPlugin({
  className,
  theme
}: ReactMeta2dPluginProps): null;
//#endregion
//#region src/plugins/outline/react/OutlineContext.d.ts
interface OutlineVisibilityValue {
  setVisible: (next: boolean) => void;
  toggle: () => void;
  /** When false, {@link OutlinePanel} renders nothing. */
  visible: boolean;
}
interface OutlineControlledVisibilityProps {
  onVisibleChange?: (visible: boolean) => void;
  visible?: boolean;
}
interface OutlineProviderProps extends PropsWithChildren {
  /** Initial visibility when using uncontrolled mode. */
  defaultVisible?: boolean;
}
/** Supplies visibility state for {@link OutlineToolbar}, {@link useOutlineActionItem}, and {@link OutlinePanel}. */
declare const OutlineProvider: FC<OutlineProviderProps>;
/** @returns Context value when inside {@link OutlineProvider}, otherwise `null`. */
declare function useOutlineVisibilityContext(): OutlineVisibilityValue | null;
/**
 * Reads outline visibility inside {@link OutlineProvider}.
 * @throws When used outside of a provider.
 */
declare function useOutlineVisibility(): OutlineVisibilityValue;
type OutlineVisibilityToggleApi = {
  ready: false;
} | {
  ready: true;
  toggle: () => void;
  visible: boolean;
};
/**
 * Resolves toggling from optional controlled props vs {@link OutlineProvider}.
 * Use inside {@link OutlineToolbar} / {@link useOutlineActionItem}.
 */
declare function useOutlineVisibilityToggle(controlled?: OutlineControlledVisibilityProps): OutlineVisibilityToggleApi;
//#endregion
//#region src/plugins/outline/react/OutlinePanel.d.ts
interface OutlinePanelProps {
  editor: IEditor;
  /**
   * When set, overrides {@link OutlineProvider} visibility for this panel only.
   * Use together with matching {@link OutlineToolbar} controlled props when not using provider.
   */
  visible?: boolean;
}
declare const OutlinePanel: FC<OutlinePanelProps>;
//#endregion
//#region src/plugins/outline/react/OutlineToolbar.d.ts
interface OutlineToolbarProps {
  className?: string;
  /** Tooltip when the outline is visible (click to hide). */
  collapseTitle?: string;
  /** Tooltip when the outline is hidden (click to show). */
  expandTitle?: string;
  /** @see visible */
  onVisibleChange?: (visible: boolean) => void;
  style?: CSSProperties;
  /**
   * Controlled visibility. Must be used together with {@link OutlineToolbarProps.onVisibleChange}.
   * When omitted, reads/writes {@link OutlineProvider} context.
   */
  visible?: boolean;
}
/**
 * Toolbar control that toggles outline visibility.
 * Prefer {@link useOutlineActionItem} when merging into a ChatInputActions item list (see toolbar demo).
 *
 * Either wrap the tree with {@link OutlineProvider}, or pass `visible` / `onVisibleChange`
 * together with the same props on {@link OutlinePanel}.
 */
declare const OutlineToolbar: FC<OutlineToolbarProps>;
//#endregion
//#region src/plugins/outline/react/useOutlineActionItem.d.ts
interface UseOutlineActionItemProps extends OutlineControlledVisibilityProps {
  /** Tooltip when outline is expanded (click to collapse). */
  collapseTitle?: string;
  /** Tooltip when outline is hidden (click to expand). */
  expandTitle?: string;
}
/**
 * Returns a {@link ChatInputActions} toolbar item that toggles outline visibility
 * via {@link OutlineProvider} or `visible` + `onVisibleChange`.
 * Returns `null` when no provider/control is configured — omit from `items`.
 */
declare function useOutlineActionItem(props?: UseOutlineActionItemProps): ChatInputActionItem | null;
//#endregion
//#region src/plugins/table/command/index.d.ts
declare const INSERT_TABLE_COMMAND: _$lexical.LexicalCommand<{
  columns: string;
  includeHeaders?: InsertTableCommandPayloadHeaders;
  rows: string;
}>;
declare const SELECT_TABLE_COMMAND: _$lexical.LexicalCommand<{
  columnIndex?: number;
  rowIndex?: number;
  table: string;
}>;
//#endregion
//#region src/plugins/table/plugin/index.d.ts
interface TablePluginOptions {
  theme?: string;
}
declare const TablePlugin: IEditorPluginConstructor<TablePluginOptions>;
//#endregion
//#region src/plugins/table/react/type.d.ts
interface ReactTablePluginProps {
  className?: string;
  locale?: Partial<Record<keyof ILocaleKeys, string>>;
}
//#endregion
//#region src/plugins/table/react/index.d.ts
declare const ReactTablePlugin: FC<ReactTablePluginProps>;
//#endregion
//#region src/plugins/toolbar/command/index.d.ts
declare const HIDE_TOOLBAR_COMMAND: LexicalCommand<void>;
declare const SHOW_TOOLBAR_COMMAND: LexicalCommand<void>;
interface ToolbarCommandOptions {
  onHide?: () => void;
  onShow?: () => void;
}
declare function registerToolbarCommand(editor: LexicalEditor, options?: ToolbarCommandOptions): () => void;
//#endregion
//#region src/plugins/toolbar/react/type.d.ts
interface ReactToolbarPluginProps {
  children?: ReactNode;
  className?: string;
}
//#endregion
//#region src/plugins/toolbar/react/index.d.ts
declare const ReactToolbarPlugin: FC<ReactToolbarPluginProps>;
//#endregion
//#region src/plugins/upload/plugin/index.d.ts
interface UploadPluginOptions {}
declare const UploadPlugin: IEditorPluginConstructor<UploadPluginOptions>;
//#endregion
//#region src/plugins/upload/service/i-upload-service.d.ts
declare const UPLOAD_PRIORITY_LOW = 2;
declare const UPLOAD_PRIORITY_MEDIUM = 1;
declare const UPLOAD_PRIORITY_HIGH = 0;
type UPLOAD_PRIORITY = typeof UPLOAD_PRIORITY_LOW | typeof UPLOAD_PRIORITY_MEDIUM | typeof UPLOAD_PRIORITY_HIGH;
interface IUploadService {
  registerUpload(handler: (file: File, from: string, range: Range | null | undefined) => Promise<boolean | null>, priority?: UPLOAD_PRIORITY): void;
  uploadFile(file: File, from: string, range: Range | null | undefined): Promise<boolean>;
}
declare const IUploadService: IServiceID<IUploadService>;
//#endregion
//#region src/utils/debug.d.ts
/**
 * Debug utility factory for LobeHub Editor
 * Creates namespaced debug functions following the pattern: lobe-editor:category
 */
declare class DebugLogger {
  private debuggers;
  /**
   * Get or create a debug function for a specific namespace
   * @param category - The debug category (e.g., 'kernel', 'plugin', 'upload')
   * @param subcategory - Optional subcategory for more specific debugging
   * @returns Debug function
   */
  getDebugger(category: string, subcategory?: string): createDebug.Debugger;
  /**
   * Create a scoped debug logger for a specific component/service
   * @param category - Main category
   * @param subcategory - Optional subcategory
   * @returns Object with debug methods
   */
  createLogger(category: string, subcategory?: string): {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  /**
   * Enable debug for specific namespaces
   * @param namespaces - Comma-separated list of namespaces to enable
   */
  enable(namespaces: string): void;
  /**
   * Disable all debug output
   */
  disable(): void;
  /**
   * Check if a namespace is enabled
   * @param namespace - The namespace to check
   * @returns Whether the namespace is enabled
   */
  enabled(namespace: string): boolean;
}
/**
 * Global debug logger instance
 */
declare const debugLogger: DebugLogger;
/**
 * Convenience function to create a debug logger for a specific category
 * @param category - Main category (e.g., 'kernel', 'plugin', 'upload')
 * @param subcategory - Optional subcategory
 * @returns Logger object with debug methods
 */
declare function createDebugLogger(category: string, subcategory?: string): {
  /**
   * General debug logging
   */
  debug: createDebug.Debugger;
  /**
   * Error level logging - uses console.error for proper browser dev tool support
   */
  error: (...args: any[]) => void;
  /**
   * Info level logging
   */
  info: createDebug.Debugger;
  /**
   * Log function - alias for debug for compatibility
   */
  log: createDebug.Debugger;
  /**
   * Warning level logging - uses console.warn for proper browser dev tool support
   */
  warn: (...args: any[]) => void;
};
/**
 * Pre-configured debug loggers for common categories
 */
declare const debugLoggers: {
  demo: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  file: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  image: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  kernel: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  markdown: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  math: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  mention: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  plugin: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  react: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  service: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  slash: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
  upload: {
    /**
     * General debug logging
     */
    debug: createDebug.Debugger;
    /**
     * Error level logging - uses console.error for proper browser dev tool support
     */
    error: (...args: any[]) => void;
    /**
     * Info level logging
     */
    info: createDebug.Debugger;
    /**
     * Log function - alias for debug for compatibility
     */
    log: createDebug.Debugger;
    /**
     * Warning level logging - uses console.warn for proper browser dev tool support
     */
    warn: (...args: any[]) => void;
  };
};
/**
 * Conditional console logging - only logs in development mode
 * Use this for demo files and development-only logging
 */
declare const devConsole: {
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};
/**
 * Production-safe error logging
 * Always logs errors and warnings regardless of environment using native console methods
 * for proper browser dev tool support. Debug/info uses debug package.
 */
declare const prodSafeLogger: {
  /**
   * Debug info - only shown when debug is enabled
   */
  debug: createDebug.Debugger;
  /**
   * Log critical errors that should always be visible (uses console.error)
   */
  error: (...args: any[]) => void;
  /**
   * Info logging - only shown when debug is enabled
   */
  info: createDebug.Debugger;
  /**
   * Log warnings that should always be visible (uses console.warn)
   */
  warn: (...args: any[]) => void;
};
/**
 * Browser debug utilities for Next.js and other client-side frameworks
 */
declare const browserDebug: {
  /**
   * Disable debug logging in browser environment
   */
  disable: () => void;
  /**
   * Enable debug logging in browser environment
   * @param namespaces - Debug namespaces to enable (e.g., 'lobe-editor:*')
   */
  enable: (namespaces?: string) => void;
  /**
   * Get current debug configuration
   */
  getConfig: () => {
    enabled: string | boolean;
    source: string;
  };
  /**
   * Show available debug categories
   */
  showCategories: () => void;
  /**
   * Show current debug status and configuration
   */
  showStatus: () => void;
};
//#endregion
//#region src/editor-kernel/kernel.d.ts
declare class Kernel extends EventEmitter implements IEditorKernel {
  private static globalHotReloadMode;
  private dataTypeMap;
  private plugins;
  private pluginsConfig;
  private pluginsInstances;
  private nodes;
  private themes;
  private decorators;
  private serviceMap;
  private localeMap;
  private hotReloadMode;
  private logger;
  private historyState;
  private editor?;
  private headlessEditor;
  constructor();
  getHistoryState(): HistoryState;
  isEditable(): boolean;
  private detectDevelopmentMode;
  /**
   * Globally enable or disable hot reload mode for all kernel instances
   * @param enabled Whether to enable hot reload mode globally
   */
  static setGlobalHotReloadMode(enabled: boolean): void;
  /**
   * Reset global hot reload mode to automatic detection
   */
  static resetGlobalHotReloadMode(): void;
  getLexicalEditor(): LexicalEditor | null;
  destroy(): void;
  getRootElement(): HTMLElement | null;
  setRootElement(dom: HTMLElement, editable?: boolean): LexicalEditor;
  setEditable(editable: boolean): void;
  initNodeEditor(): LexicalEditor;
  initHeadlessEditor(): LexicalEditor;
  setDocument(type: string, content: any, options?: IDocumentOptions): void;
  setSelection(selection: ISelectionObject, opt?: {
    collapseToEnd?: boolean;
    collapseToStart?: boolean;
  }): Promise<boolean>;
  getSelection(): ISelectionObject | null;
  focus(): void;
  blur(): void;
  getDocument(type: string): DataSource | undefined;
  getSelectionDocument(type: string): unknown | null;
  registerDecorator(name: string, decorator: IDecorator): this;
  getDecorator(name: string): IDecorator | undefined;
  /**
   * Unregister a decorator
   * @param name Decorator name
   */
  unregisterDecorator(name: string): boolean;
  /**
   * Get all registered decorator names
   */
  getRegisteredDecorators(): string[];
  /**
   * Support registering target data source
   * @param dataSource Data source
   */
  registerDataSource(dataSource: DataSource): void;
  registerThemes(themes: Record<string, any>): void;
  registerPlugin<T>(plugin: IEditorPluginConstructor<T>, config?: T): IEditor;
  registerPlugins(plugins: Array<IPlugin>): IEditor;
  registerNodes(nodes: Array<LexicalNodeConfig>): void;
  registerService<T>(serviceId: IServiceID<T>, service: T): void;
  /**
   * Register service with hot reload support - allows overriding existing services
   * @param serviceId Service identifier
   * @param service Service instance
   */
  registerServiceHotReload<T>(serviceId: IServiceID<T>, service: T): void;
  /**
   * Enable or disable hot reload mode
   * @param enabled Whether to enable hot reload mode
   */
  setHotReloadMode(enabled: boolean): void;
  /**
   * Check if hot reload mode is enabled
   */
  isHotReloadMode(): boolean;
  /**
   * Get service
   * @param serviceId Service ID
   */
  requireService<T>(serviceId: IServiceID<T>): T | null;
  dispatchCommand<TCommand extends LexicalCommand<unknown>>(type: TCommand, payload: CommandPayloadType<TCommand>): boolean;
  getTheme(): Record<string, any>;
  updateTheme(key: string, value: string | Record<string, string>): void;
  registerLocale(locale: Partial<Record<keyof ILocaleKeys, string>>): void;
  setLocale(locale: Partial<Record<keyof ILocaleKeys, string>>): void;
  t<K extends keyof ILocaleKeys>(key: K, params?: Record<string, any>): string;
  get isEmpty(): boolean;
  get isSelected(): boolean;
  cleanDocument(): void;
  private _commands;
  private _commandsClean;
  registerHotkey(hotkeyId: HotkeyId, callback: (event: KeyboardEvent, handler: HotkeysEvent) => void, options?: HotkeyOptions): () => void;
  registerHighCommand<P>(command: LexicalCommand<P>, listener: CommandListener<P>, priority: CommandListenerPriority): () => void;
}
//#endregion
//#region src/utils/scrollIntoView.d.ts
/**
 * Scroll the current selection into view, centered vertically in the viewport
 * @param offsetY Optional vertical offset from center (default: 0)
 */
declare function scrollIntoView(offsetY?: number): void;
//#endregion
//#region src/index.d.ts
/**
 * Enable hot reload mode globally for all editor instances
 * Call this in your app's entry point during development
 */
declare function enableHotReload(): void;
/**
 * Disable hot reload mode globally
 */
declare function disableHotReload(): void;
//#endregion
export { $closest, $closestNodeType, $createCursorNode, $createDiffChromeNode, $createDiffHunkNode, $createMarkmapNode, $createMeta2dNode, $getNearestNodeFromDOMNode, $getNodeFromDOMNode, $isCardLikeElementNode, $isCursorNode, $isDiffChromeNode, $isDiffHunkNode, $isMarkmapNode, $isMeta2dNode, ACCEPT_DIFF_OP_COMMAND, APPLY_DIFF_OP_COMMAND, AutoCompletePlugin, CardLikeElementNode, CodePlugin, CodeblockPlugin, CodeblockPluginOptions, CodemirrorPlugin, CodemirrorPluginOptions, CommonPlugin, CommonPluginOptions, type CreateMeta2dNodeOptions, DEFAULT_HEADLESS_EDITOR_PLUGINS, DOM_DOCUMENT_FRAGMENT_TYPE, DOM_DOCUMENT_TYPE, DOM_ELEMENT_TYPE, DOM_TEXT_TYPE, DataSource, type DiffApiResult, DiffChromeNode, type DiffHunkKind, DiffHunkNode, type DiffOpPayload, DiffPlugin, DiffPluginOptions, EDITOR_THEME_KEY, FilePlugin, FilePluginOptions, type FlattenMode, GET_MARKDOWN_SELECTION_COMMAND, HIDE_TOOLBAR_COMMAND, HOVER_COMMAND, HRPlugin, HRPluginOptions, HeadlessDocumentType, HeadlessEditor, HeadlessEditorExport, HeadlessEditorExportOptions, HeadlessEditorHydrationInput, HeadlessEditorOptions, HotkeyEnum, HotkeyId, HotkeyItem, HotkeyScopeEnum, HotkeyScopeId, type IEditor, ILinkService, IMapNode, IMarkdownShortCutService, INSERT_CHECK_LIST_COMMAND, INSERT_CODEINLINE_COMMAND, INSERT_CODEMIRROR_COMMAND, INSERT_FILE_COMMAND, INSERT_HEADING_COMMAND, INSERT_HORIZONTAL_RULE_COMMAND, INSERT_IMAGE_COMMAND, INSERT_LINK_COMMAND, INSERT_LINK_HIGHLIGHT_COMMAND, INSERT_MARKDOWN_COMMAND, INSERT_MARKMAP_COMMAND, INSERT_MATH_COMMAND, INSERT_MENTION_COMMAND, INSERT_META2D_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_QUOTE_COMMAND, INSERT_TABLE_COMMAND, INSERT_UNORDERED_LIST_COMMAND, INodePlugin, INodePluginOptions, INodeService, ISlashMenuOption, ISlashOption, ISlashService, ITriggerContext, IUploadService, ImagePlugin, ImagePluginOptions, type InsertMeta2dPayload, Kernel, KeyEnum, LexicalErrorBoundary, LexicalPortalContainer, LinkHighlightPlugin, LinkHighlightPluginOptions, LinkPlugin, LinkPluginOptions, ListPlugin, ListPluginOptions, type MARKDOWN_READER_LEVEL, MARKDOWN_READER_LEVEL_HIGH, MARKDOWN_READER_LEVEL_NORMAL, MARKDOWN_WRITER_LEVEL_MAX, MarkdownPlugin, MarkmapNode, MarkmapPlugin, MarkmapWithErrorBoundary, MathPlugin, MentionPlugin, MentionPluginOptions, MenuRenderProps, MermaidWithErrorBoundary, Meta2dNode, Meta2dPlugin, type Meta2dPluginOptions, ModifierCombination, type OutlineControlledVisibilityProps, OutlinePanel, OutlineProvider, type OutlineProviderProps, OutlineToolbar, type OutlineToolbarProps, type OutlineVisibilityToggleApi, type OutlineVisibilityValue, REJECT_DIFF_OP_COMMAND, REMOVE_LIST_COMMAND, ReactAutoCompletePlugin, ReactCodePlugin, ReactCodeblockPlugin, ReactCodeblockPluginProps, ReactCodemirrorPlugin, ReactDiffPlugin, ReactDiffPluginProps, ReactEditor, ReactEditorContent, ReactEditorContentProps, ReactFilePlugin, ReactFilePluginProps, ReactHRPlugin, ReactHRPluginProps, ReactImagePlugin, ReactImagePluginProps, ReactLinkHighlightPlugin, ReactLinkPlugin, ReactLinkPluginProps, ReactListPlugin, ReactListPluginProps, ReactMarkdownPlugin, ReactMarkmapPlugin, ReactMathPlugin, ReactMentionPlugin, ReactMentionPluginProps, ReactMeta2dPlugin, type ReactMeta2dPluginProps, ReactNodePlugin, ReactPlainText, ReactPlainTextProps, ReactSlashOption, ReactSlashOptionProps, ReactSlashPlugin, ReactSlashPluginProps, ReactTablePlugin, ReactToolbarPlugin, SELECT_AFTER_CODEMIRROR_COMMAND, SELECT_BEFORE_CODEMIRROR_COMMAND, SELECT_TABLE_COMMAND, SHOW_TOOLBAR_COMMAND, SUPPORTED_SHIKI_LANGUAGE_IDS, type SerializedDiffChromeNode, type SerializedDiffHunkNode, type SerializedMentionNode, type SerializedMeta2dNode, SlashMenu, SlashMenuProps, SlashOptions, SlashPlugin, SlashPluginOptions, TablePlugin, TablePluginOptions, ToolbarCommandOptions, UPDATE_CODEBLOCK_LANG, UPDATE_LIST_START_COMMAND, UPLOAD_PRIORITY_HIGH, UPLOAD_PRIORITY_LOW, UPLOAD_PRIORITY_MEDIUM, UploadPlugin, UploadPluginOptions, type UseOutlineActionItemProps, acceptAllDiffOps, acceptDiffHunkByKey, acceptDiffOp, assert, assertCanPublish, blockPlainText, browserDebug, supportedLanguagesInfo as bundledLanguagesInfo, supportedLanguagesInfo, compareNodeOrder, countNodes, createDebugLogger, createEmptyEditorState, createHeadlessEditor, cursorNodeSerialized, debugLogger, debugLoggers, detectCodeLanguage, detectLanguage, devConsole, disableHotReload, enUS, enableHotReload, flattenCanonicalState, genServiceId, generateEditorId, getCanonicalEditorState, getHotkeyById, getKernelFromEditor, getKernelFromEditorConfig, getNodeKeyFromDOMNode, getParentElement, hasPendingDiff, insertAfterSlot, isDOMNode, isDocumentFragment, isPunctuationChar, isPureUrl, isValidUrl, looksLikeMermaidDiagramSyntax, makeParagraphBlock, materializeCanonical, moment, noop, overwriteAll, overwriteAllFromState, prodSafeLogger, reconcileDecorator, registerEditorKernel, registerLinkHighlightCommand, registerToolbarCommand, rejectAllDiffOps, rejectDiffHunkByKey, rejectDiffOp, removeSlot, resetRandomKey, scrollIntoView, setFoldAll, unregisterEditorKernel, updateSlot, useLexicalComposerContext, useLexicalEditor, useOutlineActionItem, useOutlineVisibility, useOutlineVisibilityContext, useOutlineVisibilityToggle, zhCN };