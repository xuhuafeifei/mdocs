import { useMemo } from "react";
import { useI18n } from "../i18n";
import type { VisitorDirectoryEntry } from "../../shared/types/visitor";

/** 取 UUID 前 6 位用于简短展示 */
function idPrefix6(id: string): string {
  if (id.length <= 6) return id;
  return `${id.slice(0, 6)}…`;
}

export interface SelectedDisplayRow {
  visitorId: string;
  name: string;
  muted: boolean;
}

export interface VisitorPickerContentProps {
  visitors: VisitorDirectoryEntry[];
  loadState: "idle" | "loading" | "ok" | "err";
  searchFilter: string;
  onSearchChange: (value: string) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  selectedRows: SelectedDisplayRow[];
  lockedIds?: Set<string>;
  /** 当前登录的访客 ID，传入后在左列置顶 + 绿色 (你) 标记 */
  myVisitorId?: string | null;
}

/**
 * 访客选择器内容组件 — 搜索栏 + 左右双栏表格（全部访客 / 已选成员）
 *
 * 被 VisitorPickerModal（域管理弹窗）和 MemberTemplatesPanel 第 2 步共享。
 * 不包含外层容器（弹窗 overlay/dialog、wizard 卡片等），仅渲染表格内容。
 */
export function VisitorPickerContent(props: VisitorPickerContentProps) {
  const {
    visitors,
    loadState,
    searchFilter,
    onSearchChange,
    selectedIds,
    onToggle,
    selectedRows,
    lockedIds = new Set(),
    myVisitorId,
  } = props;
  const { t } = useI18n();

  const filteredLeft = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    let result = !q
      ? visitors
      : visitors.filter(
          (v) => v.visitorName.toLowerCase().includes(q) || v.visitorId.toLowerCase().includes(q),
        );
    /* 自己置顶 */
    if (myVisitorId) {
      result = [...result].sort((a, b) => {
        if (a.visitorId === myVisitorId) return -1;
        if (b.visitorId === myVisitorId) return 1;
        return 0;
      });
    }
    return result;
  }, [visitors, searchFilter, myVisitorId]);

  return (
    <>
      <input
        type="search"
        className="mdocs-visitor-picker-search"
        placeholder={t("visitorPickerSearchPlaceholder")}
        value={searchFilter}
        onChange={(e) => onSearchChange(e.target.value)}
        disabled={loadState !== "ok"}
      />

      {loadState === "loading" && <div className="mdocs-visitor-picker-loading">{t("loading")}</div>}
      {loadState === "err" && <div className="mdocs-visitor-picker-error">{t("visitorPickerLoadError")}</div>}

      {loadState === "ok" && (
        <div className="mdocs-visitor-picker-columns">
          {/* 左侧：全部访客，表格式勾选 */}
          <div className="mdocs-visitor-picker-col">
            <h3 className="mdocs-visitor-picker-col-title">{t("visitorPickerColumnAll")}</h3>
            <div className="mdocs-visitor-picker-table-wrap">
              <table className="mdocs-visitor-picker-table">
                <thead>
                  <tr>
                    <th scope="col">{t("visitorPickerColIdShort")}</th>
                    <th scope="col">{t("visitorPickerColName")}</th>
                    <th scope="col" className="mdocs-visitor-picker-check-col">{t("visitorPickerColPick")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeft.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="mdocs-visitor-picker-empty-cell">
                        {visitors.length === 0 ? t("visitorPickerEmptyDirectory") : t("domainNoMatch")}
                      </td>
                    </tr>
                  ) : (
                    filteredLeft.map((v) => {
                      const isLocked = lockedIds.has(v.visitorId);
                      const checked = selectedIds.has(v.visitorId);
                      return (
                        <tr key={v.visitorId}>
                          <td><code className="mdocs-visitor-picker-id-short">{idPrefix6(v.visitorId)}</code></td>
                          <td>
                            {v.visitorName}
                            {v.visitorId === myVisitorId && (
                              <span className="mdocs-visitor-picker-self-marker">{t("visitorPickerSelfMarker")}</span>
                            )}
                          </td>
                          <td className="mdocs-visitor-picker-check-col">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isLocked}
                              onChange={() => onToggle(v.visitorId)}
                              aria-label={v.visitorName}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 右侧：已选成员，表格式展示 */}
          <div className="mdocs-visitor-picker-col">
            <h3 className="mdocs-visitor-picker-col-title">{t("visitorPickerColumnSelected")}</h3>
            <div className="mdocs-visitor-picker-table-wrap">
              <table className="mdocs-visitor-picker-table">
                <thead>
                  <tr>
                    <th scope="col">{t("visitorPickerColIdFull")}</th>
                    <th scope="col">{t("visitorPickerColName")}</th>
                    <th scope="col" className="mdocs-visitor-picker-check-col" />
                  </tr>
                </thead>
                <tbody>
                  {selectedRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="mdocs-visitor-picker-empty-cell">
                        {t("visitorPickerNoSelection")}
                      </td>
                    </tr>
                  ) : (
                    selectedRows.map((row) => {
                      const isLocked = lockedIds.has(row.visitorId);
                      return (
                        <tr key={row.visitorId}>
                          <td><code className="mdocs-visitor-picker-id-full">{row.visitorId}</code></td>
                          <td className={row.muted ? "mdocs-visitor-picker-name-muted" : undefined}>{row.name}</td>
                          <td className="mdocs-visitor-picker-check-col">
                            {isLocked ? (
                              <span className="mdocs-visitor-picker-locked" title={t("visitorPickerLockedHint")}>—</span>
                            ) : (
                              <button
                                type="button"
                                className="mdocs-visitor-picker-remove"
                                onClick={() => onToggle(row.visitorId)}
                                aria-label={t("visitorPickerRemove")}
                              >×</button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
