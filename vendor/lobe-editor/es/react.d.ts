import { H as IEditor$1, J as ILocaleKeys, T as ReactPlainTextProps, X as locale, _ as ChatInputActionsProps, a as ReactSlashOptionProps, h as ChatInputActionEvent, i as MenuRenderProps, w as ReactEditorContentProps, y as ReactMentionPluginProps } from "./index-B8hrjelq.js";
import * as _$react_jsx_runtime0 from "react/jsx-runtime";
import * as _$react from "react";
import { CSSProperties, ComponentProps, FC, ReactNode, Ref } from "react";
import { BlockProps, FlexboxProps, MenuInfo, MenuItemType, MenuProps, SelectProps, TooltipProps } from "@lobehub/ui";
import { DropdownButtonProps } from "antd/lib/dropdown/index.js";

//#region src/react/ChatInput/type.d.ts
interface ChatInputProps extends Omit<FlexboxProps, 'height'> {
  classNames?: {
    body?: string;
    footer?: string;
    header?: string;
  };
  defaultHeight?: number;
  footer?: ReactNode;
  fullscreen?: boolean;
  header?: ReactNode;
  height?: number;
  maxHeight?: number;
  minHeight?: number;
  onBodyClick?: FlexboxProps['onClick'];
  onSizeChange?: (height: number) => void;
  onSizeDragging?: (height: number) => void;
  resize?: boolean;
  resizeMaxHeightOffset?: number;
  showResizeHandle?: boolean;
  slashMenuRef?: Ref<HTMLDivElement>;
  styles?: {
    body?: CSSProperties;
    footer?: CSSProperties;
    header?: CSSProperties;
  };
}
//#endregion
//#region src/react/ChatInput/ChatInput.d.ts
declare const ChatInput: FC<ChatInputProps>;
//#endregion
//#region src/react/ChatInputActionBar/type.d.ts
interface ChatInputActionBarProps extends Omit<FlexboxProps, 'children'> {
  left?: ReactNode;
  right?: ReactNode;
}
//#endregion
//#region src/react/ChatInputActionBar/ChatInputActionBar.d.ts
declare const ChatInputActionBar: FC<ChatInputActionBarProps>;
//#endregion
//#region src/react/ChatInputActions/ChatInputActions.d.ts
declare const ChatInputActions: _$react.NamedExoticComponent<ChatInputActionsProps>;
//#endregion
//#region src/react/CodeLanguageSelect/type.d.ts
type CodeLanguageSelectProps = Omit<SelectProps, 'options'>;
//#endregion
//#region src/react/CodeLanguageSelect/CodeLanguageSelect.d.ts
declare const CodeLanguageSelect: FC<CodeLanguageSelectProps>;
//#endregion
//#region src/react/ColorPickerBtn.d.ts
interface ColorPickerBtnProps {
  active?: boolean;
  defaultColor?: string;
  editor?: IEditor$1;
  icon?: any;
  label?: string;
  onChange?: (color: string) => void;
  value?: string;
}
declare const ColorPickerBtn: FC<ColorPickerBtnProps>;
//#endregion
//#region src/react/hooks/useEditor.d.ts
declare const useEditor: () => IEditor$1;
//#endregion
//#region src/react/hooks/useEditorState/index.d.ts
/**
 * Editor state and toolbar methods return type
 */
interface EditorState {
  /** Current background color of the selection */
  bgColor: string;
  /** Current block type (e.g., 'paragraph', 'h1', 'h2', 'bullet', 'number', 'code') */
  blockType: string | null;
  /** Format selection as blockquote */
  blockquote: () => void;
  /** Toggle bold formatting */
  bold: () => void;
  /** Toggle bullet list */
  bulletList: () => void;
  /** Whether redo operation is available */
  canRedo: boolean;
  /** Whether undo operation is available */
  canUndo: boolean;
  /** Toggle check list */
  checkList: () => void;
  /** Toggle code formatting */
  code: () => void;
  /** Format selection as code block */
  codeblock: () => void;
  /** Current code block language */
  codeblockLang: string | null | undefined;
  /** Insert or toggle link */
  insertLink: () => void;
  /** Insert math (inline or block based on context) */
  insertMath: () => void;
  /** Whether cursor is inside a blockquote */
  isBlockquote: boolean;
  /** Whether selection has bold formatting */
  isBold: boolean;
  /** Whether selection has code formatting */
  isCode: boolean;
  /** Whether cursor is inside a code block */
  isCodeblock: boolean;
  /** Whether editor content is empty */
  isEmpty: boolean;
  /** Whether selection has italic formatting */
  isItalic: boolean;
  /** Whether editor has selection */
  isSelected: boolean;
  /** Whether selection has strikethrough formatting */
  isStrikethrough: boolean;
  /** Whether selection has underline formatting */
  isUnderline: boolean;
  /** Toggle italic formatting */
  italic: () => void;
  /** Toggle numbered list */
  numberList: () => void;
  /** Redo last operation */
  redo: () => void;
  /** Set background color for selection */
  setBgColor: (color: string) => void;
  /** Set text color for selection */
  setTextColor: (color: string) => void;
  /** Toggle strikethrough formatting */
  strikethrough: () => void;
  /** Current text color of the selection */
  textColor: string;
  /** Toggle underline formatting */
  underline: () => void;
  /** Undo last operation */
  undo: () => void;
  /** Update code block language */
  updateCodeblockLang: (lang: string) => void;
}
/**
 * Provide toolbar state and toolbar methods
 * @param editor - Editor instance
 * @returns Editor state and methods for toolbar functionality
 */
declare function useEditorState(editor?: IEditor$1): EditorState;
//#endregion
//#region src/react/Editor/type.d.ts
type EditorPlugin = FC<any> | [FC<any>, Record<string, any>];
interface MentionOption extends Partial<ReactSlashOptionProps> {
  markdownWriter?: ReactMentionPluginProps['markdownWriter'];
}
interface EditorProps extends Partial<ReactEditorContentProps>, Omit<ReactPlainTextProps, 'children'> {
  autoFocus?: boolean;
  /**
   * Automatically convert pasted markdown once the detection threshold is reached
   * @default true
   */
  autoFormatMarkdown?: boolean;
  children?: ReactNode;
  className?: string;
  /**
   * When true, shows a built-in confirmation dialog when markdown is detected on paste.
   * The dialog asks the user whether to convert to rich text or keep as plain text.
   * Supports zh-CN / en-US via editor locale.
   */
  confirmPasteMarkdown?: boolean;
  /**
   * Debounce wait time in milliseconds for onChange and onTextChange callbacks
   * @default 100
   */
  debounceWait?: number;
  editable?: boolean;
  editor?: IEditor$1;
  /**
   * Enable automatic markdown conversion for pasted content
   * @default true
   */
  enablePasteMarkdown?: boolean;
  /** Custom popup container for slash menu portal rendering and scroll tracking */
  getPopupContainer?: () => HTMLElement | null;
  markdownOption?: boolean | {
    bold?: boolean;
    code?: boolean;
    header?: boolean;
    italic?: boolean;
    quote?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    underlineStrikethrough?: boolean;
  };
  mentionOption?: MentionOption;
  onInit?: (editor: IEditor$1) => void;
  /**
   * Callback when markdown is detected in pasted text.
   * Return `true` to convert, `false` to paste as plain text.
   * Supports async (Promise<boolean>) for confirmation dialogs.
   */
  onPasteMarkdown?: (text: string) => boolean | Promise<boolean>;
  /**
   * Callback triggered only when text content changes
   * Unlike onChange, this won't trigger on cursor movement or selection changes
   */
  onTextChange?: (editor: IEditor$1) => void;
  plugins?: EditorPlugin[];
  slashOption?: Partial<ReactSlashOptionProps>;
  /** Force slash menu placement direction, skipping auto-flip detection */
  slashPlacement?: 'bottom' | 'top';
  style?: CSSProperties;
}
//#endregion
//#region src/react/Editor/utils.d.ts
declare function withProps<T extends FC<any>>(plugin: T, props: ComponentProps<T>): [T, ComponentProps<T>];
//#endregion
//#region src/react/Editor/index.d.ts
interface IEditor {
  (props: EditorProps): ReactNode;
  useEditor: typeof useEditor;
  useEditorState: typeof useEditorState;
  withProps: typeof withProps;
}
declare const Editor: IEditor;
//#endregion
//#region src/react/EditorProvider/index.d.ts
type LocaleType = typeof locale;
interface EditorProviderConfig {
  [key: string]: any;
  locale?: Partial<LocaleType>;
  theme?: Record<string, any>;
}
interface EditorContextValue {
  config: EditorProviderConfig;
}
interface EditorProviderProps {
  children: ReactNode;
  config?: EditorProviderConfig;
}
declare const EditorProvider: {
  ({
    children,
    config
  }: EditorProviderProps): _$react_jsx_runtime0.JSX.Element;
  displayName: string;
};
declare const useEditorContent: () => EditorContextValue;
//#endregion
//#region src/react/FloatActions/type.d.ts
type FloatActionsEvent = Pick<MenuInfo, 'key' | 'keyPath' | 'domEvent'>;
interface ActionItem extends MenuItemType {
  active?: boolean;
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
  editor?: IEditor$1;
  icon?: any;
  key: string;
  label: string;
  onChange?: (color: string) => void;
  type: 'colorPicker';
  value?: string;
  wrapper?: (dom: ReactNode) => ReactNode;
};
type FloatActionsItem = ActionItem | DividerItem | CollapseItem | DropdownItem | ColorPickerItem;
interface FloatActionsProps extends Omit<FlexboxProps, 'children'> {
  defaultGroupCollapse?: boolean;
  disabled?: boolean;
  groupCollapse?: boolean;
  items?: FloatActionsItem[];
  onActionClick?: (action: FloatActionsEvent) => void;
  onGroupCollapseChange?: (collapse: boolean) => void;
}
//#endregion
//#region src/react/FloatActions/FloatActions.d.ts
declare const FloatActions: FC<FloatActionsProps>;
//#endregion
//#region src/react/FloatMenu/type.d.ts
interface FloatMenuProps {
  children?: ReactNode;
  className?: string;
  classNames?: {
    container?: string;
    root?: string;
  };
  containerProps?: Omit<BlockProps, 'children'>;
  getPopupContainer: () => HTMLDivElement | null;
  maxHeight?: string | number;
  open?: boolean;
  /** Menu placement direction: 'top' (default) or 'bottom' */
  placement?: 'bottom' | 'top';
  style?: CSSProperties;
  styles?: {
    container?: CSSProperties;
    root?: CSSProperties;
  };
}
//#endregion
//#region src/react/FloatMenu/FloatMenu.d.ts
declare const FloatMenu: FC<FloatMenuProps>;
//#endregion
//#region src/react/hooks/useEditorLocale/index.d.ts
interface UseEditorLocaleResult {
  /** Replace the entire locale map, triggering a re-render. */
  setLocale: (locale: Partial<Record<keyof ILocaleKeys, string>>) => void;
  /** Translate a locale key. Re-renders when locale changes. */
  t: (key: string, params?: Record<string, any>) => string;
}
/**
 * React hook for editor locale access.
 *
 * Usage inside editor tree:
 * ```tsx
 * const { t, setLocale } = useEditorLocale();
 * setLocale(zhCN);
 * ```
 *
 * Usage with explicit editor instance (outside editor context):
 * ```tsx
 * const { t, setLocale } = useEditorLocale(editor);
 * ```
 */
declare function useEditorLocale(editor?: IEditor$1): UseEditorLocaleResult;
//#endregion
//#region src/react/SendButton/type.d.ts
interface SendButtonProps extends Omit<DropdownButtonProps, 'children' | 'icon' | 'size'> {
  generating?: boolean;
  onSend?: DropdownButtonProps['onClick'];
  onStop?: DropdownButtonProps['onClick'];
  shape?: 'default' | 'round';
  size?: number;
}
//#endregion
//#region src/react/SendButton/SendButton.d.ts
declare const SendButton: FC<SendButtonProps>;
//#endregion
//#region src/react/SlashMenu/type.d.ts
interface SlashMenuProps extends MenuRenderProps, Omit<FloatMenuProps, 'children'> {
  classNames?: FloatMenuProps['classNames'] & {
    menu?: string;
  };
  menuProps?: MenuProps;
  styles?: FloatMenuProps['styles'] & {
    menu?: CSSProperties;
  };
}
//#endregion
//#region src/react/SlashMenu/SlashMenu.d.ts
declare const SlashMenu: FC<SlashMenuProps>;
//#endregion
export { ChatInput, ChatInputActionBar, type ChatInputActionBarProps, type ChatInputActionEvent, ChatInputActions, type ChatInputActionsProps, type ChatInputProps, CodeLanguageSelect, type CodeLanguageSelectProps, ColorPickerBtn, type ColorPickerBtnProps, Editor, type EditorProps, EditorProvider, type EditorProviderConfig, type EditorProviderProps, type EditorState, FloatActions, type FloatActionsProps, FloatMenu, type FloatMenuProps, SendButton, type SendButtonProps, SlashMenu, type SlashMenuProps, type UseEditorLocaleResult, useEditor, useEditorContent, useEditorLocale, useEditorState, withProps };