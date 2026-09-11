/**
 * DocChrome — 文档顶栏（桌面 + 窄屏 reader），与正文编辑器无关。
 *
 * 帮写 / 评论显隐读 file-type-policy（aiWrite / comments）。
 */
import type { CSSProperties, ReactNode, RefObject } from "react";
import { EllipsisVertical, MessageSquare, PanelLeftOpen, RefreshCw, Star, TextAlignJustify } from "lucide-react";
import { useI18n } from "../i18n";
import { localizeDomainName } from "./utils";
import deepseekLogoUrl from "../assets/deepseek.svg";
import { DomainSelect } from "./DomainSelect";
import { FALLBACK_DOMAIN_SUMMARY } from "../services/domainsBootstrap";
import type { DomainSummary } from "../../shared/types/domain";
import { getPolicy } from "../../shared/file-type-policy";
import type { FileType } from "../../shared/file-types";

export interface DocChromeProps {
  fileType: string;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  onDisplayNameBlur: () => void;
  domains: DomainSummary[];
  currentDomainId: string;
  onDomainChange: (domainId: string) => void;
  onDomainsChange?: (domains: DomainSummary[]) => void;
  canEdit: boolean;
  editing: boolean;
  onEnterEdit?: () => void;
  onAiWrite?: () => void;
  syncBehind?: boolean;
  onSyncClick?: () => void;
  busy?: boolean;
  draftExists?: boolean;
  onPublish?: () => void;
  onDelete?: () => void;
  isBookmarked?: boolean;
  bookmarkBusy?: boolean;
  onToggleBookmark?: () => void;
  onToggleComments?: () => void;
  commentPanelOpen?: boolean;
  commentCount?: number;
  docInfoMenu?: ReactNode;
  docInfoOpen?: boolean;
  onToggleDocInfo?: () => void;
  docInfoMenuRef?: RefObject<HTMLDivElement | null>;
  leadingExtra?: ReactNode;
  trailingExtra?: ReactNode;
  /** 窄屏 reader：更多菜单内容（收藏/删除/文档信息等） */
  readerMoreMenu?: ReactNode;
  readerMoreOpen?: boolean;
  onToggleReaderMore?: () => void;
  readerMoreMenuRef?: RefObject<HTMLDivElement | null>;
  readerChrome?: boolean;
  onOpenMobileNav?: () => void;
  readerHeaderDocked?: boolean;
  readerDragOffset?: number;
  onReaderHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onReaderHeaderPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onReaderHeaderPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function DocChrome(props: DocChromeProps) {
  const { t, lang } = useI18n();
  const policy = getPolicy((props.fileType || "md") as FileType);
  const showAiWrite = Boolean(policy?.aiWrite && props.onAiWrite);
  const showComments = Boolean(policy?.comments && props.onToggleComments);

  const domains = props.domains.length ? props.domains : [FALLBACK_DOMAIN_SUMMARY];

  const toolbarClass =
    "mdocs-editor-toolbar" +
    (props.readerChrome
      ? props.readerHeaderDocked
        ? " mdocs-editor-toolbar--docked"
        : " mdocs-editor-toolbar--float"
      : "");

  const toolbarStyle: CSSProperties | undefined =
    props.readerChrome && !props.readerHeaderDocked && props.readerDragOffset
      ? { transform: `translateY(${props.readerDragOffset}px)` }
      : undefined;

  if (props.readerChrome) {
    return (
      <div className={toolbarClass} style={toolbarStyle}>
        <div
          className="mdocs-editor-toolbar-leading"
          onPointerDown={props.onReaderHeaderPointerDown}
          onPointerMove={props.onReaderHeaderPointerMove}
          onPointerUp={props.onReaderHeaderPointerUp}
          onPointerCancel={props.onReaderHeaderPointerUp}
        >
          <button
            type="button"
            className="mdocs-reader-nav-btn"
            onClick={() => props.onOpenMobileNav?.()}
            aria-label={t("expandSidebar")}
          >
            <PanelLeftOpen size={18} strokeWidth={1.75} />
          </button>
          <input
            className="mdocs-editor-title-input"
            value={props.displayName}
            onChange={(e) => props.onDisplayNameChange(e.target.value)}
            onBlur={props.onDisplayNameBlur}
            placeholder={t("displayNamePlaceholder")}
            disabled={!props.editing}
            readOnly={!props.editing}
          />
        </div>
        <DomainSelect
          domains={domains}
          value={props.currentDomainId}
          onChange={props.onDomainChange}
          onDomainsChange={props.onDomainsChange}
          ariaLabel={t("currentDomainAria")}
          localizeName={(name: string) => localizeDomainName(name, lang, t)}
        />
        {props.canEdit && props.onPublish ? (
          <button
            type="button"
            className="primary mdocs-reader-action-btn"
            disabled={props.busy}
            onClick={() => {
              if (!props.editing) props.onEnterEdit?.();
              props.onPublish?.();
            }}
          >
            {props.busy ? t("publishing") : t("publish")}
          </button>
        ) : null}
        {props.readerMoreMenu != null ? (
          <div ref={props.readerMoreMenuRef} className="mdocs-reader-more-menu">
            <button
              type="button"
              className="mdocs-reader-more-btn"
              aria-label="更多"
              aria-expanded={props.readerMoreOpen}
              onClick={() => props.onToggleReaderMore?.()}
            >
              <EllipsisVertical size={18} strokeWidth={1.75} />
            </button>
            {props.readerMoreOpen ? (
              <div className="mdocs-reader-more-dropdown card">{props.readerMoreMenu}</div>
            ) : null}
          </div>
        ) : null}
        {props.trailingExtra}
      </div>
    );
  }

  return (
    <div className={toolbarClass} style={toolbarStyle}>
      <div className="mdocs-editor-toolbar-leading">
        <input
          className="mdocs-editor-title-input"
          value={props.displayName}
          onChange={(e) => props.onDisplayNameChange(e.target.value)}
          onBlur={props.onDisplayNameBlur}
          placeholder={t("displayNamePlaceholder")}
          disabled={!props.editing}
        />
        <DomainSelect
          domains={domains}
          value={props.currentDomainId}
          onChange={props.onDomainChange}
          onDomainsChange={props.onDomainsChange}
          ariaLabel={t("currentDomainAria")}
          localizeName={(name: string) => localizeDomainName(name, lang, t)}
        />
        {showAiWrite ? (
          <button
            type="button"
            className="secondary"
            onClick={() => props.onAiWrite?.()}
            style={{
              padding: "4px 10px",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <img src={deepseekLogoUrl} alt="" width={16} height={16} style={{ display: "block" }} />
            帮写
          </button>
        ) : null}
        {props.leadingExtra}
      </div>
      <span className="mdocs-editor-toolbar-spacer" aria-hidden />
      <div className="mdocs-editor-toolbar-trailing">
        {props.onToggleBookmark ? (
          <button
            type="button"
            className="secondary mdocs-tooltip mdocs-tooltip-bottom"
            onClick={() => props.onToggleBookmark?.()}
            disabled={props.bookmarkBusy}
            data-tooltip={props.isBookmarked ? "取消收藏" : "收藏"}
            style={{
              padding: "4px 8px",
              minWidth: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              opacity: props.bookmarkBusy ? 0.5 : 1,
            }}
          >
            <Star
              size={18}
              strokeWidth={1.5}
              style={{
                color: props.isBookmarked ? "#faad14" : "var(--mdocs-text-secondary, #6b7280)",
                fill: props.isBookmarked ? "#faad14" : "none",
              }}
            />
            {props.isBookmarked ? <span>已收藏</span> : null}
          </button>
        ) : null}
        <div className="mdocs-editor-toolbar-actions">
          {props.onSyncClick ? (
            <button
              type="button"
              className={
                "mdocs-sync-btn mdocs-tooltip mdocs-tooltip-bottom" +
                (props.syncBehind ? " behind" : "")
              }
              data-tooltip={props.syncBehind ? t("syncBehindHint") : t("syncPull")}
              onClick={() => void props.onSyncClick?.()}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <RefreshCw size={16} strokeWidth={1.5} />
              <span>{t("syncPull")}</span>
            </button>
          ) : null}
          {props.editing ? (
            <>
              {localStorage.getItem("mdocs.autoPublish") !== "true" && (
                <span className="mdocs-save-indicator">
                  <span
                    className={
                      "mdocs-save-dot " +
                      (props.busy ? "saving" : props.draftExists ? "unsaved" : "saved")
                    }
                  />
                  <span>
                    {props.busy ? t("publishing") : props.draftExists ? t("unsaved") : t("published")}
                  </span>
                </span>
              )}
              {props.onPublish ? (
                <button
                  type="button"
                  className="primary"
                  disabled={props.busy}
                  onClick={() => props.onPublish?.()}
                >
                  {props.busy ? t("publishing") : t("publish")}
                </button>
              ) : null}
              {props.onDelete ? (
                <button
                  type="button"
                  className="danger"
                  disabled={props.busy}
                  onClick={() => props.onDelete?.()}
                >
                  {t("delete")}
                </button>
              ) : null}
            </>
          ) : null}
          {!props.editing && props.canEdit && props.onEnterEdit ? (
            <button type="button" className="primary" onClick={() => props.onEnterEdit?.()}>
              {t("edit")}
            </button>
          ) : null}
          {props.trailingExtra}
          {showComments ? (
            <button
              type="button"
              className="secondary mdocs-tooltip mdocs-tooltip-bottom"
              onClick={() => props.onToggleComments?.()}
              data-tooltip="评论"
              style={{
                padding: "4px 8px",
                minWidth: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                background: props.commentPanelOpen
                  ? "var(--mdocs-hover-bg, #f0f0f0)"
                  : undefined,
              }}
            >
              <MessageSquare
                size={18}
                strokeWidth={1.5}
                style={{ color: "var(--mdocs-text-secondary, #6b7280)" }}
              />
              {props.commentCount && props.commentCount > 0 ? (
                <span style={{ fontSize: "0.85rem" }}>{props.commentCount}</span>
              ) : null}
            </button>
          ) : null}
          {props.onToggleDocInfo ? (
            <div
              ref={props.docInfoMenuRef}
              className="mdocs-tooltip mdocs-tooltip-bottom"
              data-tooltip={t("docInfo")}
              style={{ position: "relative" }}
            >
              <button
                type="button"
                className="secondary"
                onClick={() => props.onToggleDocInfo?.()}
                style={{
                  padding: "4px 8px",
                  minWidth: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TextAlignJustify
                  size={18}
                  strokeWidth={1.5}
                  style={{ color: "var(--mdocs-text-secondary, #6b7280)" }}
                />
              </button>
              {props.docInfoOpen ? (
                <div className="mdocs-doc-info-dropdown">{props.docInfoMenu}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
