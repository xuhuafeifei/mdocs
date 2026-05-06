/**
 * Playground 容器组件
 * 将编辑器、Markdown 预览、JSON 输出以可折叠面板（Collapse）形式组织。
 * 支持实时编辑 JSON 并回写到编辑器。
 */
import { CodeEditor, Collapse, CollapseProps, Highlighter, ToastHost } from "@lobehub/ui";
import { type FC, type PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";

interface PlaygroundContainerProps extends Omit<CollapseProps, "items"> {
  json: string;
  markdown: string;
  onJSONChange?: (json: unknown) => void;
}

const PlaygroundContainer: FC<PropsWithChildren<PlaygroundContainerProps>> = ({
  children,
  json,
  markdown,
  collapsible = false,
  defaultActiveKey = ["editor", "text", "json"],
  onJSONChange,
}) => {
  // ---- JSON 面板内部编辑值 ----
  const [value, setValue] = useState(json);
  // ---- 用于追踪外部传入的 json 是否变化 ----
  const jsonValueRef = useRef(json);

  /**
   * 同步外部传入的 JSON 值（当编辑器内容变化导致 JSON 输出变化时）。
   */
  useEffect(() => {
    // 如果外部传入的 json 与当前内部值相同，跳过更新
    if (json === jsonValueRef.current) return;
    setValue(json);
    jsonValueRef.current = json;
  }, [json]);

  /**
   * 用户手动编辑 JSON 面板时同步到内部状态。
   */
  const handleJSONChange = useCallback((next: string) => {
    jsonValueRef.current = next;
    setValue(next);
  }, []);

  return (
    <>
      <ToastHost />
      <Collapse
        collapsible={collapsible}
        defaultActiveKey={defaultActiveKey}
        items={[
          {
            children,
            key: "editor",
            label: "Playground",
          },
          {
            children: (
              <Highlighter language="markdown" style={{ fontSize: 12, padding: 16 }} variant="borderless">
                {markdown}
              </Highlighter>
            ),
            key: "text",
            label: "Text Output",
          },
          {
            children: (
              <CodeEditor
                language="json"
                onBlur={() => {
                  // 失焦时如果 JSON 有变化，尝试解析并回写到编辑器
                  if (json !== jsonValueRef.current) {
                    try {
                      const parsed = JSON.parse(jsonValueRef.current || "");
                      onJSONChange?.(parsed);
                    } catch (error) {
                      console.error("Invalid JSON:", error);
                    }
                  }
                }}
                onValueChange={handleJSONChange}
                value={value}
                variant="borderless"
              />
            ),
            key: "json",
            label: "JSON Output",
          },
        ]}
        padding={{ body: 0 }}
        style={{
          border: "none",
          borderRadius: 0,
          width: "100%",
        }}
        variant="outlined"
      />
    </>
  );
};

export default PlaygroundContainer;
