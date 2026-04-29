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
import { type FC, useMemo, useState } from "react";

import Toolbar from "../Toolbar";
import { openFileSelector } from "../actions";
import PlaygroundContainer from "./PlaygroundContainer";
import content from "./data.json";

function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): (...args: A) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

window.__scrollIntoView = scrollIntoView;

const PlaygroundEditor: FC<Pick<CollapseProps, "collapsible" | "defaultActiveKey">> = (props) => {
  const editor = useEditor();
  const [json, setJson] = useState("");
  const [markdown, setMarkdown] = useState("");

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

  const handleInit = (e: IEditor) => {
    window.editor = e;
    handleChange(e);
  };

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
      if (item.type === "divider") return item;
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
          ReactCodePlugin,
          withProps(ReactToolbarPlugin, {
            children: <Toolbar editor={editor} floating />,
          }),
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
          withProps(ReactFilePlugin, {
            handleUpload: async (file) => {
              console.debug("Files uploaded:", file);
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve({ url: URL.createObjectURL(file) });
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
