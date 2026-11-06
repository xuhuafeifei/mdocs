import { HistoryState, HistoryStateEntry } from "@lexical/history";
import { CommandListener, CommandListenerPriority, CommandPayloadType, EditorState, LexicalCommand, LexicalEditor, LexicalNode, LexicalNodeConfig, SerializedEditorState, SerializedLexicalNode } from "lexical";

//#region src/editor-kernel/data-source.d.ts
interface IWriteOptions {
  selection?: boolean;
}
declare class DataSource {
  protected dataType: string;
  constructor(dataType: string);
  get type(): string;
  read(editor: LexicalEditor, data: any, options?: Record<string, unknown>): void;
  write(editor: LexicalEditor, options?: IWriteOptions): any;
}
//#endregion
//#region src/types/hotkey.d.ts
declare const HotkeyEnum: {
  readonly Bold: "bold";
  readonly BulletList: "bulletList";
  readonly CodeInline: "codeInline";
  readonly Italic: "italic";
  readonly Link: "link";
  readonly Mention: "mention";
  readonly NumberList: "numberList";
  readonly PasteAsPlainText: "pasteAsPlainText";
  readonly Redo: "redo";
  readonly Slash: "slash";
  readonly Strikethrough: "strikethrough";
  readonly Underline: "underline";
  readonly Undo: "undo";
};
type HotkeyId = (typeof HotkeyEnum)[keyof typeof HotkeyEnum];
type ModifierCombination = {
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
} | Record<string, never>;
//#endregion
//#region src/utils/hotkey/registerHotkey.d.ts
type HotkeysEvent = {
  key?: string;
  keys: string;
  modifiers: ModifierCombination;
  scopes?: string[];
};
type HotkeyOptions = {
  enabled?: boolean;
  preventDefault?: boolean;
  stopImmediatePropagation?: boolean;
  stopPropagation?: boolean;
};
//#endregion
//#region src/locale/index.d.ts
declare const locale: {
  bgColor: string;
  cancel: string;
  codemirror: {
    copyFailed: string;
    copySuccess: string;
    mermaidExpandPreview: string;
    mermaidShrinkPreview: string;
    selectLanguage: string;
    selectTheme: string;
    showLineNumbers: string;
    tabSize: string;
    theme: string;
    useTabs: string;
  };
  confirm: string;
  file: {
    download: string;
    error: string;
    uploading: string;
  };
  image: {
    broken: string;
    download: string;
    replace: string;
  };
  link: {
    copyFailed: string;
    copyText: string;
    copyTextSuccess: string;
    copyUrl: string;
    copyUrlSuccess: string;
    edit: string;
    editLinkTitle: string;
    editTextTitle: string;
    editableInteractiveHint: string;
    open: string;
    placeholder: string;
    unlink: string;
  };
  markdown: {
    autoFormatMessage: string;
    autoFormatTitle: string;
    cancel: string;
    confirm: string;
    parseMessage: string;
    parseTitle: string;
    pasteCancel: string;
    pasteConfirm: string;
    pasteDescription: string;
    pasteTitle: string;
  };
  math: {
    placeholder: string;
  };
  meta2d: {
    editor: {
      close: string;
      delete: string;
      fit: string;
      redo: string;
      save: string;
      saving: string;
      title: string;
      undo: string;
      zoom100: string;
    };
    palette: {
      actFinal: string;
      actMerge: string;
      actStart: string;
      actStep: string;
      andGate: string;
      basicEvent: string;
      circle: string;
      cloud: string;
      cube: string;
      diamond: string;
      file: string;
      flowComment: string;
      flowData: string;
      flowDb: string;
      flowDecision: string;
      flowDisplay: string;
      flowDocument: string;
      flowExternStorage: string;
      flowInternalStorage: string;
      flowManually: string;
      flowParallel: string;
      flowPrepare: string;
      flowProcess: string;
      flowQueue: string;
      flowSubprocess: string;
      flowTerminal: string;
      forkH: string;
      forkV: string;
      groups: {
        activity: string;
        basic: string;
        faultTree: string;
        flow: string;
        sequenceClass: string;
      };
      hexagon: string;
      hint: string;
      interfaceClass: string;
      leftArrow: string;
      lifeline: string;
      line: string;
      message: string;
      orGate: string;
      pentagon: string;
      pentagram: string;
      people: string;
      rect: string;
      rightArrow: string;
      roundRect: string;
      sequenceFocus: string;
      simpleClass: string;
      square: string;
      swimlaneH: string;
      swimlaneV: string;
      text: string;
      title: string;
      triangle: string;
      twowayArrow: string;
      votingGate: string;
      xorGate: string;
    };
    props: {
      alpha: string;
      appearance: string;
      bg: string;
      bottom: string;
      bottomAlign: string;
      center: string;
      color: string;
      dash: string;
      dashLine: string;
      down: string;
      empty: string;
      h: string;
      layer: string;
      left: string;
      middle: string;
      position: string;
      radius: string;
      right: string;
      solid: string;
      text: string;
      textAlign: string;
      top: string;
      topAlign: string;
      up: string;
      v: string;
    };
  };
  modifier: {
    accept: string;
    acceptAll: string;
    reject: string;
    rejectedAll: string;
  };
  table: {
    delete: string;
    deleteColumn: string;
    deleteRow: string;
    insertColumnLeft: string;
    insertColumnRight: string;
    insertRowAbove: string;
    insertRowBelow: string;
  };
  textColor: string;
};
//#endregion
//#region src/types/locale.d.ts
/**
 * Internationalization key type declaration, plugins can extend through declaration merging
 */
type LocaleType = typeof locale;
type FlattenKeys<T, Prefix extends string = ''> = { [K in keyof T & string]: T[K] extends string ? Prefix extends '' ? K : `${Prefix}.${K}` : T[K] extends Record<string, any> ? FlattenKeys<T[K], Prefix extends '' ? K : `${Prefix}.${K}`> : never }[keyof T & string];
type ILocaleKeys = Record<FlattenKeys<LocaleType>, string>;
//#endregion
//#region src/types/kernel.d.ts
type IDecoratorFunc = (_node: LexicalNode, _editor: LexicalEditor) => any;
type IDecorator = {
  queryDOM: (_element: HTMLElement) => HTMLElement;
  render: IDecoratorFunc;
} | IDecoratorFunc;
/**
 * Service ID type
 */
type IServiceID<Service> = {
  readonly __serviceId: string;
  __serviceType?: Service;
};
interface ISelectionObject {
  endNodeId: string;
  endOffset: number;
  startNodeId: string;
  startOffset: number;
  type: 'range' | 'node' | 'table';
}
interface IDocumentOptions {
  [key: string]: unknown;
  keepHistory?: boolean;
}
interface IKernelEventMap {
  /**
   * Document change event
   */
  documentChange: (type: string, content: any) => void;
  /**
   * Editor editable state change event
   */
  editableChange: (editable: boolean) => void;
  /**
   * Editor error event
   */
  error: (error: Error) => void;
  /**
   * Initialization event
   * @param editor Lexical editor instance
   * @returns
   */
  initialized: (editor: LexicalEditor) => void;
  /**
   * handle markdown parse event
   */
  markdownParse: (params: {
    cacheState: EditorState;
    historyState: HistoryStateEntry | null;
    markdown: string;
    matchedPatterns: string[];
    score: number;
  }) => void;
  /**
   * Markdown shortcut transformation event — emitted when typing or Enter triggers
   * an auto-format (e.g. `# `→heading, `![]()`→image, `[text](url)`→link)
   */
  markdownTransform: (info: {
    trigger: 'enter' | 'type';
  }) => void;
  /**
   * handle paste event
   */
  onPaste: (event: ClipboardEvent) => void;
}
/**
 * External API
 */
interface IEditor {
  /**
   * Lose focus
   */
  blur(): void;
  /**
   * Clean editor content (clear all content)
   */
  cleanDocument(): void;
  /**
   * Destroy editor instance
   */
  destroy(): void;
  /**
   * Execute editor commands to manipulate editor content
   * @param type
   * @param payload
   */
  dispatchCommand<TCommand extends LexicalCommand<unknown>>(type: TCommand, payload: CommandPayloadType<TCommand>): boolean;
  /**
   * Focus editor
   */
  focus(): void;
  /**
   * Get editor content of specified type
   */
  getDocument(type: string): DataSource | undefined;
  /**
   * Lexical history state (undo stack metadata)
   */
  getHistoryState(): HistoryState;
  /**
   * Get Lexical editor instance
   */
  getLexicalEditor(): LexicalEditor | null;
  /**
   * Get document editor root node
   */
  getRootElement(): HTMLElement | null;
  /**
   * Get editor selection information
   */
  getSelection(): ISelectionObject | null;
  /**
   * Get document editor selection content of specified type
   * @param type
   */
  getSelectionDocument(type: string): unknown | null;
  /**
   * Get editor theme
   */
  getTheme(): Record<string, string | Record<string, string>>;
  /**
   * Get headless editor instance
   */
  initHeadlessEditor(): LexicalEditor | null;
  /**
   * Get node editor instance
   */
  initNodeEditor(): LexicalEditor | null;
  /**
   * Check if editor is editable
   */
  isEditable(): boolean;
  /**
   * Check if editor content is empty
   * @returns true if editor content is empty, false otherwise
   */
  get isEmpty(): boolean;
  /**
   * Check if editor has active selection
   * @returns true if editor has selection, false otherwise
   */
  get isSelected(): boolean;
  /**
   * Remove editor event listener
   * @param event
   * @param listener
   */
  off<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
  /**
   * Add editor event listener
   * @param event
   * @param listener
   */
  on<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
  /**
   * Listen to event once, automatically remove listener after trigger
   * @param event
   * @param listener
   */
  once<T extends keyof IKernelEventMap>(event: T, listener: IKernelEventMap[T]): this;
  /**
   * Extends the priority level of Lexical commands.
   * Registers a listener that triggers when the provided command is dispatched
   * via {@link LexicalEditor.dispatch}. The listener is triggered based on its priority.
   * Listeners with higher priority can "intercept" commands and prevent them
   * from propagating to other handlers by returning true.
   *
   * Listeners are always invoked within {@link LexicalEditor.update} and can call dollar functions.
   *
   * Listeners registered at the same priority level will deterministically run
   * in the order of registration.
   *
   * @param command - The command that triggers the callback.
   * @param listener - The function executed when the command is dispatched.
   * @param priority - The relative priority of the listener. 0 | 1 | 2 | 3 | 4
   *   (or {@link COMMAND_PRIORITY_EDITOR} |
   *     {@link COMMAND_PRIORITY_LOW} |
   *     {@link COMMAND_PRIORITY_NORMAL} |
   *     {@link COMMAND_PRIORITY_HIGH} |
   *     {@link COMMAND_PRIORITY_CRITICAL})
   * @returns A teardown function to clean up the listener.
   */
  registerHighCommand<P>(command: LexicalCommand<P>, listener: CommandListener<P>, priority: CommandListenerPriority): () => void;
  /**
   * Register keyboard shortcut
   * @param hotkey
   * @param callback
   * @param options
   */
  registerHotkey(hotkey: HotkeyId, callback: (event: KeyboardEvent, handler: HotkeysEvent) => void, options?: HotkeyOptions): () => void;
  /**
   * Register internationalization text
   * @param locale Internationalization text object
   */
  registerLocale(locale: Partial<Record<keyof ILocaleKeys, string>>): void;
  /**
   * Register editor plugin
   */
  registerPlugin<T>(plugin: IEditorPluginConstructor<T>, config?: T): IEditor;
  /**
   * Register multiple editor plugins
   */
  registerPlugins(plugins: Array<IPlugin>): IEditor;
  /**
   * Get editor Service, usually provided by plugins to extend certain functionalities
   * @param serviceId
   */
  requireService<T>(serviceId: IServiceID<T>): T | null;
  /**
   * Set editor content, type is content type, content is content data
   * @param type
   * @param content
   */
  setDocument(type: string, content: any, options?: IDocumentOptions): void;
  /**
   * Enable or disable editor editing capability
   * @param editable
   */
  setEditable(editable: boolean): void;
  /**
   * Merge locale overrides into the current map (deep merge via `merge()`).
   * Prefer passing a full `zhCN` / `enUS` when switching app language; nested keys such as `meta2d.editor` are preserved.
   * For plugin partial keys, use `registerLocale()` instead.
   */
  setLocale(locale: Partial<Record<keyof ILocaleKeys, string>>): void;
  /**
   * Set document editor root node
   * @param dom
   */
  setRootElement(dom: HTMLElement, editable?: boolean): LexicalEditor;
  /**
   * set editor selection
   * @param selection
   */
  setSelection(selection: ISelectionObject, opt?: {
    collapseToEnd?: boolean;
    collapseToStart?: boolean;
  }): Promise<boolean>;
  /**
   * Get translation text
   * @param key Translation key
   * @param params Parameter replacement
   */
  t<K extends keyof ILocaleKeys>(key: K, params?: Record<string, any>): string;
  /**
   * Update editor theme
   * @param key
   * @param value
   */
  updateTheme(key: string, value: string | Record<string, string>): void;
}
/**
 * API provided to plugins
 */
interface IEditorKernel extends IEditor {
  emit<T extends keyof IKernelEventMap>(event: T, params: Parameters<IKernelEventMap[T]>[0]): void;
  /**
   * Get editor Node decorator for specific Node rendering
   * @param name
   */
  getDecorator(name: string): IDecorator | undefined;
  /**
   * Get all registered decorator names
   */
  getRegisteredDecorators(): string[];
  /**
   * Check if hot reload mode is enabled
   */
  isHotReloadMode(): boolean;
  /**
   * Register data source for multi-format data conversion
   * @param dataSource
   */
  registerDataSource(dataSource: DataSource): void;
  /**
   * Register editor node decorator
   * @param name
   * @param decorator
   */
  registerDecorator(name: string, decorator: IDecorator): void;
  /**
   * Register Lexical Node
   * @param nodes
   */
  registerNodes(nodes: Array<LexicalNodeConfig>): void;
  /**
   * Register service
   * @param serviceId
   * @param service
   */
  registerService<T>(serviceId: IServiceID<T>, service: T): void;
  /**
   * Register service with hot reload support - allows overriding existing services
   * @param serviceId Service identifier
   * @param service Service instance
   */
  registerServiceHotReload<T>(serviceId: IServiceID<T>, service: T): void;
  /**
   * Register theme
   * @param themes
   */
  registerThemes(themes: Record<string, any>): void;
  /**
   * Enable or disable hot reload mode
   * @param enabled Whether to enable hot reload mode
   */
  setHotReloadMode(enabled: boolean): void;
  /**
   * Unregister editor node decorator
   * @param name Decorator name
   */
  unregisterDecorator(name: string): boolean;
}
/**
 * Plugin interface
 */
interface IEditorPlugin<IConfig> {
  config?: IConfig;
  /**
   * Editor destruction
   */
  destroy(): void;
  /**
   * After Lexical editor instantiation
   * @param editor Lexical editor instance
   */
  onInit?(editor: LexicalEditor): void;
}
/**
 * Plugin class interface
 */
interface IEditorPluginConstructor<IConfig> {
  readonly pluginName: string;
  new (kernel: IEditorKernel, config?: IConfig): IEditorPlugin<IConfig>;
}
type IPlugin<T = any> = IEditorPluginConstructor<T> | [IEditorPluginConstructor<T>, T?];
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
export { DEFAULT_HEADLESS_EDITOR_PLUGINS, HeadlessDocumentType, HeadlessEditor, HeadlessEditorExport, HeadlessEditorExportOptions, HeadlessEditorHydrationInput, HeadlessEditorOptions, createHeadlessEditor };