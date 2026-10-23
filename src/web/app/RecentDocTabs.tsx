/**
 * PC 最近打开标签：右侧固定「大纲 · Lobe · 钉子」。
 * 钉子开：常驻占流；关：吸附条，悬停以覆盖方式展开。
 * 大纲 / Lobe 仅 md 栏传入对应回调时显示。
 */
import { useState, type MouseEvent } from "react";
import { Code2, FileText, List, Pin, PinOff, Table, Type } from "lucide-react";
import { useI18n } from "../i18n";
import { FILE_TYPE } from "../../shared/file-types";
import type { RecentDocTab } from "../storage/recentDocTabs";

export type RecentDocTabsProps = {
  tabs: RecentDocTab[];
  activeDocumentId: string | null;
  /** 标签栏是否钉住常驻；默认由外层偏好控制 */
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  onSelect: (tab: RecentDocTab) => void;
  onClose: (documentId: string) => void;
  /** md：大纲（须在 OutlineProvider 内由外层传入受控值） */
  outlineVisible?: boolean;
  onOutlineToggle?: () => void;
  /** md：Lobe 格式工具栏 */
  lobeToolbarVisible?: boolean;
  onLobeToolbarVisibleChange?: (visible: boolean) => void;
};

function TabTypeIcon({ fileType }: { fileType: string }) {
  const size = 14;
  const stroke = 1.9;
  if (fileType === FILE_TYPE.HTML) return <Code2 size={size} strokeWidth={stroke} />;
  if (fileType === FILE_TYPE.SHEET) return <Table size={size} strokeWidth={stroke} />;
  return <FileText size={size} strokeWidth={stroke} />;
}

export function RecentDocTabs(props: RecentDocTabsProps) {
  const { t } = useI18n();
  const {
    tabs,
    activeDocumentId,
    pinned,
    onPinnedChange,
    onSelect,
    onClose,
    outlineVisible,
    onOutlineToggle,
    lobeToolbarVisible,
    onLobeToolbarVisibleChange,
  } = props;
  /** 刚取消钉住时鼠标仍在条上，压住 :hover 展开直到 mouseleave */
  const [holdCollapse, setHoldCollapse] = useState(false);

  if (tabs.length === 0) return null;

  const showOutline = typeof onOutlineToggle === "function";
  const showLobe = typeof onLobeToolbarVisibleChange === "function";
  const outlineTip = outlineVisible ? t("outlineHide") : t("outlineShow");
  const lobeTip = lobeToolbarVisible ? t("recentTabsLobeHide") : t("recentTabsLobeShow");
  const pinTip = pinned ? t("recentTabsUnpin") : t("recentTabsPin");

  function handlePinClick(e: MouseEvent<HTMLButtonElement>): void {
    const next = !pinned;
    if (!next) {
      setHoldCollapse(true);
      e.currentTarget.blur();
    } else {
      setHoldCollapse(false);
    }
    onPinnedChange(next);
  }

  return (
    <div
      className={
        "mdocs-recent-tabs" +
        (pinned ? " is-pinned" : " is-unpinned") +
        (holdCollapse ? " is-hold-collapse" : "")
      }
      data-testid="recent-doc-tabs"
      onMouseLeave={() => {
        if (holdCollapse) setHoldCollapse(false);
      }}
    >
      {!pinned ? <div className="mdocs-recent-tabs-hotzone" aria-hidden /> : null}
      <div className="mdocs-recent-tabs-bar" role="tablist" aria-label={t("recentTabsLabel")}>
        <div className="mdocs-recent-tabs-list">
          {tabs.map((tab) => {
            const active = tab.documentId === activeDocumentId;
            return (
              <div
                key={tab.documentId}
                className={"mdocs-recent-tab" + (active ? " is-active" : "")}
                role="tab"
                aria-selected={active}
              >
                <button
                  type="button"
                  className="mdocs-recent-tab-main"
                  title={tab.displayName || t("untitledPlaceholder")}
                  onClick={() => onSelect(tab)}
                >
                  <span className="mdocs-recent-tab-icon" aria-hidden>
                    <TabTypeIcon fileType={tab.fileType} />
                  </span>
                  <span className="mdocs-recent-tab-title">
                    {tab.displayName || t("untitledPlaceholder")}
                  </span>
                </button>
                <button
                  type="button"
                  className="mdocs-recent-tab-close"
                  aria-label={t("recentTabsClose")}
                  title={t("recentTabsClose")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.documentId);
                  }}
                >
                  <span className="mdocs-recent-tab-close-x" aria-hidden>
                    ×
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="mdocs-recent-tabs-actions">
          {showOutline ? (
            <button
              type="button"
              className={
                "mdocs-recent-tabs-action mdocs-tooltip mdocs-tooltip-bottom" +
                (outlineVisible ? " is-on" : "")
              }
              aria-pressed={Boolean(outlineVisible)}
              aria-label={outlineTip}
              data-tooltip={outlineTip}
              onClick={() => onOutlineToggle?.()}
            >
              <List size={16} strokeWidth={2.25} aria-hidden />
            </button>
          ) : null}
          {showLobe ? (
            <button
              type="button"
              className={
                "mdocs-recent-tabs-action mdocs-tooltip mdocs-tooltip-bottom" +
                (lobeToolbarVisible ? " is-on" : "")
              }
              aria-pressed={Boolean(lobeToolbarVisible)}
              aria-label={lobeTip}
              data-tooltip={lobeTip}
              onClick={() => onLobeToolbarVisibleChange?.(!lobeToolbarVisible)}
            >
              <Type size={16} strokeWidth={2.25} aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className={
              "mdocs-recent-tabs-action mdocs-tooltip mdocs-tooltip-bottom" +
              (pinned ? " is-on" : "")
            }
            aria-pressed={pinned}
            aria-label={pinTip}
            data-tooltip={pinTip}
              onClick={handlePinClick}
            >
              {pinned ? (
                <Pin size={16} strokeWidth={2.25} aria-hidden />
              ) : (
                <PinOff size={16} strokeWidth={2.25} aria-hidden />
              )}
            </button>
        </div>
      </div>
    </div>
  );
}
