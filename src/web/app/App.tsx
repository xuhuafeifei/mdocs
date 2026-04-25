import { useEffect, useRef, useState } from "react";
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
    return [{ domainId: "default", domainName: "Default" }];
  }
}

export function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [visitor, setVisitor] = useState<VisitorPublic | null>(null);
  const [pendingVisitorId, setPendingVisitorId] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [currentDomainId, setCurrentDomainId] = useState("default");
  const [activeDoc, setActiveDoc] = useState<DocumentDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [menu, setMenu] = useState<TreeContextMenuPayload | null>(null);
  const [createModal, setCreateModal] = useState<CreateModalState | null>(null);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [createModalBusy, setCreateModalBusy] = useState(false);
  const createModalInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCreateParentPath, setSelectedCreateParentPath] = useState("");

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
      setMessage(errorMessage(err));
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

  async function openDocument(documentId: string): Promise<void> {
    try {
      const doc = await getDocumentApi(documentId);
      setActiveDoc(doc);
      setSelectedCreateParentPath(parentDirForCreates(docPathForSelection(doc)));
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

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
          setCreateModalError(fileParsed.message);
          return;
        }
        const displayFile = fileParsed.displayFile;
        const displayTitle = displayFile.replace(/\.md$/i, "");
        let relativePath: string;
        try {
          relativePath = normaliseRelativePathForStorage(joinDocPath(effectiveParent, displayFile));
        } catch (e) {
          setCreateModalError(e instanceof DocPathError ? e.message : "invalid path");
          return;
        }
        if (paths.has(relativePath)) {
          setCreateModalError("this path already exists; pick another name");
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
        setCreateModal(null);
        return;
      }
      const parsed = parseDisplayNameFolder(createModal.draft);
      if (!parsed.ok) {
        setCreateModalError(parsed.message);
        return;
      }
      const storageSeg = normalisePathSegmentForStorage(parsed.display);
      if (!storageSeg) {
        setCreateModalError("could not derive a safe folder path from that name");
        return;
      }
      const folderPrefix = joinDocPath(effectiveParent, storageSeg);
      let relativePath: string;
      try {
        relativePath = normaliseRelativePathForStorage(joinDocPath(folderPrefix, FOLDER_DESC_FILENAME));
      } catch (e) {
        setCreateModalError(e instanceof DocPathError ? e.message : "invalid path");
        return;
      }
      if (paths.has(relativePath)) {
        setCreateModalError("a folder with this name already exists");
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
      setCreateModal(null);
    } catch (err) {
      setCreateModalError(errorMessage(err));
    } finally {
      setCreateModalBusy(false);
    }
  }

  async function saveDocument(content: string, displayName: string): Promise<void> {
    if (!activeDoc) return;
    try {
      const updated = await updateDocumentApi(activeDoc.documentId, { content, displayName });
      setActiveDoc(updated);
      await refreshTree();
      setMessage("saved");
      window.setTimeout(() => setMessage(null), 1200);
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  async function deleteDocumentById(documentId: string, label: string): Promise<void> {
    if (!window.confirm(`delete ${label}?`)) return;
    try {
      await deleteDocumentApi(documentId);
      if (activeDoc?.documentId === documentId) {
        setActiveDoc(null);
        setSelectedCreateParentPath("");
      }
      await refreshTree();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  if (phase === "loading") {
    return <div className="mdocs-loading muted">loading...</div>;
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
      <aside className="mdocs-sidebar">
        <header className="mdocs-sidebar-header">
          <div className="mdocs-brand">mdocs</div>
          <div className="muted mdocs-visitor-line">
            {visitor ? visitor.visitorName : ""}
          </div>
        </header>
        <div className="mdocs-sidebar-actions">
          <button type="button" onClick={() => openNewDocumentModal()} className="primary">
            New document
          </button>
          <button type="button" onClick={() => openNewFolderModal()}>
            New folder
          </button>
        </div>
        <DocumentTree
          nodes={tree}
          activeDocumentId={activeDoc?.documentId ?? null}
          selectedParentPath={selectedCreateParentPath}
          onOpen={(node) => void openDocument(node.documentId)}
          onOpenFolder={(folderPath, descDocumentId) => {
            setSelectedCreateParentPath(folderPath);
            if (descDocumentId) {
              void openDocument(descDocumentId);
            } else {
              setActiveDoc(null);
            }
          }}
          onContextMenu={setMenu}
        />
      </aside>
      <main className="mdocs-main">
        {activeDoc ? (
          <DocumentEditor
            key={activeDoc.documentId}
            document={activeDoc}
            canEdit={Boolean(visitor && activeDoc.ownerVisitorId === visitor.visitorId)}
            domains={domains}
            currentDomainId={currentDomainId}
            onDomainChange={(domainId) => {
              setCurrentDomainId(domainId);
              setActiveDoc(null);
              setSelectedCreateParentPath("");
              void refreshTree(domainId);
            }}
            onSave={saveDocument}
            onDelete={() =>
              deleteDocumentById(activeDoc.documentId, activeDoc.relativePath)
            }
          />
        ) : (
          <div className="mdocs-welcome">
            <h1>mdocs</h1>
            {tree.length === 0 ? (
              <>
                <p className="muted mdocs-welcome-lead">
                  No documents in this domain yet. Switch domain below or create a document.
                </p>
                <div className="mdocs-welcome-domain">
                  <label className="muted mdocs-welcome-domain-label" htmlFor="mdocs-welcome-domain">
                    Domain
                  </label>
                  <select
                    id="mdocs-welcome-domain"
                    className="mdocs-editor-domain-select"
                    aria-label="Domain"
                    value={currentDomainId}
                    onChange={(e) => {
                      const domainId = e.target.value;
                      setCurrentDomainId(domainId);
                      setActiveDoc(null);
                      setSelectedCreateParentPath("");
                      void refreshTree(domainId);
                    }}
                  >
                    {(domains.length ? domains : [{ domainId: "default", domainName: "Default" }]).map(
                      (d) => (
                        <option key={d.domainId} value={d.domainId}>
                          {d.domainName}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </>
            ) : (
              <p className="muted">Create a document to start writing.</p>
            )}
            <div className="mdocs-welcome-actions">
              <button type="button" className="primary" onClick={() => openNewDocumentModal()}>
                New document
              </button>
            </div>
          </div>
        )}
        {message && (
          <div className="mdocs-toast" role="status">
            {message}
          </div>
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
            <h1>{createModal.kind === "document" ? "New document" : "New folder"}</h1>
            <p className="muted">
              {createModal.kind === "document"
                ? "Names are shown as you type; stored paths are normalised (e.g. spaces → underscores). Use a .md file name."
                : "Names are shown as you type; stored paths are normalised (e.g. folder 1 → folder_1)."}
            </p>
            <form onSubmit={submitCreateModal} className="mdocs-dialog-form">
              <label className="mdocs-dialog-label">
                {createModal.kind === "document" ? "File name" : "Folder name"}
                <input
                  ref={createModalInputRef}
                  value={createModal.draft}
                  onChange={(ev) =>
                    setCreateModal((prev) =>
                      prev ? { ...prev, draft: ev.target.value } : prev,
                    )
                  }
                  placeholder={createModal.kind === "document" ? "untitled.md" : "e.g. research"}
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
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={createModalBusy}>
                  {createModalBusy ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
