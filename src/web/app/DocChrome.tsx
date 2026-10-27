/**
 * DocChrome — 文档顶栏（桌面 + 窄屏 reader），与正文编辑器无关。
 *
 * 帮写 / 评论显隐读 file-type-policy（aiWrite / comments）。
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ChevronUp, EllipsisVertical, MessageSquare, PanelLeftOpen, RefreshCw, Star, TextAlignJustify } from "lucide-react";
import { useI18n } from "../i18n";
import { localizeDomainName } from "./utils";
import deepseekLogoUrl from "../assets/deepseek.svg";
import { DomainSelect } from "./DomainSelect";
import { FALLBACK_DOMAIN_SUMMARY } from "../services/domainsBootstrap";
import type { DomainSummary } from "../../shared/types/domain";
import { getPolicy } from "../../shared/file-type-policy";
import type { FileType } from "../../shared/file-types";
import { isPublishHotkey, publishHotkeyLabel } from "./publishHotkey";

/** 顶栏横向滚动会裁切 CSS ::before tooltip，改 portal 到 body */
function ChromeTip(props: { text: string; children: ReactElement }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  return (
    <span
      className="mdocs-chrome-tip-anchor"
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ left: r.left + r.width / 2, top: r.bottom + 8 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {props.children}
      {pos
        ? createPortal(
            <span
              className="mdocs-chrome-tip"
              style={{ left: pos.left, top: pos.top }}
              role="tooltip"
            >
              {props.text}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

/** 文档信息下拉：scrollport 会裁 absolute 菜单，portal + fixed */
function ChromeDocInfoMenu(props: {
  open: boolean;
  onToggle: () => void;
  menu: ReactNode;
  menuRef?: RefObject<HTMLDivElement | null>;
  tip: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!props.open) {
      setPos(null);
      return;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    };
    update();
    window.addEventListener("resize", update);
    // 顶栏横向滚 / 页面滚都会挪按钮
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      props.onToggle();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [props.open, props.onToggle]);

  return (
    <div ref={anchorRef} style={{ position: "relative" }}>
      <ChromeTip text={props.tip}>
        <button
          type="button"
          className="secondary"
          onClick={() => props.onToggle()}
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
      </ChromeTip>
      {props.open && pos
        ? createPortal(
            <div
              ref={(node) => {
                dropdownRef.current = node;
                if (props.menuRef) {
                  (props.menuRef as { current: HTMLDivElement | null }).current = node;
                }
              }}
              className="mdocs-doc-info-dropdown mdocs-doc-info-dropdown--portal"
              style={{ top: pos.top, right: pos.right }}
            >
              {props.menu}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

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
  /**
   * html：发布/删除不跟预览开关走；也不再显示顶栏「进入编辑」。
   * md 保持「先进入编辑才出现发布/删除」。
   */
  actionsAlwaysVisible?: boolean;
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
  /**
   * 窄屏 reader：把「域选择 / leadingExtra / 发布」收进可折叠的第二行。
   * 仅 html 用（正文区另有预览·编辑切换，横向更挤）；
   * md 不传 → 这些操作**常驻**顶栏，不折叠。
   */
  readerActionsCollapsible?: boolean;
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
  const showDocActions =
    props.canEdit && (props.editing || Boolean(props.actionsAlwaysVisible));
  const titleLocked = !showDocActions;
  const [readerActionsOpen, setReaderActionsOpen] = useState(false);

  const domains = props.domains.length ? props.domains : [FALLBACK_DOMAIN_SUMMARY];

  /** 桌面端发布快捷键；窄屏 reader 不绑定 */
  const canPublishHotkey =
    !props.readerChrome &&
    Boolean(props.onPublish) &&
    showDocActions &&
    !props.busy;

  useEffect(() => {
    if (!canPublishHotkey) return;
    // capture：先于 Lexical/contenteditable，避免 ⌘/Alt+Enter 被当成软换行
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPublishHotkey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      props.onPublish?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [canPublishHotkey, props.onPublish]);

  const publishTooltip = !props.readerChrome
    ? t("publishHotkeyHint", { hotkey: publishHotkeyLabel() })
    : t("publish");

  const saveStatus = (
    <span className="mdocs-save-indicator" aria-live="polite">
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
  );

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
    /** 汉堡在拖动手势外，避免 touch-action:none 吞掉开目录点击 / 左缘滑动 */
    const leading = (
      <div className="mdocs-editor-toolbar-leading-wrap">
        <button
          type="button"
          className="mdocs-reader-nav-btn"
          onClick={() => props.onOpenMobileNav?.()}
          aria-label={t("expandSidebar")}
        >
          <PanelLeftOpen size={18} strokeWidth={1.75} />
        </button>
        <div
          className="mdocs-editor-toolbar-leading"
          onPointerDown={props.onReaderHeaderPointerDown}
          onPointerMove={props.onReaderHeaderPointerMove}
          onPointerUp={props.onReaderHeaderPointerUp}
          onPointerCancel={props.onReaderHeaderPointerUp}
        >
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
      </div>
    );

    const domainSelect = (
      <DomainSelect
        domains={domains}
        value={props.currentDomainId}
        onChange={props.onDomainChange}
        onDomainsChange={props.onDomainsChange}
        ariaLabel={t("currentDomainAria")}
        localizeName={(name: string) => localizeDomainName(name, lang, t)}
      />
    );

    const publishBtn =
      props.canEdit && props.onPublish ? (
        <button
          type="button"
          className="primary mdocs-reader-action-btn"
          disabled={props.busy}
          // 避免按钮获焦后 disabled 时焦点弹回编辑器，触发光标滚入视野
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!props.editing) props.onEnterEdit?.();
            props.onPublish?.();
          }}
        >
          {props.busy ? t("publishing") : t("publish")}
        </button>
      ) : null;

    const syncBtn = props.onSyncClick ? (
      <button
        type="button"
        className={
          "mdocs-sync-btn mdocs-reader-sync-btn" + (props.syncBehind ? " behind" : "")
        }
        aria-label={props.syncBehind ? t("syncBehindHint") : t("syncPull")}
        onClick={() => void props.onSyncClick?.()}
      >
        <RefreshCw size={16} strokeWidth={1.75} />
      </button>
    ) : null;

    const moreMenu =
      props.readerMoreMenu != null ? (
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
      ) : null;

    // md：域 / 发布**常驻**顶栏，单行（与桌面一致，不折叠）
    if (!props.readerActionsCollapsible) {
      return (
        <div className={toolbarClass} style={toolbarStyle}>
          {leading}
          {domainSelect}
          {props.leadingExtra}
          {syncBtn}
          {publishBtn}
          {moreMenu}
          {props.trailingExtra}
        </div>
      );
    }

    // html：正文区另有预览·编辑切换，横向更挤 → 操作收进可折叠第二行
    return (
      <div className={toolbarClass + " mdocs-editor-toolbar--stacked"} style={toolbarStyle}>
        <div className="mdocs-reader-top-row">
          {leading}
          {syncBtn}
          <button
            type="button"
            className="mdocs-reader-expand-btn"
            onClick={() => setReaderActionsOpen((o) => !o)}
            aria-label={readerActionsOpen ? "收起操作栏" : "展开操作栏"}
          >
            <ChevronUp
              size={16}
              strokeWidth={2}
              style={{
                transform: readerActionsOpen ? "rotate(0deg)" : "rotate(180deg)",
                transition: "transform 0.2s",
              }}
            />
          </button>
          {moreMenu}
        </div>
        {readerActionsOpen && (
          <div className="mdocs-reader-actions-row">
            {domainSelect}
            {props.leadingExtra}
            {publishBtn}
            {props.trailingExtra}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mdocs-editor-header-wrap">
      {/* 分屏时 CSS 把它当成顶缘热区；非分屏 display:none */}
      <div className="mdocs-editor-header-hotzone" aria-hidden />
      <div className="mdocs-editor-header-scroll">
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
            <ChromeTip text={props.isBookmarked ? "取消收藏" : "收藏"}>
              <button
                type="button"
                className="ghost"
                onClick={() => props.onToggleBookmark?.()}
                disabled={props.bookmarkBusy}
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
            </ChromeTip>
          ) : null}
          <div className="mdocs-editor-toolbar-actions">
            {props.onSyncClick ? (
              <ChromeTip text={props.syncBehind ? t("syncBehindHint") : t("syncPull")}>
                <button
                  type="button"
                  className={"mdocs-sync-btn" + (props.syncBehind ? " behind" : "")}
                  onClick={() => void props.onSyncClick?.()}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <RefreshCw size={16} strokeWidth={1.5} />
                  <span>{t("syncPull")}</span>
                </button>
              </ChromeTip>
            ) : null}
            {showDocActions ? (
              <>
                {saveStatus}
                {props.onPublish ? (
                  <ChromeTip text={publishTooltip}>
                    <button
                      type="button"
                      className="primary"
                      disabled={props.busy}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => props.onPublish?.()}
                    >
                      {props.busy ? t("publishing") : t("publish")}
                    </button>
                  </ChromeTip>
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
            {!props.editing && props.canEdit && props.onEnterEdit && !props.actionsAlwaysVisible ? (
              <button type="button" className="primary" onClick={() => props.onEnterEdit?.()}>
                {t("edit")}
              </button>
            ) : null}
            {props.trailingExtra}
            {showComments ? (
              <ChromeTip text="评论">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => props.onToggleComments?.()}
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
              </ChromeTip>
            ) : null}
            {props.onToggleDocInfo ? (
              <ChromeDocInfoMenu
                open={Boolean(props.docInfoOpen)}
                onToggle={() => props.onToggleDocInfo?.()}
                menu={props.docInfoMenu}
                menuRef={props.docInfoMenuRef}
                tip={t("docInfo")}
              />
            ) : null}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
