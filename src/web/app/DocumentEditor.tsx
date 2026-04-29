import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Block } from "@lobehub/ui";

import {
  INSERT_CODEINLINE_COMMAND,
  INSERT_CODEMIRROR_COMMAND,
  INSERT_FILE_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_LINK_COMMAND,
  INSERT_MATH_COMMAND,
  INSERT_TABLE_COMMAND,
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
  enUS,
  zhCN,
} from "@lobehub/editor";
import type { IEditor } from "@lobehub/editor";
import { Editor, withProps } from "@lobehub/editor/react";
import { Heading1Icon, Heading2Icon, Heading3Icon, MinusIcon, SigmaIcon, Table2Icon } from "lucide-react";

import type { DocumentDetail } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import { useI18n } from "../i18n";
import { openFileSelector } from "./actions";
import Toolbar from "./Toolbar";

interface DocumentEditorProps {
  document: DocumentDetail;
  canEdit: boolean;
  domains: DomainSummary[];
  currentDomainId: string;
  onDomainChange: (domainId: string) => void;
  onSave: (content: string, displayName: string, documentId: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function DocumentEditor(props: DocumentEditorProps) {
  const { t, lang } = useI18n();
  const [displayName, setDisplayName] = useState(props.document.displayName);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<IEditor | null>(null);

  // Sync editor locale with mdocs i18n language
  useEffect(() => {
    editor?.setLocale(lang === "zh" ? zhCN : enUS);
  }, [editor, lang]);

  // Sync displayName when switching documents
  useEffect(() => {
    setDisplayName(props.document.displayName);
  }, [props.document.displayName, props.document.documentId]);

  const handleInit = useCallback((e: IEditor) => {
    setEditor(e);
  }, []);

  async function save(): Promise<void> {
    if (!editor || !props.canEdit) return;
    setBusy(true);
    try {
      const content = editor.getDocument("markdown") as string;
      await props.onSave(content, displayName, props.document.documentId);
    } finally {
      setBusy(false);
    }
  }

  async function saveDisplayNameIfChanged(): Promise<void> {
    if (!props.canEdit) return;
    const prev = props.document.displayName.trim();
    const next = displayName.trim();
    if (next === prev) return;
    await save();
  }

  // Listen for Ctrl+S / Cmd+S
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const slashItems = useMemo(
    () => [
      {
        icon: Heading1Icon,
        key: "h1",
        label: "Heading 1",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: "h1" });
        },
      },
      {
        icon: Heading2Icon,
        key: "h2",
        label: "Heading 2",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: "h2" });
        },
      },
      {
        icon: Heading3Icon,
        key: "h3",
        label: "Heading 3",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: "h3" });
        },
      },
      { type: "divider" },
      {
        icon: MinusIcon,
        key: "hr",
        label: "Hr",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {});
        },
      },
      {
        icon: Table2Icon,
        key: "table",
        label: "Table",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: "3", rows: "3" });
        },
      },
      {
        icon: SigmaIcon,
        key: "tex",
        label: "TeX",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_MATH_COMMAND, { code: "x^2 + y^2 = z^2" });
          queueMicrotask(() => editor.focus());
        },
      },
      { type: "divider" },
      {
        key: "file",
        label: "File",
        onSelect: (editor: IEditor) => {
          openFileSelector((files) => {
            for (const file of files) {
              editor.dispatchCommand(INSERT_FILE_COMMAND, { file });
            }
          });
        },
      },
      {
        key: "insert-link",
        label: "Insert Link",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_LINK_COMMAND, { url: "https://example.com" });
          queueMicrotask(() => editor.focus());
        },
      },
      {
        key: "insert-codeInline",
        label: "Inline Code",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined);
          queueMicrotask(() => editor.focus());
        },
      },
      {
        key: "insert-codeBlock",
        label: "Code Block",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined);
          queueMicrotask(() => editor.focus());
        },
      },
    ].map((item) => {
      if ("type" in item && item.type === "divider") return item;
      return {
        ...item,
        extra: (
          <span style={{ color: "#8c8c8c", fontFamily: "monospace", fontSize: 12 }}>
            {item.key}
          </span>
        ),
      };
    }),
    [],
  );

  const plugins = useMemo(
    () => [
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
        children: editor ? <Toolbar editor={editor} floating /> : null,
      }),
      withProps(ReactFilePlugin, {
        handleUpload: async (file: File) => {
          return { url: URL.createObjectURL(file) };
        },
      }),
      withProps(ReactImagePlugin, {
        defaultBlockImage: true,
        needRehost: (url: string) => url.startsWith("blob:"),
        handleRehost: async (url: string) => {
          const res = await fetch(url);
          const blob = await res.blob();
          return new Promise<{ url: string }>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ url: reader.result as string });
            reader.readAsDataURL(blob);
          });
        },
      }),
    ],
    [editor],
  );

  return (
    <div className="mdocs-editor">
      <div className="mdocs-editor-toolbar">
        <input
          className="mdocs-editor-title-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={() => void saveDisplayNameIfChanged()}
          placeholder={t("displayNamePlaceholder")}
          disabled={!props.canEdit}
        />
        <select
          className="mdocs-editor-domain-select"
          aria-label={t("currentDomainAria")}
          value={props.currentDomainId}
          onChange={(e) => props.onDomainChange(e.target.value)}
        >
          {(props.domains.length ? props.domains : [{ domainId: "default", domainName: t("defaultDomain") }]).map(
            (d) => (
              <option key={d.domainId} value={d.domainId}>
                {localizeDomainName(d.domainName, lang, t)}
              </option>
            ),
          )}
        </select>
        <span className="mdocs-editor-toolbar-spacer" aria-hidden />
        <div className="mdocs-editor-toolbar-actions">
          <button type="button" className="primary" disabled={!props.canEdit || busy} onClick={() => void save()}>
            {busy ? t("saving") : t("save")}
          </button>
          <button type="button" className="danger" disabled={!props.canEdit || busy} onClick={props.onDelete}>
            {t("delete")}
          </button>
        </div>
      </div>
      <div className="mdocs-editor-inner">
        {editor && <Toolbar editor={editor} />}
        <Block variant="outlined" style={{ borderRadius: 8 }}>
          <Editor
            content={props.document.content}
            type="markdown"
            key={props.document.documentId}
            editable={props.canEdit}
            onInit={handleInit}
            plugins={plugins}
            lineEmptyPlaceholder={t("displayNamePlaceholder")}
            placeholder={t("displayNamePlaceholder")}
            slashOption={{ items: slashItems }}
          />
        </Block>
      </div>
    </div>
  );
}

function localizeDomainName(
  name: string,
  langCode: "en" | "zh",
  t: (k: string, vars?: Record<string, string>) => string,
): string {
  if (name === "Default") return t("defaultDomain");
  const suffix = "个人域";
  if (name.endsWith(suffix)) {
    const base = name.slice(0, -suffix.length);
    return base + t("personalDomainSuffix");
  }
  return name;
}
