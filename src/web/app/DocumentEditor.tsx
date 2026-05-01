import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Block } from "@lobehub/ui";
import { saveDraft as saveDraftToIdb } from "../storage/drafts";

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
import OutlinePanel from "./OutlinePanel";
import { DomainSelect } from "./DomainSelect";
import { useAutoSave } from "./hooks/useAutoSave";
import { usePublishGuard } from "./hooks/usePublishGuard";

function getAutoSaveSettings(): { autoSave: boolean; autoPublish: boolean } {
  return {
    autoSave: localStorage.getItem("mdocs.autoSave") !== "false",
    autoPublish: localStorage.getItem("mdocs.autoPublish") === "true",
  };
}

interface DocumentEditorProps {
  document: DocumentDetail;
  canEdit: boolean;
  domains: DomainSummary[];
  currentDomainId: string;
  onDomainChange: (domainId: string) => void;
  onPublish: (content: string, displayName: string, documentId: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onDirtyChange?: (dirty: boolean, hasDraft: boolean) => void;
}

export function DocumentEditor(props: DocumentEditorProps) {
  const { t, lang } = useI18n();
  const [displayName, setDisplayName] = useState(props.document.displayName);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<IEditor | null>(null);
  // Ref for latest content — used in handleInit (stable callback) to set content programmatically
  const contentRef = useRef(props.document.content);
  contentRef.current = props.document.content;

  // Detect whether the incoming content is Lexical JSON or raw markdown.
  // Drafts now store JSON; API-fetched documents contain markdown.
  const contentType = useMemo<"json" | "markdown">(() => {
    if (!props.document.content) return "json";
    try {
      const p = JSON.parse(props.document.content);
      return p?.root?.children ? "json" : "markdown";
    } catch {
      return "markdown";
    }
  }, [props.document.content]);
  const [pubStatus, setPubStatus] = useState<"published" | "unpublished" | "publishing">("published");
  const [draftSaved, setDraftSaved] = useState(false);
  const { autoSave } = getAutoSaveSettings();

  const {
    isDirty: _isDirty,
    draftExists,
    clearDraft,
    loadDraftContent,
    markDraftSaved,
    draftCurrentRef,
  } = useAutoSave({
    editor,
    documentId: props.document.documentId,
    displayName,
    enabled: autoSave && props.canEdit,
    documentMeta: {
      relativePath: props.document.relativePath,
      permission: props.document.permission,
      ownerVisitorId: props.document.ownerVisitorId,
      domainId: props.document.domainId,
    },
  });

  usePublishGuard({ isDirty: _isDirty, draftExists });

  // Report dirty state to parent for SPA navigation guard.
  // hasDraft is only true when the IndexedDB draft matches CURRENT editor content,
  // not when a stale draft from a previous session exists.
  useLayoutEffect(() => {
    const hasCurrentDraft = draftExists && draftCurrentRef.current;
    console.log("[onDirtyChange] isDirty=", _isDirty, "hasCurrentDraft=", hasCurrentDraft, "draftExists=", draftExists, "draftCurrent=", draftCurrentRef.current);
    props.onDirtyChange?.(_isDirty, hasCurrentDraft);
  }, [_isDirty, draftExists]);

  // Load draft content if available, otherwise use server content
  // Note: App.tsx openDocument already provides draft content via props.document.content
  // when a draft with cached metadata exists, so the async load below is redundant
  // but kept as a fallback for the non-draft path.
  useEffect(() => {
    loadDraftContent().then((draft) => {
      if (draft) {
        // In the rare case where App.tsx didn't provide draft content
        // (e.g. draft without cached metadata), use it here
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.document.documentId]);

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
    // Bypass buggy content prop — re-set content programmatically via editor API
    // queueMicrotask ensures the editor has fully initialized first.
    const initContent = contentRef.current;
    if (initContent) {
      const ct = initContent.trim().startsWith('{"root"') ? "json" : "markdown";
      queueMicrotask(() => {
        e.setDocument(ct, initContent);
      });
    }
    queueMicrotask(() => {
      const afterInit = e.getDocument("json");
      console.log("[handleInit] editor content after setDocument:", JSON.stringify(afterInit?.root?.children?.slice(0, 2)));
    });
  }, []);

  async function publish(): Promise<void> {
    if (!editor || !props.canEdit) return;
    setBusy(true);
    setPubStatus("publishing");
    try {
      const content = JSON.stringify(editor.getDocument("json"));
      await props.onPublish(content, displayName, props.document.documentId);
      await clearDraft();
      setPubStatus("published");
    } catch (err) {
      setPubStatus("unpublished");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function saveDisplayNameIfChanged(): Promise<void> {
    if (!props.canEdit) return;
    const prev = props.document.displayName.trim();
    const next = displayName.trim();
    if (next === prev) return;
    await publish();
  }

  async function saveDraft(): Promise<void> {
    if (!editor || !props.canEdit) return;
    const jsonContent = JSON.stringify(editor.getDocument("json"));
    console.log("[saveDraft] json preview:", jsonContent.slice(0, 100));
    // Mark as saved synchronously BEFORE async IndexedDB write,
    // so the navigation guard sees clean state immediately.
    markDraftSaved();
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
    await saveDraftToIdb({
      documentId: props.document.documentId,
      content: jsonContent,
      displayName,
      updatedAt: Date.now(),
      published: false,
      relativePath: props.document.relativePath,
      permission: props.document.permission,
      ownerVisitorId: props.document.ownerVisitorId,
      domainId: props.document.domainId,
    });
  }

  // Listen for Ctrl+S / Cmd+S
  const publishRef = useRef(publish);
  publishRef.current = publish;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void publishRef.current();
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
          <span style={{ color: "var(--mdocs-text-muted)", fontFamily: "monospace", fontSize: 12 }}>
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
        <DomainSelect
          domains={props.domains.length ? props.domains : [{ domainId: "default", domainName: t("defaultDomain"), permission: "" }]}
          value={props.currentDomainId}
          onChange={props.onDomainChange}
          ariaLabel={t("currentDomainAria")}
          localizeName={(name: string) => localizeDomainName(name, lang, t)}
        />
        <span className="mdocs-editor-toolbar-spacer" aria-hidden />
        <div className="mdocs-editor-toolbar-actions">
          {props.canEdit && (
            <span className="mdocs-save-indicator">
              <span
                className={
                  "mdocs-save-dot " +
                  (pubStatus === "publishing" ? "saving" : pubStatus === "unpublished" ? "unsaved" : "saved")
                }
              />
              <span>
                {pubStatus === "publishing"
                  ? t("publishing")
                  : draftSaved
                    ? t("saved")
                    : draftExists
                      ? t("unsaved")
                      : t("published")}
              </span>
            </span>
          )}
          <button type="button" disabled={!props.canEdit || busy} onClick={() => void saveDraft()}>
            {t("saveDraft")}
          </button>
          <button type="button" className="primary" disabled={!props.canEdit || busy} onClick={() => void publish()}>
            {busy ? t("publishing") : t("publish")}
          </button>
          <button type="button" className="danger" disabled={!props.canEdit || busy} onClick={props.onDelete}>
            {t("delete")}
          </button>
        </div>
      </div>
      <Block flex={1} style={{ minHeight: 0 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
          }}
        >
          {editor && <Toolbar editor={editor} />}
          <div className="mdocs-editor-content-area" style={{ flex: 1, display: "flex", minHeight: 0 }}>
            <Block
              variant="outlined"
              horizontal
              style={{ background: "var(--mdocs-surface)", flex: 1, minHeight: 0, overflow: "auto", outline: "none" }}
            >
              <div style={{ flex: 1 }}>
                <Editor
                  content={props.document.content}
                  type={contentType}
                  key={props.document.documentId}
                  editable={props.canEdit}
                  onInit={handleInit}
                  plugins={plugins}
                  lineEmptyPlaceholder={t("displayNamePlaceholder")}
                  placeholder={t("displayNamePlaceholder")}
                  slashOption={{ items: slashItems }}
                  style={{ padding: "24px 20px" }}
                />
              </div>
              {editor && <OutlinePanel editor={editor} />}
            </Block>
          </div>
        </div>
      </Block>
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
