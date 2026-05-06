/**
 * 编辑器工具栏组件
 * 为 @lobehub/editor 提供格式化、插入、撤销/重做等常用操作按钮。
 * 支持两种模式：
 * 1. 顶部固定工具栏（默认）
 * 2. 浮动工具栏（floating=true，用于选中文本时的快捷操作）
 */
import {
  HotkeyEnum,
  IEditor,
  INSERT_FILE_COMMAND,
  INSERT_IMAGE_COMMAND,
  getHotkeyById,
  useOutlineActionItem,
} from "@lobehub/editor";
import {
  ChatInputActions,
  CodeLanguageSelect,
  FloatActions,
  useEditorState,
  type ChatInputActionsProps,
} from "@lobehub/editor/react";
import {
  BoldIcon,
  CodeXmlIcon,
  FileUpIcon,
  HighlighterIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MessageSquareQuote,
  Redo2Icon,
  SigmaIcon,
  SquareDashedBottomCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";
import { type CSSProperties, type FC, useMemo } from "react";

import { openFileSelector } from "./actions";

export interface ToolbarProps {
  className?: string;
  editor: IEditor;
  floating?: boolean;
  outlineCollapseTitle?: string;
  outlineExpandTitle?: string;
  outlineToggle?: boolean;
  style?: CSSProperties;
}

/**
 * 生成格式类工具栏项（粗体、斜体、下划线、删除线、文字颜色、背景色）。
 */
function getFormatItems(editorState: ReturnType<typeof useEditorState>, editor: IEditor) {
  return [
    {
      active: editorState.isBold,
      icon: BoldIcon,
      key: "bold",
      label: "Bold",
      onClick: editorState.bold,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Bold).keys },
    },
    {
      active: editorState.isItalic,
      icon: ItalicIcon,
      key: "italic",
      label: "Italic",
      onClick: editorState.italic,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Italic).keys },
    },
    {
      active: editorState.isUnderline,
      icon: UnderlineIcon,
      key: "underline",
      label: "Underline",
      onClick: editorState.underline,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Underline).keys },
    },
    {
      active: editorState.isStrikethrough,
      icon: StrikethroughIcon,
      key: "strikethrough",
      label: "Strikethrough",
      onClick: editorState.strikethrough,
      tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Strikethrough).keys },
    },
    // 分隔线
    { type: "divider" as const },
    {
      active: !!editorState.textColor,
      editor,
      key: "textColor",
      label: "Text Color",
      onChange: editorState.setTextColor,
      type: "colorPicker" as const,
      value: editorState.textColor,
    },
    {
      active: !!editorState.bgColor,
      defaultColor: "#ffffff",
      editor,
      icon: HighlighterIcon,
      key: "bgColor",
      label: "Background Color",
      onChange: editorState.setBgColor,
      type: "colorPicker" as const,
      value: editorState.bgColor,
    },
  ];
}

const Toolbar: FC<ToolbarProps> = ({
  editor,
  floating,
  outlineCollapseTitle,
  outlineExpandTitle,
  outlineToggle,
  style,
  className,
}) => {
  /**
   * 获取编辑器当前格式状态（是否加粗、斜体等）以及大纲操作项。
   */
  const editorState = useEditorState(editor);
  const outlineAction = useOutlineActionItem({
    collapseTitle: outlineCollapseTitle,
    expandTitle: outlineExpandTitle,
  });

  /**
   * 顶部工具栏按钮项配置：撤销/重做、格式、列表、引用、链接、代码、图片、文件、大纲等。
   */
  const items = useMemo(
    () =>
      [
        {
          disabled: !editorState.canUndo,
          icon: Undo2Icon,
          key: "undo",
          label: "Undo",
          onClick: editorState.undo,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Undo).keys },
        },
        {
          disabled: !editorState.canRedo,
          icon: Redo2Icon,
          key: "redo",
          label: "Redo",
          onClick: editorState.redo,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Redo).keys },
        },
        // 分隔线
        { type: "divider" },
        // 展开格式类按钮（粗体、斜体等）
        ...getFormatItems(editorState, editor),
        // 分隔线
        { type: "divider" },
        {
          icon: ListIcon,
          key: "bulletList",
          label: "Bullet List",
          onClick: editorState.bulletList,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.BulletList).keys },
        },
        {
          icon: ListOrderedIcon,
          key: "numberlist",
          label: "Number list",
          onClick: editorState.numberList,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.NumberList).keys },
        },
        {
          icon: ListTodoIcon,
          key: "tasklist",
          label: "Task list",
          onClick: editorState.checkList,
        },
        // 分隔线
        { type: "divider" },
        {
          active: editorState.isBlockquote,
          icon: MessageSquareQuote,
          key: "blockquote",
          label: "Blockquote",
          onClick: editorState.blockquote,
        },
        {
          icon: LinkIcon,
          key: "link",
          label: "Link",
          onClick: editorState.insertLink,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Link).keys },
        },
        {
          icon: SigmaIcon,
          key: "math",
          label: "TeX",
          onClick: editorState.insertMath,
        },
        // 分隔线
        { type: "divider" },
        {
          active: editorState.isCode,
          icon: CodeXmlIcon,
          key: "code",
          label: "Code",
          onClick: editorState.code,
          tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.CodeInline).keys },
        },
        {
          active: editorState.isCodeblock,
          icon: SquareDashedBottomCodeIcon,
          key: "codeblock",
          label: "Codeblock",
          onClick: editorState.codeblock,
        },
        // 代码块语言选择器（仅在当前处于代码块内时显示）
        editorState.isCodeblock && {
          children: (
            <CodeLanguageSelect
              onSelect={(value) => {
                console.log(value);
                editorState.updateCodeblockLang(value);
              }}
              value={editorState.codeblockLang}
            />
          ),
          disabled: !editorState.isCodeblock,
          key: "codeblockLang",
        },
        // 分隔线
        { type: "divider" },
        {
          icon: ImageIcon,
          key: "image",
          label: "Image",
          onClick: () => {
            openFileSelector((files) => {
              for (const file of files) {
                editor.dispatchCommand(INSERT_IMAGE_COMMAND, { file });
              }
            }, "image/*");
          },
        },
        {
          icon: FileUpIcon,
          key: "file",
          label: "File",
          onClick: () => {
            openFileSelector((files) => {
              for (const file of files) {
                editor.dispatchCommand(INSERT_FILE_COMMAND, { file });
              }
            });
          },
        },
        // 大纲切换按钮（可选）
        ...(outlineToggle && outlineAction ? [{ type: "divider" as const }, outlineAction] : []),
      ].filter(Boolean) as ChatInputActionsProps["items"],
    [editor, editorState, outlineAction, outlineToggle],
  );

  /**
   * 浮动工具栏项：仅保留格式操作和大纲切换，用于选中文本时的快捷操作。
   */
  const floatingItems = useMemo(
    () =>
      [...getFormatItems(editorState, editor), ...(outlineToggle && outlineAction ? [{ type: "divider" as const }, outlineAction] : [])] as ChatInputActionsProps["items"],
    [editor, editorState, outlineAction, outlineToggle],
  );

  /**
   * 浮动模式直接返回浮动操作条，否则渲染固定工具栏。
   */
  if (floating) return <FloatActions items={floatingItems} />;

  return (
    <div className={["mdocs-toolbar", className].filter(Boolean).join(" ")} style={style}>
      <ChatInputActions items={items} />
    </div>
  );
};

export default Toolbar;
