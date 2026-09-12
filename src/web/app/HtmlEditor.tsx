/**
 * HtmlEditor — HTML 文档正文 + DocChrome 顶栏。
 *
 * 默认预览（忽略 autoEdit）；预览/编辑经 leadingExtra。
 * 帮写 / 评论由政策 aiWrite、comments 开放（落盘管道在 App）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldUser, Star, Users } from "lucide-react";
import type { ActiveDocumentMeta } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import {
  DocumentPermission,
  allowedPermissionsForDomain,
  type DocumentPermissionValue,
} from "../../shared/permissions.js";
import { useI18n } from "../i18n";
import { localizeDomainName } from "./utils";
import { DocChrome } from "./DocChrome";
import { getDocumentTaskQueue } from "./documentTaskQueue";
import { upsertContentDraft } from "../storage/drafts";
import {
  addBookmarkApi,
  addDocumentInviteApi,
  checkBookmarkApi,
  fetchVisitorsDirectoryApi,
  getDocumentInvitesApi,
  removeBookmarkApi,
  removeDocumentInviteApi,
} from "../services/endpoints";
import type { VisitorDirectoryEntry } from "../../shared/types/visitor";
import { VisitorPickerModal } from "./VisitorPickerModal";
import "./HtmlEditor.css";

interface HtmlEditorProps {
  meta: ActiveDocumentMeta;
  initialContent: string;
  initialDisplayName: string;
  contentRevision?: number;
  canEdit: boolean;
  domains: DomainSummary[];
  currentDomainId: string;
  onDomainChange: (domainId: string) => void;
  onDomainsChange?: (domains: DomainSummary[]) => void;
  onContentChange?: (content: string) => void;
  onPublish: (
    content: string,
    displayName: string,
    documentId: string,
    permission?: number,
  ) => Promise<void>;
  onDraftExistsChange?: (exists: boolean) => void;
  syncBehind?: boolean;
  onSyncClick?: () => void;
  onDelete: () => Promise<void>;
  canManageInvites?: boolean;
  onToggleComments?: () => void;
  commentPanelOpen?: boolean;
  commentCount?: number;
  onAiWrite?: () => void;
  onShowToast?: (message: string) => void;
  readerChrome?: boolean;
  onOpenMobileNav?: () => void;
}

export function HtmlEditor(props: HtmlEditorProps) {
  const { t, lang } = useI18n();
  const documentId = props.meta.documentId;

  const [content, setContent] = useState(props.initialContent);
  const [displayName, setDisplayName] = useState(props.initialDisplayName);
  const [previewMode, setPreviewMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [showDocInfoMenu, setShowDocInfoMenu] = useState(false);
  const [showReaderMoreMenu, setShowReaderMoreMenu] = useState(false);
  const [visitors, setVisitors] = useState<VisitorDirectoryEntry[]>([]);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionDraft, setPermissionDraft] = useState<DocumentPermissionValue>(
    props.meta.permission as DocumentPermissionValue,
  );
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [existingInvites, setExistingInvites] = useState<Map<string, string>>(new Map());

  const docInfoMenuRef = useRef<HTMLDivElement>(null);
  const readerMoreMenuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  const displayNameRef = useRef(displayName);
  contentRef.current = content;
  displayNameRef.current = displayName;

  /** html 忽略 autoEdit，始终先预览；进入编辑 = 退出预览 */
  const editing = props.canEdit && !previewMode;

  useEffect(() => {
    setContent(props.initialContent);
    setDisplayName(props.initialDisplayName);
    setPreviewMode(true);
  }, [documentId]);

  useEffect(() => {
    if (!props.contentRevision) return;
    setContent(props.initialContent);
    setDisplayName(props.initialDisplayName);
  }, [props.contentRevision]);

  useEffect(() => {
    let mounted = true;
    fetchVisitorsDirectoryApi()
      .then((data) => {
        if (mounted) setVisitors(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void checkBookmarkApi(documentId)
      .then((r) => {
        if (mounted) setIsBookmarked(r.bookmarked);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [documentId]);

  useEffect(() => {
    setPermissionDraft(props.meta.permission as DocumentPermissionValue);
  }, [props.meta.permission, documentId]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (docInfoMenuRef.current && !docInfoMenuRef.current.contains(event.target as Node)) {
        setShowDocInfoMenu(false);
      }
      if (readerMoreMenuRef.current && !readerMoreMenuRef.current.contains(event.target as Node)) {
        setShowReaderMoreMenu(false);
      }
    };
    if (showDocInfoMenu || showReaderMoreMenu) {
      document.addEventListener("mousedown", onDown);
    }
    return () => document.removeEventListener("mousedown", onDown);
  }, [showDocInfoMenu, showReaderMoreMenu]);

  const persistDraft = useCallback(async () => {
    await getDocumentTaskQueue(documentId).execute(() =>
      upsertContentDraft({
        documentId,
        content: contentRef.current,
        displayName: displayNameRef.current,
        contentKind: "html",
        localBaseCommitIdAtEditStart: props.meta.headCommitId ?? null,
        snapshotMeta: {
          permission: props.meta.permission,
          ownerVisitorId: props.meta.ownerVisitorId,
          domainId: props.meta.domainId,
        },
      }),
    );
    setDraftExists(true);
    props.onDraftExistsChange?.(true);
  }, [documentId, props]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persistDraft();
    }, 1000);
  }, [persistDraft]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function publish(permission?: number): Promise<void> {
    if (!props.canEdit) return;
    setBusy(true);
    try {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      await persistDraft();
      await props.onPublish(contentRef.current, displayNameRef.current.trim() || displayName, documentId, permission);
      setDraftExists(false);
      props.onDraftExistsChange?.(false);
    } finally {
      setBusy(false);
    }
  }

  async function saveDisplayNameIfChanged(): Promise<void> {
    if (!props.canEdit) return;
    const prev = props.initialDisplayName.trim();
    const next = displayName.trim();
    if (next === prev) return;
    try {
      await publish();
    } catch {
      /* parent handles conflict */
    }
  }

  async function toggleBookmark(): Promise<void> {
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      if (isBookmarked) {
        await removeBookmarkApi(documentId);
        setIsBookmarked(false);
        props.onShowToast?.(t("bookmarkRemoved"));
      } else {
        await addBookmarkApi(documentId);
        setIsBookmarked(true);
        props.onShowToast?.(t("bookmarkAdded"));
      }
    } finally {
      setBookmarkBusy(false);
    }
  }

  function getVisitorName(visitorId: string): string {
    const v = visitors.find((x) => x.visitorId === visitorId);
    return v?.visitorName ?? visitorId.slice(0, 8);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const currentDomain = useMemo(
    () => props.domains.find((d) => d.domainId === props.meta.domainId),
    [props.domains, props.meta.domainId],
  );

  const allowedPermissions = useMemo<DocumentPermissionValue[]>(() => {
    const domainPermission = currentDomain?.permission ?? "public";
    return allowedPermissionsForDomain(domainPermission);
  }, [currentDomain?.permission]);

  function permissionLabel(permission: DocumentPermissionValue): string {
    if (permission === DocumentPermission.PRIVATE) return t("permissionPrivate");
    if (permission === DocumentPermission.DOMAIN_READ) return t("permissionInvite");
    if (permission === DocumentPermission.DOMAIN_WRITE) return t("permissionDomainWrite");
    if (permission === DocumentPermission.PUBLIC_READ) return t("permissionPublicRead");
    return t("permissionPublicEdit");
  }

  async function savePermission(): Promise<void> {
    if (permissionBusy || permissionDraft === props.meta.permission) {
      setShowPermissionDialog(false);
      return;
    }
    setPermissionBusy(true);
    try {
      await publish(permissionDraft);
      setShowPermissionDialog(false);
    } finally {
      setPermissionBusy(false);
    }
  }

  async function saveInvite(
    result: Array<{ visitorId: string; permission: string }>,
  ): Promise<void> {
    const nextIds = new Set(result.map((r) => r.visitorId));
    for (const [vid] of existingInvites) {
      if (!nextIds.has(vid)) {
        await removeDocumentInviteApi(documentId, vid);
      }
    }
    for (const row of result) {
      const prev = existingInvites.get(row.visitorId);
      if (prev !== row.permission) {
        await addDocumentInviteApi(documentId, row.visitorId, row.permission);
      }
    }
    setShowInvitePicker(false);
  }

  function closeMenus(): void {
    setShowDocInfoMenu(false);
    setShowReaderMoreMenu(false);
  }

  function renderDocInfoMenuPanel(onClose: () => void, options?: { includeBookmark?: boolean }) {
    const includeBookmark = options?.includeBookmark ?? true;
    const menuItemStyle = {
      width: "100%",
      textAlign: "left" as const,
      padding: "8px 16px",
      background: "none",
      border: "none",
      cursor: "pointer",
      fontSize: "13px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    };
    return (
      <>
        <div style={{ padding: "4px 16px", fontSize: "13px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoCreator")}</span>
            <span>{getVisitorName(props.meta.ownerVisitorId)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoCreatedAt")}</span>
            <span>{new Date(props.meta.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoSize")}</span>
            <span>{formatFileSize(new Blob([content]).size)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoUpdatedAt")}</span>
            <span>{new Date(props.meta.updatedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
          </div>
        </div>
        <div style={{ height: "1px", background: "var(--mdocs-border, #e5e5e5)", margin: "8px 0" }} />
        {includeBookmark ? (
          <button
            type="button"
            style={menuItemStyle}
            onClick={() => {
              void toggleBookmark();
              onClose();
            }}
          >
            <span>{isBookmarked ? "⭐" : "☆"}</span>
            <span>{isBookmarked ? t("bookmarkRemove") : t("bookmarkAdd")}</span>
          </button>
        ) : null}
        {props.canManageInvites ? (
          <button
            type="button"
            style={menuItemStyle}
            onClick={() => {
              onClose();
              void (async () => {
                const invites = await getDocumentInvitesApi(documentId);
                setExistingInvites(new Map(invites.map((i) => [i.visitorId, i.permission])));
                setShowInvitePicker(true);
              })();
            }}
          >
            <Users size={14} />
            <span>{t("docInfoInviteMember")}</span>
          </button>
        ) : null}
        <button
          type="button"
          style={menuItemStyle}
          onClick={() => {
            onClose();
            setPermissionDraft(props.meta.permission as DocumentPermissionValue);
            setShowPermissionDialog(true);
          }}
        >
          <ShieldUser size={14} />
          <span>{t("docInfoChangePermission")}</span>
        </button>
      </>
    );
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setContent(val);
      props.onContentChange?.(val);
      scheduleSave();
    },
    [props, scheduleSave],
  );

  const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${content}</body></html>`;

  return (
    <div className={"mdocs-editor" + (props.readerChrome ? " mdocs-editor--reader" : "")}>
      <DocChrome
          fileType="html"
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          onDisplayNameBlur={() => void saveDisplayNameIfChanged()}
          domains={props.domains}
          currentDomainId={props.currentDomainId}
          onDomainChange={props.onDomainChange}
          onDomainsChange={props.onDomainsChange}
          canEdit={props.canEdit}
          editing={editing}
          onEnterEdit={() => setPreviewMode(false)}
          onAiWrite={props.onAiWrite}
          syncBehind={props.syncBehind}
          onSyncClick={props.onSyncClick}
          busy={busy}
          draftExists={draftExists}
          onPublish={() => {
            void publish().catch(() => {});
          }}
          onDelete={() => {
            void props.onDelete();
          }}
          isBookmarked={isBookmarked}
          bookmarkBusy={bookmarkBusy}
          onToggleBookmark={() => void toggleBookmark()}
          onToggleComments={props.onToggleComments}
          commentPanelOpen={props.commentPanelOpen}
          commentCount={props.commentCount}
          docInfoMenu={renderDocInfoMenuPanel(closeMenus)}
          docInfoOpen={showDocInfoMenu}
          onToggleDocInfo={() => setShowDocInfoMenu(!showDocInfoMenu)}
          docInfoMenuRef={docInfoMenuRef}
          readerChrome={props.readerChrome}
          readerHeaderDocked={props.readerChrome}
          onOpenMobileNav={props.onOpenMobileNav}
          readerMoreOpen={showReaderMoreMenu}
          onToggleReaderMore={() => setShowReaderMoreMenu((o) => !o)}
          readerMoreMenuRef={readerMoreMenuRef}
          readerMoreMenu={
            <>
              <button
                type="button"
                className="mdocs-reader-more-item"
                disabled={bookmarkBusy}
                onClick={() => {
                  void toggleBookmark();
                  closeMenus();
                }}
              >
                <Star
                  size={16}
                  strokeWidth={1.5}
                  style={{
                    color: isBookmarked ? "#faad14" : "var(--mdocs-text-secondary, #6b7280)",
                    fill: isBookmarked ? "#faad14" : "none",
                  }}
                />
                <span>{isBookmarked ? t("bookmarkRemove") : t("bookmarkAdd")}</span>
              </button>
              <div className="mdocs-reader-more-divider" />
              {/* 手机端预览/编辑切换 */}
              <button
                type="button"
                className="mdocs-reader-more-item"
                disabled={!previewMode}
                onClick={() => { setPreviewMode(false); closeMenus(); }}
              >
                {t("edit")}
              </button>
              <button
                type="button"
                className="mdocs-reader-more-item"
                disabled={previewMode}
                onClick={() => { setPreviewMode(true); closeMenus(); }}
              >
                {t("preview")}
              </button>
              <div className="mdocs-reader-more-divider" />
              {props.canEdit ? (
                <button
                  type="button"
                  className="mdocs-reader-more-item mdocs-reader-more-item--danger"
                  disabled={busy}
                  onClick={() => {
                    closeMenus();
                    void props.onDelete();
                  }}
                >
                  <span>{t("delete")}</span>
                </button>
              ) : null}
              <div className="mdocs-reader-more-divider" />
              {renderDocInfoMenuPanel(closeMenus, { includeBookmark: false })}
            </>
          }
          leadingExtra={
            props.canEdit && !props.readerChrome ? (
              <label className="mdocs-editor-mode-toggle" aria-label={previewMode ? t("preview") : t("edit")}>
                <input
                  type="checkbox"
                  checked={previewMode}
                  onChange={() => setPreviewMode((p) => !p)}
                />
                <span className="mdocs-editor-mode-toggle-slider">
                  <span className="mdocs-editor-mode-toggle-label mdocs-editor-mode-toggle-label--left">{t("edit")}</span>
                  <span className="mdocs-editor-mode-toggle-label mdocs-editor-mode-toggle-label--right">{t("preview")}</span>
                </span>
              </label>
            ) : null
          }
        />

        <div className="mdocs-html-editor-body">
          {!previewMode && props.canEdit ? (
            <textarea
              className="mdocs-html-editor-textarea"
              value={content}
              onChange={handleChange}
              spellCheck={false}
              placeholder="在此处编写 HTML 代码"
            />
          ) : null}
          <div
            className="mdocs-html-editor-preview"
            style={!previewMode && props.canEdit ? { width: "50%" } : { width: "100%" }}
          >
            <iframe
              className="mdocs-html-editor-iframe"
              srcDoc={previewHtml}
              sandbox=""
              title={displayName}
            />
          </div>
        </div>

      {showPermissionDialog && (
        <div
          className="mdocs-dialog-backdrop"
          style={{ position: "fixed", zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPermissionDialog(false);
          }}
        >
          <div className="mdocs-dialog card" style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: "1.1rem", marginBottom: 12 }}>{t("docInfoChangePermission")}</h1>
            <div className="muted" style={{ marginBottom: 12 }}>
              {t("domainPermission")}：
              {currentDomain
                ? localizeDomainName(currentDomain.domainName, lang, t)
                : props.meta.domainId}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {allowedPermissions.map((permission) => (
                <label
                  key={permission}
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name="html-doc-permission"
                    value={permission}
                    checked={permissionDraft === permission}
                    onChange={() => setPermissionDraft(permission)}
                  />
                  <span>{permissionLabel(permission)}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowPermissionDialog(false)}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={permissionBusy}
                onClick={() => void savePermission()}
              >
                {permissionBusy ? t("publishing") : t("saveAndPublish")}
              </button>
            </div>
          </div>
        </div>
      )}

      {props.canManageInvites && (
        <VisitorPickerModal
          open={showInvitePicker}
          title={t("docInfoInviteMember")}
          initialSelectedIds={[...existingInvites.keys()]}
          initialPermissions={existingInvites}
          templates={[]}
          showPermissionSelect={true}
          permissionOptions={[
            { value: "read", label: t("invitePermissionRead") },
            { value: "edit", label: t("invitePermissionEdit") },
          ]}
          onClose={() => setShowInvitePicker(false)}
          onConfirm={(result) => {
            void saveInvite(result as Array<{ visitorId: string; permission: string }>);
          }}
        />
      )}
    </div>
  );
}
