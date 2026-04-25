import { useEffect, useRef, useState } from "react";
import type { VisitorPublic } from "../../shared/types/visitor";
import type { DocumentDetail } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import type { TreeNode } from "../../shared/types/tree";
import { DocPathError, normaliseDocRelativePath } from "../../shared/docPath";
import { FOLDER_DESC_FILENAME, folderDescPathForFolder } from "../../shared/folderDesc";
import {
  ApiRequestError,
  clearIdentity,
  getStoredToken,
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

function suggestUntitledMd(parentPath: string, paths: Set<string>): string {
  const rel = (name: string) => joinDocPath(parentPath, name);
  if (!paths.has(rel("untitled.md"))) return "untitled.md";
  let i = 2;
  while (paths.has(rel(`untitled-${i}.md`))) i += 1;
  return `untitled-${i}.md`;
}

const FOLDER_SEGMENT_RX = /^[A-Za-z0-9_\-\.\u4e00-\u9fa5]+$/;

function parseFolderSegment(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: false, message: "enter a folder name" };
  if (t.includes("/") || t.includes("\\")) return { ok: false, message: "use a single name, not a path" };
  if (t === "." || t === ".." || t.includes("..")) return { ok: false, message: "invalid folder name" };
  if (!FOLDER_SEGMENT_RX.test(t)) return { ok: false, message: "unsupported characters in folder name" };
  return { ok: true, value: t };
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
        doms.find((d) => d.domainId === "default")?.domainId ?? doms[0]?.domainId ?? "default";
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
      doms.find((d) => d.domainId === "default")?.domainId ?? doms[0]?.domainId ?? "default";
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
      setSelectedCreateParentPath(parentDirForCreates(doc.relativePath));
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  function openNewDocumentModal(explicitParentPath?: string): void {
    const fixed = explicitParentPath !== undefined;
    const snapshotParent = fixed ? explicitParentPath! : selectedCreateParentPath;
    const paths = collectDocumentPaths(tree);
    const draft = suggestUntitledMd(snapshotParent, paths);
    setCreateModalError(null);
    setCreateModal({
      kind: "document",
      parentMode: fixed ? "fixed" : "selection",
      parentPath: fixed ? explicitParentPath! : "",
      draft,
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
        let file = createModal.draft.trim();
        if (!file) {
          setCreateModalError("enter a file name");
          return;
        }
        if (!file.toLowerCase().endsWith(".md")) file += ".md";
        let relativePath: string;
        try {
          relativePath = normaliseDocRelativePath(joinDocPath(effectiveParent, file));
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
          content: `# ${file.replace(/\.md$/i, "")}\n\n`,
          domainId: currentDomainId,
        });
        await refreshTree();
        setActiveDoc(doc);
        setSelectedCreateParentPath(parentDirForCreates(doc.relativePath));
        setCreateModal(null);
        return;
      }
      const parsed = parseFolderSegment(createModal.draft);
      if (!parsed.ok) {
        setCreateModalError(parsed.message);
        return;
      }
      const folderPrefix = joinDocPath(effectiveParent, parsed.value);
      let relativePath: string;
      try {
        relativePath = normaliseDocRelativePath(joinDocPath(folderPrefix, FOLDER_DESC_FILENAME));
      } catch (e) {
        setCreateModalError(e instanceof DocPathError ? e.message : "invalid path");
        return;
      }
      if (paths.has(relativePath)) {
        setCreateModalError("a folder with this name already exists");
        return;
      }
      const folderTitle = parsed.value;
      const doc = await createDocumentApi({
        relativePath,
        title: folderTitle,
        content: `# ${folderTitle}\n\n`,
        domainId: currentDomainId,
      });
      await refreshTree();
      setActiveDoc(doc);
      setSelectedCreateParentPath(parentDirForCreates(doc.relativePath));
      setCreateModal(null);
    } catch (err) {
      setCreateModalError(errorMessage(err));
    } finally {
      setCreateModalBusy(false);
    }
  }

  async function saveDocument(content: string, title: string): Promise<void> {
    if (!activeDoc) return;
    try {
      const updated = await updateDocumentApi(activeDoc.documentId, { content, title });
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
            <p className="muted">Create a document to start writing.</p>
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
                ? "File name must end with .md. A free name is suggested from your tree."
                : "Creates a new subdirectory under the current location."}
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
                  placeholder={createModal.kind === "document" ? "note.md" : "e.g. research"}
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
