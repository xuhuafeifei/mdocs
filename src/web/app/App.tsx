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
import { DocPathError } from "../../shared/docPath";
import { stripDomainPathPrefix } from "../../shared/personalDomain";
import {
  ApiRequestError,
  clearIdentity,
  getStoredToken,
  getStoredVisitorId,
  storeIdentity,
} from "../services/client";
import {
  deleteDocumentApi,
  fetchDomainsApi,
  fetchMe,
  fetchTreeApi,
  getDocumentApi,
  registerVisitorApi,
  updateDocumentApi,
} from "../services/endpoints";
import { VisitorRegisterDialog } from "./VisitorRegisterDialog";
import { VisitorIdNotice } from "./VisitorIdNotice";
import { DocumentTree, type TreeContextMenu as TreeContextMenuPayload } from "./DocumentTree";
import { TreeContextMenu } from "./TreeContextMenu";
import { DocumentEditor } from "./DocumentEditor";
import { DomainSelect } from "./DomainSelect";
import { SettingsPage } from "./SettingsPage";
import { MessageDialog } from "./MessageDialog";
import { useCreateModal } from "./hooks/useCreateModal";
import { ConflictNotice } from "./ConflictNotice";
import { getDraft, saveDraft as saveDraftRecord, deleteDraft as deleteDraftRecord } from "../storage/drafts";
import mdocsLogo from "../assets/mdocs-logo.svg";
import "./App.css";

type Phase = "loading" | "needsRegister" | "ready";

/** Tree / create-modal paths are domain-relative; strip personal-domain storage prefix. */
function parentDirForCreates(relativePath: string): string {
  const i = relativePath.lastIndexOf("/");
  return i === -1 ? "" : relativePath.slice(0, i);
}

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
  const [selectedCreateParentPath, setSelectedCreateParentPath] = useState("");
  const [view, setView] = useState<"docs" | "settings">("docs");
  const editorDirtyRef = useRef({ isDirty: false, hasDraft: false });
  const [navGuard, setNavGuard] = useState<{ onProceed: () => void } | null>(null);
  const saveBeforeNavRef = useRef<() => Promise<void>>();

  async function guardNavigate(onProceed: () => void): Promise<void> {
    const { isDirty, hasDraft } = editorDirtyRef.current;
    console.log("[guardNavigate] isDirty=", isDirty, "hasCurrentDraft=", hasDraft, "willBlock=", isDirty && !hasDraft);
    if (isDirty && !hasDraft) {
      // Auto-save enabled: flush pending changes before navigating, no dialog
      const autoSave = localStorage.getItem("mdocs.autoSave") !== "false";
      if (autoSave && saveBeforeNavRef.current) {
        await saveBeforeNavRef.current();
        onProceed();
        return;
      }
      setNavGuard({ onProceed });
      return;
    }
    onProceed();
  }

  function handleNavGuardProceed(): void {
    const cb = navGuard?.onProceed;
    setNavGuard(null);
    cb?.();
  }

  function handleNavGuardCancel(): void {
    setNavGuard(null);
  }

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
      // 1. Local-first: if draft exists with cached metadata, skip network entirely
      const draft = await getDraft(docId);
      if (draft && !draft.published && draft.relativePath && draft.domainId && draft.ownerVisitorId) {
        console.log("[openDocument] loaded from local draft, content preview:", draft.content.slice(0, 100));
        setActiveDoc({
          documentId: draft.documentId,
          relativePath: draft.relativePath,
          displayName: draft.displayName,
          content: draft.content,
          permission: draft.permission!,
          ownerVisitorId: draft.ownerVisitorId!,
          domainId: draft.domainId,
        } as DocumentDetail);
        setSelectedCreateParentPath(parentDirForCreates(draft.relativePath));
        return;
      }

      // 2. No usable draft — fetch full document from server
      const doc = await getDocumentApi(docId);
      setSelectedCreateParentPath(parentDirForCreates(docPathForSelection(doc)));

      // 3. Cache metadata into existing draft so next open skips the network
      if (draft && !draft.published) {
        await saveDraftRecord({
          ...draft,
          relativePath: doc.relativePath,
          permission: doc.permission,
          ownerVisitorId: doc.ownerVisitorId,
          domainId: doc.domainId,
        });
      }

      setActiveDoc(draft && !draft.published
        ? { ...doc, content: draft.content, displayName: draft.displayName }
        : doc);
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

  const {
    createModal,
    setCreateModal,
    createModalError,
    createModalBusy,
    createModalInputRef,
    openNewDocumentModal,
    openNewFolderModal,
    submitCreateModal,
  } = useCreateModal({
    tree,
    currentDomainId,
    selectedCreateParentPath,
    t,
    onDocCreated: (doc: DocumentDetail) => {
      setActiveDoc(doc);
      setSelectedCreateParentPath(parentDirForCreates(docPathForSelection(doc)));
      navigate(`/doc/${doc.documentId}`);
    },
    refreshTree,
  });

  const [conflict, setConflict] = useState(false);

  async function publishDocument(content: string, displayName: string, documentId: string): Promise<void> {
    try {
      const updated = await updateDocumentApi(documentId, { content, displayName });
      setActiveDoc((prev) => (prev && prev.documentId === documentId ? updated : prev));
      await refreshTree();
      setConflict(false);
      setMessage(t("published"));
      window.setTimeout(() => setMessage(null), 1200);
    } catch (err) {
      // Future: detect git conflict specifically, for now treat all publish failures as potential conflicts
      setConflict(true);
      throw err;
    }
  }

  async function publishDraftFromList(docId: string): Promise<void> {
    try {
      const draft = await getDraft(docId);
      if (!draft) return;
      await updateDocumentApi(docId, { content: draft.content, displayName: draft.displayName });
      await deleteDraftRecord(docId);
      await refreshTree();
      setMessage(t("published"));
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
          onPublishDraft={publishDraftFromList}
        />
      ) : (
        <>
      <aside className="mdocs-sidebar">
        <header className="mdocs-sidebar-header">
          <div className="mdocs-brand">
            <img src={mdocsLogo} alt={t("brand")} className="mdocs-brand-logo" />
            <span>{t("brand")}</span>
          </div>
        </header>
        <div className="mdocs-sidebar-actions">
          <button type="button" onClick={() => openNewDocumentModal()} className="primary">
            {t("newDocument")}
          </button>
          <button type="button" className="secondary" onClick={() => openNewFolderModal()}>
            {t("newFolder")}
          </button>
        </div>
        <DocumentTree
          nodes={tree}
          activeDocumentId={documentId ?? null}
          selectedParentPath={selectedCreateParentPath}
          onOpen={(node) => {
            guardNavigate(() => navigate(`/doc/${node.documentId}`));
          }}
          onOpenFolder={(folderPath, descDocumentId) => {
            guardNavigate(() => {
              setSelectedCreateParentPath(folderPath);
              if (descDocumentId) {
                navigate(`/doc/${descDocumentId}`);
              }
            });
          }}
          onContextMenu={setMenu}
          onDeselect={() => {
            guardNavigate(() => {
              setSelectedCreateParentPath("");
              navigate("/");
            });
          }}
        />
        <footer className="mdocs-sidebar-footer" onClick={() => { guardNavigate(() => setView("settings")); }}>
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
              guardNavigate(() => {
                setCurrentDomainId(domainId);
                setActiveDoc(null);
                setSelectedCreateParentPath("");
                navigate("/");
                void refreshTree(domainId);
              });
            }}
            onPublish={publishDocument}
            onDirtyChange={(dirty, hasDraft) => {
              // console.log("[onDirtyChange] isDirty=", dirty, "hasDraft=", hasDraft);
              editorDirtyRef.current = { isDirty: dirty, hasDraft };
            }}
            onDelete={() =>
              deleteDocumentById(activeDoc.documentId, activeDoc.relativePath)
            }
            saveBeforeNavRef={saveBeforeNavRef}
          />
        ) : (
          <div className="mdocs-welcome">
            <h1>{t("brand")}</h1>
            <p className="muted mdocs-welcome-lead">
              {tree.length === 0 ? t("noDocsInDomain") : t("createDocToStart")}
            </p>
            <div className="mdocs-welcome-domain">
              <label className="muted mdocs-welcome-domain-label">
                {t("domainLabel")}
              </label>
              <DomainSelect
                domains={domains.length ? domains : [{ domainId: "default", domainName: t("defaultDomain"), permission: "" }]}
                value={currentDomainId}
                onChange={(domainId) => {
                  guardNavigate(() => {
                    setCurrentDomainId(domainId);
                    setActiveDoc(null);
                    setSelectedCreateParentPath("");
                    navigate("/");
                    void refreshTree(domainId);
                  });
                }}
                ariaLabel={t("domainLabel")}
                localizeName={(name: string) => localizeDomainName(name, lang, t)}
              />
            </div>
            <div className="mdocs-welcome-actions">
              <button type="button" className="primary" onClick={() => openNewDocumentModal()}>
                {t("newDocument")}
              </button>
              <button type="button" className="secondary" onClick={() => openNewFolderModal()}>
                {t("newFolder")}
              </button>
            </div>
          </div>
        )}
        {conflict && (
          <ConflictNotice onDismiss={() => setConflict(false)} />
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
      {navGuard && (
        <div
          className="mdocs-dialog-backdrop"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setNavGuard(null);
          }}
        >
          <div className="mdocs-dialog card" role="dialog" aria-modal="true">
            <p>{t("unsavedChanges")}</p>
            <div className="mdocs-dialog-actions">
              <button type="button" onClick={handleNavGuardCancel}>
                {t("cancel")}
              </button>
              <button type="button" className="primary" onClick={handleNavGuardProceed}>
                {t("continue")}
              </button>
            </div>
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


