/**
 * HtmlEditor — HTML 文档编辑器。
 *
 * 预览 iframe（sandbox=""）+ textarea 编辑，左右分栏。
 * autoSave/publish 由父组件通过 onContentChange / onPublish 接管。
 */
import { useState, useCallback, useEffect, useRef } from "react";
import "./HtmlEditor.css";

interface HtmlEditorProps {
  initialContent: string;
  displayName: string;
  canEdit: boolean;
  /** autoSave 用的内容变更回调（非 Lexical，直接存 HTML 原文） */
  onContentChange?: (content: string) => void;
  onPublish?: () => void;
  /** 窄屏阅读壳 */
  readerChrome?: boolean;
  /** 打开左侧目录抽屉 */
  onOpenMobileNav?: () => void;
}

export function HtmlEditor(props: HtmlEditorProps) {
  const { initialContent, displayName, canEdit, onContentChange, onPublish, readerChrome } = props;
  const [content, setContent] = useState(initialContent);
  const [previewMode, setPreviewMode] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 初始内容变化时重置
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // 编辑时通知父组件 autoSave
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setContent(val);
      onContentChange?.(val);
    },
    [onContentChange],
  );

  // 渲染 iframe srcdoc
  const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${content}</body></html>`;

  return (
    <div className="mdocs-editor-with-comments">
      <div className="mdocs-editor-container">
        {readerChrome ? (
          <div className="mdocs-reader-chrome">
            <button type="button" className="mdocs-reader-back" onClick={() => props.onOpenMobileNav?.()}>
              ← 返回
            </button>
            <h1 className="mdocs-reader-title">{displayName}</h1>
          </div>
        ) : (
          <div className="mdocs-editor-toolbar">
            <h1 className="mdocs-editor-doc-title">{displayName}</h1>
            {canEdit && (
              <div className="mdocs-editor-toolbar-actions">
                <button
                  type="button"
                  className={previewMode ? "secondary" : "primary"}
                  onClick={() => setPreviewMode(false)}
                >
                  {previewMode ? "预览" : "编辑"}
                </button>
                <button
                  type="button"
                  className={previewMode ? "primary" : "secondary"}
                  onClick={() => setPreviewMode(true)}
                >
                  {t("preview")}
                </button>
                {onPublish && (
                  <button type="button" className="primary" onClick={onPublish}>
                    {t("publish")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <div className="mdocs-html-editor-body">
          {!previewMode && canEdit ? (
            <textarea
              className="mdocs-html-editor-textarea"
              value={content}
              onChange={handleChange}
              spellCheck={false}
            />
          ) : null}
          <div className="mdocs-html-editor-preview" style={!previewMode && canEdit ? { width: "50%" } : { width: "100%" }}>
            <iframe
              ref={iframeRef}
              className="mdocs-html-editor-iframe"
              srcDoc={previewHtml}
              sandbox=""
              title={displayName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}