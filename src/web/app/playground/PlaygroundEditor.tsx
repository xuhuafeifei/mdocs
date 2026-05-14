/**
 * Playground 编辑器组件
 * lobe-editor 的完整功能演示，包含所有插件（列表、链接、图片、代码块、表格、数学公式、图表、自动补全等）。
 * 用于本地开发时测试编辑器行为，不直接参与 mdocs 主业务。
 */
import {
  IEditor,
  INSERT_CODEINLINE_COMMAND,
  INSERT_CODEMIRROR_COMMAND,
  INSERT_FILE_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_LINK_COMMAND,
  INSERT_MATH_COMMAND,
  INSERT_MENTION_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactAutoCompletePlugin,
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactFilePlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMathPlugin,
  ReactMeta2dPlugin,
  ReactMarkmapPlugin,
  ReactTablePlugin,
  ReactToolbarPlugin,
  type SlashOptions,
  scrollIntoView,
} from "@lobehub/editor";
import { Editor, useEditor, withProps } from "@lobehub/editor/react";
import { Avatar, type CollapseProps, Text } from "@lobehub/ui";
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  MinusIcon,
  SigmaIcon,
  Table2Icon,
} from "lucide-react";
import { type FC, useEffect, useMemo, useRef, useState } from "react";

import Toolbar from "../Toolbar";
import { openFileSelector } from "../actions";
import PlaygroundContainer from "./PlaygroundContainer";
import content from "./data.json";

/**
 * 通用防抖函数：延迟执行，减少编辑器内容变化时的频繁序列化。
 */
function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): ((...args: A) => void) & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
      timeout = undefined;
    }
  };
  return debounced;
}

// 将 scrollIntoView 挂载到 window，供调试使用
window.__scrollIntoView = scrollIntoView;

const PlaygroundEditor: FC<Pick<CollapseProps, "collapsible" | "defaultActiveKey">> = (props) => {
  // 获取 lobe-editor 编辑器实例
  const editor = useEditor();

  // 追踪 Playground 中创建的 ObjectURL，组件卸载时统一释放，防止内存泄漏
  const objectUrlsRef = useRef<string[]>([]);

  // ---- 编辑器 JSON 输出 ----
  const [json, setJson] = useState("");

  // ---- 编辑器 Markdown 输出 ----
  const [markdown, setMarkdown] = useState("");

  /**
   * 编辑器内容变化回调：防抖 200ms 后序列化为 Markdown 和 JSON。
   */
  const handleChange = useMemo(
    () =>
      debounce((e: IEditor) => {
        const markdownContent = e.getDocument("markdown") as unknown as string;
        const jsonContent = e.getDocument("json") as unknown as Record<string, unknown>;
        setMarkdown(markdownContent || "");
        setJson(JSON.stringify(jsonContent || {}, null, 2));
      }, 200),
    [],
  );

  /**
   * JSON 面板手动编辑回调：防抖 200ms 后回写到编辑器。
   */
  const handleJSONChange = useMemo(
    () =>
      debounce((value: unknown) => {
        if (editor) {
          console.info("handleJSONChange", value);
          editor.setDocument("json", value);
        }
      }, 200),
    [editor],
  );

  /**
   * 编辑器初始化：挂载到 window 供调试，并触发首次序列化。
   */
  const handleInit = (e: IEditor) => {
    window.editor = e;
    handleChange(e);
  };

  // 组件卸载时清理：释放 ObjectURL、清除 debounce 定时器、移除全局 window 引用
  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current = [];
      handleChange.cancel();
      handleJSONChange.cancel();
      delete (window as any).editor;
      delete (window as any).__scrollIntoView;
    };
  }, [handleChange, handleJSONChange]);

  /**
   * @ 提及（mention）候选列表：演示用机器人角色。
   */
  const mentionItems: SlashOptions["items"] = useMemo(
    () => [
      {
        icon: <Avatar avatar="💻" size={24} />,
        key: "bot1",
        label: "前端研发专家",
        metadata: { id: "bot1" },
      },
      {
        icon: <Avatar avatar="🌍" size={24} />,
        key: "bot2",
        label: "中英文互译助手",
        metadata: { id: "bot2" },
      },
      {
        icon: <Avatar avatar="📖" size={24} />,
        key: "bot3",
        label: "学术写作增强专家",
        metadata: { id: "bot3" },
      },
    ],
    [],
  );

  /**
   * Slash 命令菜单项配置：标题、分割线、表格、公式、文件、链接、代码等。
   */
  const slashItems: SlashOptions["items"] = useMemo(() => {
    const data: SlashOptions["items"] = [
      {
        icon: Heading1Icon,
        key: "h1",
        label: "Heading 1",
        onSelect: (ed) => {
          ed.dispatchCommand(INSERT_HEADING_COMMAND, { tag: "h1" });
        },
      },
      {
        icon: Heading2Icon,
        key: "h2",
        label: "Heading 2",
        onSelect: (ed) => {
          ed.dispatchCommand(INSERT_HEADING_COMMAND, { tag: "h2" });
        },
      },
      {
        icon: Heading3Icon,
        key: "h3",
        label: "Heading 3",
        onSelect: (ed) => {
          ed.dispatchCommand(INSERT_HEADING_COMMAND, { tag: "h3" });
        },
      },
      // 分隔线
      { type: "divider" },
      {
        icon: MinusIcon,
        key: "hr",
        label: "Hr",
        onSelect: (ed) => {
          ed.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {});
        },
      },
      {
        icon: Table2Icon,
        key: "table",
        label: "Table",
        onSelect: (ed) => {
          ed.dispatchCommand(INSERT_TABLE_COMMAND, { columns: "3", rows: "3" });
        },
      },
      {
        icon: SigmaIcon,
        key: "tex",
        label: "Tex",
        onSelect: (ed) => {
          ed.dispatchCommand(INSERT_MATH_COMMAND, { code: "x^2 + y^2 = z^2" });
          queueMicrotask(() => {
            ed.focus();
          });
        },
      },
      // 分隔线
      { type: "divider" },
      {
        key: "file",
        label: "File",
        onSelect: (ed) => {
          openFileSelector((files) => {
            for (const file of files) {
              ed.dispatchCommand(INSERT_FILE_COMMAND, { file });
            }
          });
        },
      },
      {
        key: "set-text-content",
        label: "SetTextContent",
        onSelect: (ed) => {
          ed.setDocument("text", "123\n123");
          queueMicrotask(() => {
            ed.focus();
          });
        },
      },
      {
        key: "insert-link",
        label: "InsertLink",
        onSelect: (ed) => {
          ed.dispatchCommand(INSERT_LINK_COMMAND, { url: "https://example.com" });
          queueMicrotask(() => {
            ed.focus();
          });
        },
      },
      {
        key: "insert-codeInline",
        label: "InsertCodeInline",
        onSelect: (ed) => {
          ed.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined);
          queueMicrotask(() => {
            ed.focus();
          });
        },
      },
      {
        key: "insert-codeBlock",
        label: "InsertCodeBlock",
        onSelect: (ed) => {
          ed.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined);
          queueMicrotask(() => {
            ed.focus();
          });
        },
      },
    ];
    return data.map((item) => {
      // 分隔线项不做处理
      if (item.type === "divider") return item;
      // 普通项添加右侧快捷键提示
      return {
        ...item,
        extra: (
          <Text code fontSize={12} type="secondary">
            {item.key}
          </Text>
        ),
      };
    });
  }, []);

  return (
    <PlaygroundContainer json={json} markdown={markdown} onJSONChange={handleJSONChange} {...props}>
      <Toolbar editor={editor} />
      <Editor
        className="mdocs-playground-editor"
        content={content}
        editor={editor}
        lineEmptyPlaceholder="Start typing here..."
        mentionOption={{
          items: mentionItems,
          markdownWriter: (mention) => {
            return `\n<mention>${mention.label}[${mention.metadata?.id || mention.label}]</mention>\n`;
          },
          onSelect: (ed, option) => {
            ed.dispatchCommand(INSERT_MENTION_COMMAND, {
              label: String(option.label),
              metadata: { id: option.key },
            });
          },
          searchKeys: ["label"],
        }}
        onInit={handleInit}
        onTextChange={handleChange}
        pasteVSCodeAsCodeBlock
        placeholder="Type something..."
        plugins={[
          ReactListPlugin,
          ReactLinkPlugin,
          ReactImagePlugin,
          ReactCodemirrorPlugin,
          ReactHRPlugin,
          ReactTablePlugin,
          ReactMathPlugin,
          ReactMeta2dPlugin,
          ReactMarkmapPlugin,
          ReactCodePlugin,
          // 浮动工具栏
          withProps(ReactToolbarPlugin, {
            children: <Toolbar editor={editor} floating />,
          }),
          // 自动补全插件
          withProps(ReactAutoCompletePlugin, {
            delay: 1000,
            onAutoComplete: async ({ input, afterText, selectionType, abortSignal }) => {
              console.log("Auto-complete triggered:", { afterText, input, selectionType });
              try {
                const res = await fetch(`${location.origin}/nodeserver/completion`, {
                  body: JSON.stringify({
                    prompt: `Please complete the following text:\n\n${input}`,
                  }),
                  headers: { "Content-Type": "application/json" },
                  method: "POST",
                  signal: abortSignal,
                });
                if (abortSignal.aborted) {
                  console.log("Auto-complete aborted");
                  return null;
                }
                const ai = await res.json();
                if (ai) {
                  if (typeof ai.content === "string" && ai.content.startsWith(input)) {
                    return ai.content.replace(input, "");
                  }
                  return ai.content as string | null;
                }
              } catch {
                /* optional /nodeserver/completion — ignore when missing */
              }
              return null;
            },
          }),
          // 图片插件：支持 blob URL 转存为 base64
          withProps(ReactImagePlugin, {
            defaultBlockImage: true,
            handleRehost: async (url) => {
              const r = await fetch(url);
              const blob = await r.blob();
              return await new Promise<{ url: string }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({ url: reader.result as string });
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            },
            needRehost: (url) => {
              console.debug("needRehost", url);
              return url.startsWith("blob:");
            },
          }),
          // 文件插件：模拟上传（本地预览）
          withProps(ReactFilePlugin, {
            handleUpload: async (file) => {
              console.debug("Files uploaded:", file);
              return new Promise((resolve) => {
                setTimeout(() => {
                  const url = URL.createObjectURL(file);
                  objectUrlsRef.current.push(url);
                  resolve({ url });
                }, 1000);
              });
            },
            markdownWriter: (file) => {
              return `\n<file>${file.fileUrl}</file>\n`;
            },
          }),
        ]}
        slashOption={{ items: slashItems }}
      />
    </PlaygroundContainer>
  );
};

export default PlaygroundEditor;
