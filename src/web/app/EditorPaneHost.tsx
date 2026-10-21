/**
 * 单栏编辑器宿主：按 fileType 挂 Sheet / Html / DocumentEditor。
 * 供 App 主栏与上下分屏下栏复用。
 */
import { Suspense, lazy, type ReactNode } from "react";
import type { DomainSummary } from "../../shared/types/domain";
import type { ActiveDocumentMeta, DocumentDetail } from "../../shared/types/document";
import { isFolderDescPath } from "../../shared/folderDesc";
import { isPublicWritePermission } from "../../shared/permissions.js";

const DocumentEditor = lazy(() =>
  import("./DocumentEditor").then((m) => ({ default: m.DocumentEditor })),
);
const HtmlEditor = lazy(() =>
  import("./HtmlEditor").then((m) => ({ default: m.HtmlEditor })),
);
const SheetEditor = lazy(() =>
  import("./SheetEditor").then((m) => ({ default: m.SheetEditor })),
);

export type EditorPaneContent = {
  documentId: string;
  content: string;
  displayName: string;
};

export function EditorPaneHost(props: {
  meta: ActiveDocumentMeta;
  editorContent: EditorPaneContent;
  contentRevision: number;
  visitorId: string | null | undefined;
  domains: DomainSummary[];
  currentDomainId: string;
  onDomainChange: (domainId: string) => void;
  onDomainsChange: (domains: DomainSummary[]) => void;
  onContentChange?: (content: string) => void;
  onDraftExistsChange: (exists: boolean) => void;
  hasLocalDraft: boolean;
  onPublish: (
    content: string,
    displayName: string,
    documentId: string,
    permission?: number,
  ) => Promise<void>;
  syncBehind: boolean;
  onSyncClick: () => void;
  onConflictModalRequest?: () => void;
  onMergeRequest?: () => void;
  onDeleteDocument: (documentId: string, relativePath: string) => void;
  onDeleteFolder: (documentId: string, folderPath: string) => void;
  saveBeforeNavRef?: React.MutableRefObject<(() => Promise<void>) | undefined>;
  exportMarkdownRef?: React.MutableRefObject<(() => string) | undefined>;
  onShowToast?: (msg: string) => void;
  onShowError?: (msg: string) => void;
  onVersionRestored: (doc: DocumentDetail) => void;
  onToggleComments?: () => void;
  commentPanelOpen?: boolean;
  commentCount?: number;
  onAiWrite?: () => void;
  readerChrome?: boolean;
  onOpenMobileNav?: () => void;
  onFocusPane?: () => void;
  splitChrome?: ReactNode;
  className?: string;
}) {
  const { meta, editorContent } = props;
  const canEdit = Boolean(
    props.visitorId &&
      (meta.ownerVisitorId === props.visitorId ||
        isPublicWritePermission(meta.permission) ||
        meta.invitedEdit === true),
  );
  const canManageInvites = Boolean(props.visitorId && props.visitorId === meta.ownerVisitorId);
  const toggleComments = props.onToggleComments ?? (() => undefined);

  const fallback = (
    <div className="muted" style={{ padding: 24 }}>
      加载编辑器…
    </div>
  );

  const body =
    meta.fileType === "sheet" ? (
      <SheetEditor
        key={meta.documentId}
        meta={meta}
        initialContent={editorContent.content}
        initialDisplayName={editorContent.displayName}
        contentRevision={props.contentRevision}
        canEdit={canEdit}
        domains={props.domains}
        currentDomainId={props.currentDomainId}
        onDomainChange={props.onDomainChange}
        onDomainsChange={props.onDomainsChange}
        onContentChange={props.onContentChange}
        onDraftExistsChange={props.onDraftExistsChange}
        hasLocalDraft={props.hasLocalDraft}
        onPublish={props.onPublish}
        syncBehind={props.syncBehind}
        onSyncClick={props.onSyncClick}
        canManageInvites={canManageInvites}
        onDelete={async () => props.onDeleteDocument(meta.documentId, meta.relativePath)}
        onToggleComments={props.onToggleComments}
        commentPanelOpen={props.commentPanelOpen}
        commentCount={props.commentCount}
        onShowToast={props.onShowToast}
        onVersionRestored={props.onVersionRestored}
        readerChrome={props.readerChrome}
        onOpenMobileNav={props.onOpenMobileNav}
      />
    ) : meta.fileType === "html" ? (
      <HtmlEditor
        key={meta.documentId}
        meta={meta}
        initialContent={editorContent.content}
        initialDisplayName={editorContent.displayName}
        contentRevision={props.contentRevision}
        canEdit={canEdit}
        domains={props.domains}
        currentDomainId={props.currentDomainId}
        onDomainChange={props.onDomainChange}
        onDomainsChange={props.onDomainsChange}
        onContentChange={props.onContentChange}
        onDraftExistsChange={props.onDraftExistsChange}
        hasLocalDraft={props.hasLocalDraft}
        onPublish={props.onPublish}
        syncBehind={props.syncBehind}
        onSyncClick={props.onSyncClick}
        canManageInvites={canManageInvites}
        onDelete={async () => props.onDeleteDocument(meta.documentId, meta.relativePath)}
        onToggleComments={props.onToggleComments}
        commentPanelOpen={props.commentPanelOpen}
        commentCount={props.commentCount}
        onAiWrite={props.onAiWrite}
        onShowToast={props.onShowToast}
        onVersionRestored={props.onVersionRestored}
        readerChrome={props.readerChrome}
        onOpenMobileNav={props.onOpenMobileNav}
      />
    ) : (
      <DocumentEditor
        key={meta.documentId}
        meta={meta}
        initialContent={editorContent.content}
        initialDisplayName={editorContent.displayName}
        contentRevision={props.contentRevision}
        canEdit={canEdit}
        domains={props.domains}
        currentDomainId={props.currentDomainId}
        onDomainChange={props.onDomainChange}
        onDomainsChange={props.onDomainsChange}
        onPublish={props.onPublish}
        syncBehind={props.syncBehind}
        onSyncClick={props.onSyncClick}
        onDraftExistsChange={props.onDraftExistsChange}
        hasLocalDraft={props.hasLocalDraft}
        onConflictModalRequest={props.onConflictModalRequest}
        onMergeRequest={props.onMergeRequest}
        canManageInvites={canManageInvites}
        onDelete={async () => {
          if (meta.fileType === "folder_desc" || isFolderDescPath(meta.relativePath)) {
            const folderPath = meta.relativePath.replace(/\/___desc___\.md$/, "");
            props.onDeleteFolder(meta.documentId, folderPath);
          } else {
            props.onDeleteDocument(meta.documentId, meta.relativePath);
          }
        }}
        saveBeforeNavRef={props.saveBeforeNavRef}
        exportMarkdownRef={props.exportMarkdownRef}
        onShowToast={props.onShowToast}
        onShowError={props.onShowError}
        onVersionRestored={props.onVersionRestored}
        onToggleComments={toggleComments}
        commentPanelOpen={Boolean(props.commentPanelOpen)}
        commentCount={props.commentCount ?? 0}
        onAiWrite={props.onAiWrite}
        readerChrome={props.readerChrome}
        onOpenMobileNav={props.onOpenMobileNav}
      />
    );

  return (
    <div
      className={"mdocs-editor-pane" + (props.className ? ` ${props.className}` : "")}
      onMouseDown={props.onFocusPane}
    >
      {props.splitChrome}
      <div className="mdocs-editor-with-comments">
        <div className="mdocs-editor-container">
          <Suspense fallback={fallback}>{body}</Suspense>
        </div>
      </div>
    </div>
  );
}
