import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import {
  ERROR_CODE_MAP,
  PATH_ERROR_MESSAGE_MAP,
  STORAGE_ERROR_MESSAGE_MAP,
} from "../i18n/errors";
import type { VisitorPublic } from "../../shared/types/visitor";
import type { DocumentDetail } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import type { TreeNode } from "../../shared/types/tree";
import { DocPathError, normaliseDocRelativePath } from "../../shared/docPath";
import {
  normalisePathSegmentForStorage,
  normaliseRelativePathForStorage,
  parseDisplayNameFolder,
  parseDisplayNameMarkdownFile,
} from "../../shared/storagePath";
import { FOLDER_DESC_FILENAME, folderDescPathForFolder } from "../../shared/folderDesc";
import { stripDomainPathPrefix } from "../../shared/personalDomain";
import {
  ApiRequestError,
  clearIdentity,
  getStoredToken,
  getStoredVisitorId,
  storeIdentity,
} from "../api/client";
import {
  createDocumentApi,
  deleteDocumentApi,
  fetchDomainsApi,
  fetchMe,
  fetchTreeApi,
  getDocumentApi,
  registerVisitorApi,
  updateDocumentApi,
} from "../api/endpoints";
import { VisitorRegisterDialog } from "./VisitorRegisterDialog";
import { VisitorIdNotice } from "./VisitorIdNotice";
import { DocumentTree, type TreeContextMenu as TreeContextMenuPayload } from "./DocumentTree";
import { TreeContextMenu } from "./TreeContextMenu";
import { DocumentEditor } from "./DocumentEditor";
import { SettingsPage } from "./SettingsPage";
import { MessageDialog } from "./MessageDialog";
import "./App.css";

type Phase = "loading" | "needsRegister" | "ready";

type CreateModalState =
  | { kind: "document"; parentMode: "selection" | "fixed"; parentPath: string; draft: string }
  | { kind: "folder"; parentMode: "selection" | "fixed"; parentPath: string; draft: string };

function collectDocumentPaths(nodes: TreeNode[], out = new Set<string>()): Set<string> {
  for (const n of nodes) {
    if (n.type === "document") out.add(n.path);
    else {
      if (n.descDocumentId) out.add(folderDescPathForFolder(n.path));
      collectDocumentPaths(n.children, out);
    }
  }
  return out;
}

function joinDocPath(parentPath: string, fileName: string): string {
  const p = parentPath.trim();
  const f = fileName.trim();
  if (!f) return p;
  return p ? `${p}/${f}` : f;
}

function parentDirForCreates(relativePath: string): string {
  const i = relativePath.lastIndexOf("/");
  return i === -1 ? "" : relativePath.slice(0, i);
}

/** Tree / create-modal paths are domain-relative; strip personal-domain storage prefix. */
function docPathForSelection(doc: DocumentDetail): string {
  const vid = getStoredVisitorId();
  if (!vid || doc.domainId !== vid) return doc.relativePath;
  return stripDomainPathPrefix(vid, doc.relativePath);
}

async function fetchDomainsSafe(): Promise<DomainSummary[]> {
  try {
    return await fetchDomainsApi();
  } catch {
    return [{ domainId: "default", domainName: "Default", permission: "public" }];
  }
}

export function App() {
  const { t, lang, setLang } = useI18n();
  const [phase, setPhase] = useState<Phase>("loading");
  const [visitor, setVisitor] = useState<VisitorPublic | null>(null);
  const [pendingVisitorId, setPendingVisitorId] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [currentDomainId, setCurrentDomainId] = useState("default");
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [activeDoc, setActiveDoc] = useState<DocumentDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [menu, setMenu] = useState<TreeContextMenuPayload | null>(null);
  const [createModal, setCreateModal] = useState<CreateModalState | null>(null);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [createModalBusy, setCreateModalBusy] = useState(false);
  const createModalInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCreateParentPath, setSelectedCreateParentPath] = useState("");
  const [view, setView] = useState<"docs" | "settings">("docs");

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!message) return;
    const dismiss = (): void => {
      setMessage(null);
    };
    window.addEventListener("pointerdown", dismiss, true);
    return () => window.removeEventListener("pointerdown", dismiss, true);
  }, [message]);

  async function bootstrap(): Promise<void> {
    if (!getStoredToken()) {
      setPhase("needsRegister");
      return;
    }
    try {
      const me = await fetchMe();
      setVisitor(me);
      const doms = await fetchDomainsSafe();
      setDomains(doms);
      const initialDomain =
        doms.find((d) => d.domainId === me.visitorId)?.domainId ??
        doms.find((d) => d.domainId === "default")?.domainId ??
        doms[0]?.domainId ??
        "default";
      setCurrentDomainId(initialDomain);
      await refreshTree(initialDomain);
      setPhase("ready");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        clearIdentity();
        setPhase("needsRegister");
        return;
      }
      setAlertMessage(translateError(t, err));
      setPhase("needsRegister");
    }
  }

  async function handleRegister(visitorName: string): Promise<void> {
    const res = await registerVisitorApi(visitorName);
    storeIdentity(res.visitor.visitorId, res.visitorToken);
    setVisitor(res.visitor);
    setPendingVisitorId(res.visitor.visitorId);
    const doms = await fetchDomainsSafe();
    setDomains(doms);
    const initialDomain =
      doms.find((d) => d.domainId === res.visitor.visitorId)?.domainId ??
      doms.find((d) => d.domainId === "default")?.domainId ??
      doms[0]?.domainId ??
      "default";
    setCurrentDomainId(initialDomain);
    await refreshTree(initialDomain);
    setPhase("ready");
  }

  async function refreshTree(domainId?: string): Promise<void> {
    const did = domainId ?? currentDomainId;
    const nodes = await fetchTreeApi(did);
    setTree(nodes);
  }

  async function openDocument(docId: string): Promise<void> {
    try {
      const doc = await getDocumentApi(docId);
      setActiveDoc(doc);
      setSelectedCreateParentPath(parentDirForCreates(docPathForSelection(doc)));
    } catch (err) {
      setAlertMessage(translateError(t, err));
    }
  }

  useEffect(() => {
    if (phase !== "ready") return;
    if (documentId) {
      void openDocument(documentId);
    } else {
      setActiveDoc(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, documentId]);

  function openNewDocumentModal(explicitParentPath?: string): void {
    const fixed = explicitParentPath !== undefined;
    setCreateModalError(null);
    setCreateModal({
      kind: "document",
      parentMode: fixed ? "fixed" : "selection",
      parentPath: fixed ? explicitParentPath! : "",
      draft: "untitled.md",
    });
  }

  function openNewFolderModal(explicitParentPath?: string): void {
    const fixed = explicitParentPath !== undefined;
    setCreateModalError(null);
    setCreateModal({
      kind: "folder",
      parentMode: fixed ? "fixed" : "selection",
      parentPath: fixed ? explicitParentPath! : "",
      draft: "",
    });
  }

  useEffect(() => {
    if (!createModal) return;
    const id = window.setTimeout(() => createModalInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [createModal]);

  async function submitCreateModal(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!createModal) return;
    setCreateModalBusy(true);
    setCreateModalError(null);
    const paths = collectDocumentPaths(tree);
    const effectiveParent =
      createModal.parentMode === "selection"
        ? selectedCreateParentPath
        : createModal.parentPath;
    try {
      if (createModal.kind === "document") {
        const fileParsed = parseDisplayNameMarkdownFile(createModal.draft);
        if (!fileParsed.ok) {
          setCreateModalError(translateStorageError(t, fileParsed.message));
          return;
        }
        const displayFile = fileParsed.displayFile;
        const displayTitle = displayFile.replace(/\.md$/i, "");
        let relativePath: string;
        try {
          relativePath = normaliseRelativePathForStorage(joinDocPath(effectiveParent, displayFile));
        } catch (e) {
          setCreateModalError(translateError(t, e));
          return;
        }
        if (paths.has(relativePath)) {
          setCreateModalError(t("pathExists"));
          return;
        }
        const doc = await createDocumentApi({
          relativePath,
          displayName: displayTitle,
          content: `# ${displayTitle}\n\n`,
          domainId: currentDomainId,
        });
        await refreshTree();
        setActiveDoc(doc);
        setSelectedCreateParentPath(parentDirForCreates(docPathForSelection(doc)));
        navigate(`/doc/${doc.documentId}`);
        setCreateModal(null);
        return;
      }
      const parsed = parseDisplayNameFolder(createModal.draft);
      if (!parsed.ok) {
        setCreateModalError(translateStorageError(t, parsed.message));
        return;
      }
      const storageSeg = normalisePathSegmentForStorage(parsed.display);
      if (!storageSeg) {
        setCreateModalError(t("invalidFolderName"));
        return;
      }
      const folderPrefix = joinDocPath(effectiveParent, storageSeg);
      let relativePath: string;
      try {
        relativePath = normaliseRelativePathForStorage(joinDocPath(folderPrefix, FOLDER_DESC_FILENAME));
      } catch (e) {
        setCreateModalError(translateError(t, e));
        return;
      }
      if (paths.has(relativePath)) {
        setCreateModalError(t("folderExists"));
        return;
      }
      const folderTitle = parsed.display;
      const doc = await createDocumentApi({
        relativePath,
        displayName: folderTitle,
        content: `# ${folderTitle}\n\n`,
        domainId: currentDomainId,
      });
      await refreshTree();
      setActiveDoc(doc);
      setSelectedCreateParentPath(parentDirForCreates(docPathForSelection(doc)));
      navigate(`/doc/${doc.documentId}`);
      setCreateModal(null);
    } catch (err) {
      setCreateModalError(translateError(t, err));
    } finally {
      setCreateModalBusy(false);
    }
  }

  async function saveDocument(content: string, displayName: string, documentId: string): Promise<void> {
    try {
      const updated = await updateDocumentApi(documentId, { content, displayName });
      setActiveDoc((prev) => (prev && prev.documentId === documentId ? updated : prev));
      await refreshTree();
      setMessage(t("saved"));
      window.setTimeout(() => setMessage(null), 1200);
    } catch (err) {
      setAlertMessage(translateError(t, err));
    }
  }

  async function deleteDocumentById(documentId: string, label: string): Promise<void> {
    if (!window.confirm(t("deleteConfirm", { name: label }))) return;
    try {
      await deleteDocumentApi(documentId);
      if (activeDoc?.documentId === documentId) {
        setActiveDoc(null);
        setSelectedCreateParentPath("");
        navigate("/");
      }
      await refreshTree();
    } catch (err) {
      setAlertMessage(translateError(t, err));
    }
  }

  if (phase === "loading") {
    return <div className="mdocs-loading muted">{t("loading")}</div>;
  }

  if (phase === "needsRegister") {
    return (
      <VisitorRegisterDialog
        onSubmit={handleRegister}
        error={message}
      />
    );
  }

  return (
    <div className="mdocs-shell">
      {pendingVisitorId && visitor && (
        <VisitorIdNotice
          visitorId={pendingVisitorId}
          onDismiss={() => setPendingVisitorId(null)}
        />
      )}
      {view === "settings" ? (
        <SettingsPage
          onBack={() => setView("docs")}
        />
      ) : (
        <>
      <aside className="mdocs-sidebar">
        <header className="mdocs-sidebar-header">
          <div className="mdocs-brand">{t("brand")}</div>
        </header>
        <div className="mdocs-sidebar-actions">
          <button type="button" onClick={() => openNewDocumentModal()} className="primary">
            {t("newDocument")}
          </button>
          <button type="button" onClick={() => openNewFolderModal()}>
            {t("newFolder")}
          </button>
        </div>
        <DocumentTree
          nodes={tree}
          activeDocumentId={documentId ?? null}
          selectedParentPath={selectedCreateParentPath}
          onOpen={(node) => navigate(`/doc/${node.documentId}`)}
          onOpenFolder={(folderPath, descDocumentId) => {
            setSelectedCreateParentPath(folderPath);
            if (descDocumentId) {
              navigate(`/doc/${descDocumentId}`);
            }
          }}
          onContextMenu={setMenu}
          onDeselect={() => {
            setSelectedCreateParentPath("");
            navigate("/");
          }}
        />
        <footer className="mdocs-sidebar-footer" onClick={() => setView("settings")}>
          <span className="mdocs-visitor-avatar">
            {visitor ? visitor.visitorName.charAt(0).toUpperCase() : "?"}
          </span>
          <span className="mdocs-visitor-footer-name">{visitor ? visitor.visitorName : ""}</span>
        </footer>
      </aside>
      <main className="mdocs-main">
        {activeDoc ? (
          <DocumentEditor
            key={activeDoc.documentId}
            document={activeDoc}
            canEdit={Boolean(visitor && (activeDoc.ownerVisitorId === visitor.visitorId || activeDoc.permission === 2))}
            domains={domains}
            currentDomainId={currentDomainId}
            onDomainChange={(domainId) => {
              setCurrentDomainId(domainId);
              setActiveDoc(null);
              setSelectedCreateParentPath("");
              navigate("/");
              void refreshTree(domainId);
            }}
            onSave={saveDocument}
            onDelete={() =>
              deleteDocumentById(activeDoc.documentId, activeDoc.relativePath)
            }
          />
        ) : (
          <div className="mdocs-welcome">
            <h1>{t("brand")}</h1>
            <p className="muted mdocs-welcome-lead">
              {tree.length === 0 ? t("noDocsInDomain") : t("createDocToStart")}
            </p>
            <div className="mdocs-welcome-domain">
              <label className="muted mdocs-welcome-domain-label" htmlFor="mdocs-welcome-domain">
                {t("domainLabel")}
              </label>
              <select
                id="mdocs-welcome-domain"
                className="mdocs-editor-domain-select"
                aria-label={t("domainLabel")}
                value={currentDomainId}
                onChange={(e) => {
                  const domainId = e.target.value;
                  setCurrentDomainId(domainId);
                  setActiveDoc(null);
                  setSelectedCreateParentPath("");
                  navigate("/");
                  void refreshTree(domainId);
                }}
              >
                {(domains.length ? domains : [{ domainId: "default", domainName: t("defaultDomain") }]).map((d) => (
                  <option key={d.domainId} value={d.domainId}>
                    {localizeDomainName(d.domainName, lang, t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mdocs-welcome-actions">
              <button type="button" className="primary" onClick={() => openNewDocumentModal()}>
                {t("newDocument")}
              </button>
              <button type="button" onClick={() => openNewFolderModal()}>
                {t("newFolder")}
              </button>
            </div>
          </div>
        )}
        {message && (
          <div className="mdocs-toast" role="status">
            {message}
          </div>
        )}
        {alertMessage && (
          <MessageDialog
            title={t("error")}
            message={alertMessage}
            onClose={() => setAlertMessage(null)}
          />
        )}
      </main>
      {menu && (
        <TreeContextMenu
          x={menu.x}
          y={menu.y}
          node={menu.node}
          parentPath={menu.parentPath}
          onClose={() => setMenu(null)}
          onCreateChild={(parent) => openNewDocumentModal(parent)}
          onCreateFolder={(parent) => openNewFolderModal(parent)}
          onDelete={(doc) => deleteDocumentById(doc.documentId, doc.path)}
        />
      )}
      {createModal && (
        <div
          className="mdocs-dialog-backdrop"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget && !createModalBusy) setCreateModal(null);
          }}
        >
          <div className="mdocs-dialog card" role="dialog" aria-modal="true">
            <h1>{createModal.kind === "document" ? t("newDocumentTitle") : t("newFolderTitle")}</h1>
            <p className="muted">
              {createModal.kind === "document"
                ? t("fileNameHint")
                : t("folderNameHint")}
            </p>
            <form onSubmit={submitCreateModal} className="mdocs-dialog-form">
              <label className="mdocs-dialog-label">
                {createModal.kind === "document" ? t("fileNameLabel") : t("folderNameLabel")}
                <input
                  ref={createModalInputRef}
                  value={createModal.draft}
                  onChange={(ev) =>
                    setCreateModal((prev) =>
                      prev ? { ...prev, draft: ev.target.value } : prev,
                    )
                  }
                  placeholder={createModal.kind === "document" ? t("untitledPlaceholder") : t("folderExamplePlaceholder")}
                  maxLength={200}
                  disabled={createModalBusy}
                />
              </label>
              {createModalError && <div className="mdocs-dialog-error">{createModalError}</div>}
              <div className="mdocs-dialog-actions">
                <button
                  type="button"
                  onClick={() => !createModalBusy && setCreateModal(null)}
                  disabled={createModalBusy}
                >
                  {t("cancel")}
                </button>
                <button type="submit" className="primary" disabled={createModalBusy}>
                  {createModalBusy ? t("creating") : t("create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

function translateError(t: (k: import("../i18n/types").TranslationKey, vars?: Record<string, string>) => string, err: unknown): string {
  if (err instanceof ApiRequestError) {
    const key = ERROR_CODE_MAP[err.code];
    if (key) return t(key);
    return err.message;
  }
  if (err instanceof DocPathError) {
    const key = PATH_ERROR_MESSAGE_MAP[err.message];
    if (key) return t(key);
    return err.message;
  }
  if (err instanceof Error) {
    const key = PATH_ERROR_MESSAGE_MAP[err.message] ?? STORAGE_ERROR_MESSAGE_MAP[err.message];
    if (key) return t(key);
    return err.message;
  }
  return String(err);
}

function translateStorageError(t: (k: import("../i18n/types").TranslationKey, vars?: Record<string, string>) => string, message: string): string {
  const key = STORAGE_ERROR_MESSAGE_MAP[message];
  if (key) return t(key);
  return message;
}

function localizeDomainName(name: string, lang: "en" | "zh", t: (k: import("../i18n/types").TranslationKey, vars?: Record<string, string>) => string): string {
  if (name === "Default") return t("defaultDomain");
  // Personal domain: strip Chinese suffix and re-apply localized suffix
  const suffix = "个人域";
  if (name.endsWith(suffix)) {
    const base = name.slice(0, -suffix.length);
    return base + t("personalDomainSuffix");
  }
  return name;
}


