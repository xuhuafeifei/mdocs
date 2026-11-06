import { HistoryState, HistoryStateEntry } from "@lexical/history";
import * as _$lexical from "lexical";
import { CommandListener, CommandListenerPriority, CommandPayloadType, DOMConversionMap, DOMExportOutput, DecoratorNode, EditorConfig, EditorState, ElementNode, LexicalCommand, LexicalEditor, LexicalNode, LexicalNodeConfig, LexicalUpdateJSON, RangeSelection, SerializedLexicalNode, Spread, TextNode } from "lexical";
import { HeadingTagType } from "@lexical/rich-text";
import * as _$react from "react";
import React, { CSSProperties, CompositionEvent, FC, FocusEvent, MouseEvent, ReactElement, ReactNode } from "react";
import { DropdownMenuItemType, FlexboxProps, MenuInfo, MenuItemType, TooltipProps } from "@lobehub/ui";
import Fuse, { IFuseOptions } from "fuse.js";

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
declare const KeyEnum: {
  readonly Alt: "alt";
  readonly Backquote: "backquote";
  readonly Backslash: "backslash";
  readonly Backspace: "backspace";
  readonly BracketLeft: "bracketleft";
  readonly BracketRight: "bracketright";
  readonly Comma: "comma";
  readonly Ctrl: "ctrl";
  readonly Down: "down";
  readonly Enter: "enter";
  readonly Equal: "equal";
  readonly Esc: "esc";
  readonly Left: "left";
  readonly LeftClick: "left-click";
  readonly LeftDoubleClick: "left-double-click";
  readonly Meta: "meta";
  readonly MiddleClick: "middle-click";
  readonly Minus: "minus";
  readonly Mod: "mod";
  readonly Number: "1-9";
  readonly Period: "period";
  readonly Plus: "equal";
  readonly QuestionMark: "slash";
  readonly Quote: "quote";
  readonly Right: "right";
  readonly RightClick: "right-click";
  readonly RightDoubleClick: "right-double-click";
  readonly Semicolon: "semicolon";
  readonly Shift: "shift";
  readonly Slash: "slash";
  readonly Space: "space";
  readonly Tab: "tab";
  readonly Up: "up";
  readonly Zero: "0";
};
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
declare const HotkeyScopeEnum: {
  readonly Format: "format";
  readonly Insert: "insert";
  readonly Plugin: "plugin";
  readonly Slash: "slash";
};
type HotkeyId = (typeof HotkeyEnum)[keyof typeof HotkeyEnum];
type HotkeyScopeId = (typeof HotkeyScopeEnum)[keyof typeof HotkeyScopeEnum];
interface HotkeyItem {
  id: HotkeyId;
  keys: string;
  priority: CommandListenerPriority;
  scopes?: HotkeyScopeId[];
}
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
declare const getHotkeyById: (id: HotkeyId) => HotkeyItem;
//#endregion
//#region src/locale/zh-CN.d.ts
declare const zhCN: {
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
declare const enUS: {
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
//#region src/plugins/common/command/index.d.ts
declare const INSERT_QUOTE_COMMAND: _$lexical.LexicalCommand<unknown>;
declare const INSERT_HEADING_COMMAND: _$lexical.LexicalCommand<{
  tag: HeadingTagType;
}>;
//#endregion
//#region src/plugins/common/markmap-utils.d.ts
/**
 * Markmap 节点类型（简化版，只包含递归折叠需要的字段）
 * markmap 官方类型没有直接导出，因此定义本地接口
 */
interface IMapNode {
  children: IMapNode[];
  payload?: {
    fold?: number;
  };
}
/**
 * 递归统计节点总数
 */
declare function countNodes(node: IMapNode): number;
/**
 * 递归设置所有节点的折叠状态
 * @param fold true=折叠, false=展开
 */
declare function setFoldAll(node: IMapNode, fold: boolean): void;
//#endregion
//#region src/plugins/common/node/cursor.d.ts
declare class CardLikeElementNode extends ElementNode {
  isCardLike(): boolean;
}
declare const cursorNodeSerialized: SerializedLexicalNode;
declare class CursorNode extends TextNode {
  static getType(): string;
  isUnmergeable(): boolean;
}
declare function $createCursorNode(): CursorNode;
declare function $isCardLikeElementNode(node: LexicalNode | null | undefined): node is CardLikeElementNode;
declare function $isCursorNode(node: LexicalNode | null | undefined): node is CursorNode;
//#endregion
//#region src/plugins/common/plugin/paste-handler.d.ts
/**
 * Configuration options relevant to paste handling
 */
interface PasteHandlerConfig {
  pasteVSCodeAsCodeBlock?: boolean;
}
//#endregion
//#region src/plugins/common/plugin/index.d.ts
interface CommonPluginOptions extends PasteHandlerConfig {
  enableHotkey?: boolean;
  /**
   * Enable/disable markdown shortcuts
   * @default true - most formats enabled, but subscript/superscript are disabled by default
   */
  markdownOption?: boolean | {
    bold?: boolean;
    code?: boolean;
    header?: boolean;
    italic?: boolean;
    quote?: boolean;
    strikethrough?: boolean;
    subscript?: boolean;
    superscript?: boolean;
    underline?: boolean;
    underlineStrikethrough?: boolean;
  };
  /**
   * Force paste as plain text, stripping all rich text formatting
   * @default false
   */
  pasteAsPlainText?: boolean;
  theme?: {
    quote?: string;
    textBold?: string;
    textCode?: string;
    textHighlight?: string;
    textItalic?: string;
    textStrikethrough?: string;
    textSubscript?: string;
    textSuperscript?: string;
    textUnderline?: string;
    textUnderlineStrikethrough?: string;
  };
}
declare const CommonPlugin: IEditorPluginConstructor<CommonPluginOptions>;
//#endregion
//#region src/plugins/common/react/MarkmapWithErrorBoundary.d.ts
interface MarkmapWithErrorBoundaryProps {
  children: string;
  enableImagePreview?: boolean;
}
/**
 * 带完整错误处理的 Markmap 包装组件
 *
 * 错误捕获层级：
 * 1. 预解析检测：Transformer.transform() 转换 Markdown 为 markmap 数据
 * 2. 渲染错误边界：Class ErrorBoundary 捕获 React 渲染期间的错误
 * 3. 代码变化时自动重置错误状态
 */
declare const MarkmapWithErrorBoundary: React.NamedExoticComponent<MarkmapWithErrorBoundaryProps>;
//#endregion
//#region src/plugins/common/react/MermaidWithErrorBoundary.d.ts
interface MermaidWithErrorBoundaryProps {
  animated?: boolean;
  children: string;
  copyable?: boolean;
  enableImagePreview?: boolean;
  fullFeatured?: boolean;
  key?: string;
  showLanguage?: boolean;
  style?: React.CSSProperties;
  theme?: 'base' | 'default' | 'lobe-theme' | 'dark' | 'forest' | 'neutral' | 'neo' | 'neo-dark' | 'redux' | 'redux-dark' | 'redux-color' | 'redux-dark-color' | 'null';
  variant?: 'filled' | 'outlined' | 'borderless';
}
/**
 * 带完整错误处理的 Mermaid 包装组件
 *
 * 错误捕获层级：
 * 1. 预解析检测：mermaid.parse() 异步检测语法错误（能捕获 parse 阶段的错误）
 * 2. 渲染错误边界：Class ErrorBoundary 捕获 React 渲染期间的错误（能捕获 render 阶段的错误）
 * 3. 代码变化时自动重置错误状态
 *
 * 布局稳定：
 * - 同 code 的 SVG 缓存在模块级 Map，发布/只读重挂载可同步复用，避免高度塌陷跳动
 * - 无缓存时用占位高度，不再 `return null`
 */
declare const MermaidWithErrorBoundary: React.NamedExoticComponent<MermaidWithErrorBoundaryProps>;
//#endregion
//#region src/plugins/common/react/type.d.ts
interface ReactEditorContentProps {
  content: any;
  lineEmptyPlaceholder?: string;
  placeholder?: ReactNode;
  type: string;
}
interface ReactPlainTextProps {
  autoFocus?: boolean;
  /**
   * Automatically convert pasted markdown once the detection threshold is reached
   * @default true
   */
  autoFormatMarkdown?: boolean;
  children: ReactElement<ReactEditorContentProps>;
  className?: string;
  editable?: boolean;
  enableHotkey?: boolean;
  /**
   * Enable automatic markdown conversion for pasted content
   * @default true
   */
  enablePasteMarkdown?: boolean;
  /**
   * Enable/disable markdown shortcuts
   * @default true - all formats enabled
   */
  markdownOption?: CommonPluginOptions['markdownOption'];
  onBlur?: (props: {
    editor: IEditor;
    event: FocusEvent<HTMLDivElement>;
  }) => void;
  onChange?: (editor: IEditor) => void;
  onCompositionEnd?: (props: {
    editor: IEditor;
    event: CompositionEvent<HTMLDivElement>;
  }) => void;
  onCompositionStart?: (props: {
    editor: IEditor;
    event: CompositionEvent<HTMLDivElement>;
  }) => void;
  onContextMenu?: (props: {
    editor: IEditor;
    event: MouseEvent<HTMLDivElement>;
  }) => void;
  onFocus?: (props: {
    editor: IEditor;
    event: FocusEvent<HTMLDivElement>;
  }) => void;
  onKeyDown?: (props: {
    editor: IEditor;
    event: KeyboardEvent;
  }) => boolean | void;
  /**
   * Callback when markdown is detected in pasted text.
   * Return `true` to convert, `false` to paste as plain text.
   * Supports async (Promise<boolean>) for confirmation dialogs.
   */
  onPasteMarkdown?: (text: string) => boolean | Promise<boolean>;
  onPressEnter?: (props: {
    editor: IEditor;
    event: KeyboardEvent;
  }) => boolean | void;
  /**
   * Callback triggered only when text content changes
   * Unlike onChange, this won't trigger on cursor movement or selection changes
   */
  onTextChange?: (editor: IEditor) => void;
  /**
   * Force paste as plain text, stripping all rich text formatting
   * @default false
   */
  pasteAsPlainText?: boolean;
  /**
   * When pasting VS Code content (detected via vscode-editor-data clipboard type),
   * create a code block with the language from VS Code instead of pasting as plain text.
   * This option only takes effect when pasteAsPlainText is enabled.
   * @default true
   */
  pasteVSCodeAsCodeBlock?: boolean;
  style?: CSSProperties;
  theme?: CommonPluginOptions['theme'] & {
    fontSize?: number;
    headerMultiple?: number;
    lineHeight?: number;
    marginMultiple?: number;
  };
  variant?: 'default' | 'chat';
}
//#endregion
//#region src/plugins/common/react/ReactEditorContent.d.ts
declare const ReactEditorContent: FC<ReactEditorContentProps>;
//#endregion
//#region src/plugins/common/react/ReactPlainText.d.ts
declare const ReactPlainText: _$react.NamedExoticComponent<ReactPlainTextProps>;
//#endregion
//#region src/plugins/mention/node/MentionNode.d.ts
type SerializedMentionNode = Spread<{
  label?: string;
  metadata?: Record<string, unknown>;
}, SerializedLexicalNode>;
declare class MentionNode extends DecoratorNode<any> {
  static getType(): string;
  static clone(node: MentionNode): MentionNode;
  static importJSON(serializedNode: SerializedMentionNode): MentionNode;
  static importDOM(): DOMConversionMap | null;
  __label: string;
  __metadata: Record<string, unknown>;
  constructor(label?: string, metadata?: Record<string, unknown>, key?: string);
  get label(): string;
  get metadata(): Record<string, unknown>;
  exportDOM(): DOMExportOutput;
  createDOM(config: EditorConfig): HTMLElement;
  getTextContent(): string;
  isInline(): true;
  updateDOM(): boolean;
  exportJSON(): SerializedMentionNode;
  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedMentionNode>): this;
  decorate(editor: LexicalEditor): any;
}
//#endregion
//#region src/plugins/mention/react/type.d.ts
interface ReactMentionPluginProps {
  className?: string;
  markdownWriter?: (file: MentionNode) => string;
  theme?: {
    mention?: string;
  };
}
//#endregion
//#region src/plugins/mention/react/ReactMentionPlugin.d.ts
declare const ReactMentionPlugin: FC<ReactMentionPluginProps>;
//#endregion
//#region src/react/ChatInputActions/type.d.ts
type ChatInputActionEvent = Pick<MenuInfo, 'key' | 'keyPath' | 'domEvent'>;
interface ActionItem extends MenuItemType {
  active?: boolean;
  alwaysDisplay?: boolean;
  children?: ReactNode;
  tooltipProps?: TooltipProps;
  wrapper?: (dom: ReactNode) => ReactNode;
}
type DividerItem = {
  type: 'divider';
};
type CollapseItem = {
  children: (ActionItem | DividerItem)[];
  type: 'collapse';
};
type DropdownItem = Omit<ActionItem, 'children' | 'type'> & {
  children: MenuItemType[];
  type: 'dropdown';
};
type ColorPickerItem = {
  active?: boolean;
  defaultColor?: string;
  editor?: IEditor;
  icon?: any;
  key: string;
  label: string;
  onChange?: (color: string) => void;
  type: 'colorPicker';
  value?: string;
  wrapper?: (dom: ReactNode) => ReactNode;
};
type ChatInputActionItem = ActionItem | DividerItem | CollapseItem | DropdownItem | ColorPickerItem;
interface ChatInputActionsProps extends Omit<FlexboxProps, 'children'> {
  autoCollapse?: boolean;
  collapseOffset?: number;
  defaultGroupCollapse?: boolean;
  disabled?: boolean;
  groupCollapse?: boolean;
  items?: ChatInputActionItem[];
  onActionClick?: (action: ChatInputActionEvent) => void;
  onGroupCollapseChange?: (collapse: boolean) => void;
}
//#endregion
//#region src/plugins/slash/service/i-slash-service.d.ts
type ISlashDividerOption = {
  type: 'divider';
};
interface ISlashMenuOption extends DropdownMenuItemType {
  metadata?: Record<string, any>;
  onSelect?: (editor: IEditor, matchingString: string) => void;
}
type ISlashOption = ISlashMenuOption | ISlashDividerOption;
interface SlashOptions {
  allowWhitespace?: boolean;
  /**
   * Complete Fuse.js configuration options
   * @example
   * {
   *   keys: ['key', 'label', 'description'],
   *   threshold: 0.3,
   *   includeScore: true,
   *   includeMatches: true
   * }
   */
  fuseOptions?: IFuseOptions<ISlashMenuOption>;
  items: Array<ISlashOption> | ((search: {
    leadOffset: number;
    matchingString: string;
    replaceableString: string;
  } | null) => Promise<Array<ISlashOption>>);
  maxLength?: number;
  minLength?: number;
  punctuation?: string;
  /**
   * Fuse.js search keys for fuzzy matching
   * Default is ['key']
   * @example ['key', 'label', 'description']
   * @deprecated Use fuseOptions instead
   */
  searchKeys?: string[];
  trigger: string;
}
interface ISlashService {
  registerSlash(options: SlashOptions): void;
  updateOptions(options: SlashOptions[]): void;
}
declare const ISlashService: IServiceID<ISlashService>;
//#endregion
//#region src/plugins/slash/plugin/index.d.ts
interface ITriggerContext {
  getRect: () => DOMRect;
  items: Array<ISlashOption> | ((search: {
    leadOffset: number;
    matchingString: string;
    replaceableString: string;
  } | null) => Promise<Array<ISlashOption>>);
  lastIndex: number;
  match?: {
    leadOffset: number;
    matchingString: string;
    replaceableString: string;
  } | null;
  trigger: SlashOptions['trigger'];
}
interface SlashPluginOptions {
  slashOptions?: SlashOptions[];
  triggerClose: () => void;
  triggerOpen: (ctx: ITriggerContext) => void;
}
declare const SlashPlugin: IEditorPluginConstructor<SlashPluginOptions>;
//#endregion
//#region src/plugins/slash/react/type.d.ts
interface ReactSlashOptionProps {
  /**
   * Complete Fuse.js configuration options
   * @example
   * {
   *   keys: ['key', 'label', 'description'],
   *   threshold: 0.3,
   *   includeScore: true,
   *   includeMatches: true
   * }
   */
  fuseOptions?: IFuseOptions<ISlashMenuOption>;
  /**
   * Searchable options
   */
  items?: SlashOptions['items'];
  /**
   * Maximum search length
   * Default is 75
   */
  maxLength?: number;
  onSelect?: (editor: IEditor, option: ISlashMenuOption) => void;
  /**
   * Custom render component
   */
  renderComp?: FC<MenuRenderProps>;
  /**
   * Fuse.js search keys for fuzzy matching
   * Default is ['key']
   * @example ['key', 'label', 'description']
   * @deprecated Use fuseOptions instead
   */
  searchKeys?: string[];
  /**
   * Trigger character
   */
  trigger?: SlashOptions['trigger'];
}
interface MenuRenderProps {
  /**
   * Current active option key
   */
  activeKey: string | null;
  /**
   * Loading state
   */
  loading?: boolean;
  /**
   * Actively trigger selection
   * @param option Currently selected element
   */
  onSelect?: (option: ISlashMenuOption) => void;
  open?: boolean;
  /**
   * Currently searched options
   */
  options: Array<ISlashOption>;
  /**
   * Actively set current active option key
   * @param key
   * @returns
   */
  setActiveKey: (key: string | null) => void;
}
/**
 * SlashMenu component props - only responsible for rendering
 */
interface SlashMenuProps {
  /** Current active option key */
  activeKey: string | null;
  /** Anchor element className */
  anchorClassName?: string;
  /** Custom render component if provided */
  customRender?: FC<MenuRenderProps>;
  /** Custom popup container for portal rendering and scroll tracking */
  getPopupContainer?: () => HTMLElement | null;
  /** Loading state */
  loading: boolean;
  /** Callback to set active key */
  onActiveKeyChange: (key: string | null) => void;
  /** Callback when menu should close */
  onClose: () => void;
  /** Callback when an option is selected */
  onSelect: (option: ISlashMenuOption) => void;
  /** Whether the menu is open */
  open: boolean;
  /** Available options to display */
  options: Array<ISlashOption>;
  /** Force menu placement direction, skipping auto-flip detection */
  placement?: 'bottom' | 'top';
  /** Menu position */
  position: {
    getRect?: () => DOMRect;
    rect?: DOMRect;
    x: number;
    y: number;
  };
}
interface ReactSlashPluginProps {
  anchorClassName?: string;
  children?: (ReactElement<ReactSlashOptionProps> | undefined) | (ReactElement<ReactSlashOptionProps> | undefined)[];
  /** Custom popup container for portal rendering and scroll tracking */
  getPopupContainer?: () => HTMLElement | null;
  /** Force menu placement direction, skipping auto-flip detection */
  placement?: 'bottom' | 'top';
}
//#endregion
//#region src/plugins/slash/react/components/SlashMenu.d.ts
/**
 * SlashMenu component - Only responsible for rendering the menu UI
 * All state management and plugin registration is handled by ReactSlashPlugin
 */
declare const SlashMenu: FC<SlashMenuProps>;
//#endregion
//#region src/plugins/slash/react/ReactSlashOption.d.ts
declare const ReactSlashOption: FC<ReactSlashOptionProps>;
//#endregion
//#region src/plugins/slash/react/ReactSlashPlugin.d.ts
declare const ReactSlashPlugin: FC<ReactSlashPluginProps>;
//#endregion
export { HotkeysEvent as $, $createCursorNode as A, IDecorator as B, ReactEditorContent as C, MarkmapWithErrorBoundary as D, MermaidWithErrorBoundary as E, IMapNode as F, IPlugin as G, IEditor as H, countNodes as I, ILocaleKeys as J, ISelectionObject as K, setFoldAll as L, $isCursorNode as M, CardLikeElementNode as N, CommonPlugin as O, cursorNodeSerialized as P, HotkeyOptions as Q, INSERT_HEADING_COMMAND as R, ReactPlainText as S, ReactPlainTextProps as T, IEditorKernel as U, IDocumentOptions as V, IEditorPluginConstructor as W, locale as X, enUS as Y, zhCN as Z, ChatInputActionsProps as _, ReactSlashOptionProps as a, HotkeyScopeId as at, MentionNode as b, ITriggerContext as c, DataSource as ct, ISlashMenuOption as d, getHotkeyById as et, ISlashOption as f, ChatInputActionItem as g, ChatInputActionEvent as h, MenuRenderProps as i, HotkeyScopeEnum as it, $isCardLikeElementNode as j, CommonPluginOptions as k, SlashPlugin as l, SlashOptions as m, ReactSlashOption as n, HotkeyId as nt, ReactSlashPluginProps as o, KeyEnum as ot, ISlashService as p, IServiceID as q, SlashMenu as r, HotkeyItem as rt, SlashMenuProps as s, ModifierCombination as st, ReactSlashPlugin as t, HotkeyEnum as tt, SlashPluginOptions as u, ReactMentionPlugin as v, ReactEditorContentProps as w, SerializedMentionNode as x, ReactMentionPluginProps as y, INSERT_QUOTE_COMMAND as z };