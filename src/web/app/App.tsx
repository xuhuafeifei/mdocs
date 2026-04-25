import { useEffect, useState } from "react";
import type { VisitorPublic } from "../../shared/types/visitor";
import type { DocumentDetail } from "../../shared/types/document";
import type { TreeNode } from "../../shared/types/tree";
import {
  ApiRequestError,
  clearIdentity,
  getStoredToken,
  storeIdentity,
} from "../api/client";
import {
  createDocumentApi,
  deleteDocumentApi,
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

export function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [visitor, setVisitor] = useState<VisitorPublic | null>(null);
  const [pendingVisitorId, setPendingVisitorId] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [menu, setMenu] = useState<TreeContextMenuPayload | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap(): Promise<void> {
    if (!getStoredToken()) {
      setPhase("needsRegister");
      return;
    }
    try {
      const me = await fetchMe();
      setVisitor(me);
      await refreshTree();
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
    await refreshTree();
    setPhase("ready");
  }

  async function refreshTree(): Promise<void> {
    const nodes = await fetchTreeApi();
    setTree(nodes);
  }

  async function openDocument(documentId: string): Promise<void> {
    try {
      const doc = await getDocumentApi(documentId);
      setActiveDoc(doc);
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  async function createDocumentIn(parentPath: string): Promise<void> {
    const fileName = window.prompt("new document name (ends with .md)", "untitled.md");
    if (!fileName) return;
    const trimmed = fileName.trim();
    if (!trimmed) return;
    const relativePath = parentPath ? `${parentPath}/${trimmed}` : trimmed;
    try {
      const doc = await createDocumentApi({
        relativePath,
        content: `# ${trimmed.replace(/\.md$/i, "")}\n\n`,
      });
      await refreshTree();
      setActiveDoc(doc);
    } catch (err) {
      setMessage(errorMessage(err));
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
      }
      await refreshTree();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  function logout(): void {
    clearIdentity();
    setVisitor(null);
    setActiveDoc(null);
    setTree([]);
    setPhase("needsRegister");
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
          <button type="button" onClick={() => createDocumentIn("")} className="primary">
            New document
          </button>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
        <DocumentTree
          nodes={tree}
          activeDocumentId={activeDoc?.documentId ?? null}
          onOpen={(node) => openDocument(node.documentId)}
          onContextMenu={setMenu}
        />
      </aside>
      <main className="mdocs-main">
        {activeDoc ? (
          <DocumentEditor
            key={activeDoc.documentId}
            document={activeDoc}
            canEdit={Boolean(visitor && activeDoc.ownerVisitorId === visitor.visitorId)}
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
              <button type="button" className="primary" onClick={() => createDocumentIn("")}>
                New document
              </button>
            </div>
          </div>
        )}
        {message && <div className="mdocs-toast">{message}</div>}
      </main>
      {menu && (
        <TreeContextMenu
          x={menu.x}
          y={menu.y}
          node={menu.node}
          parentPath={menu.parentPath}
          onClose={() => setMenu(null)}
          onCreateChild={(parent) => createDocumentIn(parent)}
          onDelete={(doc) => deleteDocumentById(doc.documentId, doc.path)}
        />
      )}
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
