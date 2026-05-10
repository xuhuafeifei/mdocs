/**
 * 访客选择器内容组件
 * 被 VisitorPickerModal 和 MemberTemplatesPanel 共享。
 * 提供搜索栏 + 左右双栏表格（全部访客 / 已选成员），不包含外层容器。
 * 当前登录访客在左栏置顶并标记「(你)」。
 */
import { useMemo } from "react";
import { useI18n } from "../i18n";
import type { VisitorDirectoryEntry } from "../../shared/types/visitor";
import { MiniSelect } from "./MiniSelect";
import type { MiniSelectOption } from "./MiniSelect";

/** 取 UUID 前 6 位用于简短展示 */
function idPrefix6(id: string): string {
  if (id.length <= 6) return id;
  return `${id.slice(0, 6)}…`;
}

export interface SelectedDisplayRow {
  visitorId: string;
  name: string;
  muted: boolean;
  permission?: string;
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
  /** 是否显示权限选择下拉（文档邀请时使用） */
  showPermissionSelect?: boolean;
  /** 权限选项，如 [{ value: 'read', label: '只读' }, { value: 'edit', label: '可编辑' }] */
  permissionOptions?: { value: string; label: string }[];
  /** 权限变更回调 */
  onPermissionChange?: (visitorId: string, permission: string) => void;
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
    showPermissionSelect = false,
    permissionOptions = [],
    onPermissionChange,
  } = props;
  const { t } = useI18n();

  /**
   * 左侧访客列表：按搜索词过滤，并把当前登录访客置顶。
   */
  const filteredLeft = useMemo(() => {
    // 去除首尾空格并转为小写，用于不区分大小写的搜索
    const q = searchFilter.trim().toLowerCase();
    // 如果没有搜索词，显示全部访客；否则按昵称或 ID 过滤
    let result = !q
      ? visitors
      : visitors.filter(
          (v) => v.visitorName.toLowerCase().includes(q) || v.visitorId.toLowerCase().includes(q),
        );
    /* 自己置顶 */
    if (myVisitorId) {
      result = [...result].sort((a, b) => {
        // 当前登录访客排最前面
        if (a.visitorId === myVisitorId) return -1;
        if (b.visitorId === myVisitorId) return 1;
        return 0;
      });
    }
    return result;
  }, [visitors, searchFilter, myVisitorId]);

  return (
    <>
      {/* 搜索输入框 */}
      <input
        type="search"
        className="mdocs-visitor-picker-search"
        placeholder={t("visitorPickerSearchPlaceholder")}
        value={searchFilter}
        onChange={(e) => onSearchChange(e.target.value)}
        // 访客目录未加载完成时禁用搜索
        disabled={loadState !== "ok"}
      />

      {/* 加载中提示 */}
      {loadState === "loading" && <div className="mdocs-visitor-picker-loading">{t("loading")}</div>}
      {/* 加载失败提示 */}
      {loadState === "err" && <div className="mdocs-visitor-picker-error">{t("visitorPickerLoadError")}</div>}

      {/* 加载完成后渲染双栏表格 */}
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
                  {/* 没有匹配的访客时显示空状态 */}
                  {filteredLeft.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="mdocs-visitor-picker-empty-cell">
                        {/* 根据 visitors 是否为空判断是「无访客」还是「无匹配」 */}
                        {visitors.length === 0 ? t("visitorPickerEmptyDirectory") : t("domainNoMatch")}
                      </td>
                    </tr>
                  ) : (
                    filteredLeft.map((v) => {
                      // 判断是否被锁定（不可取消勾选）
                      const isLocked = lockedIds.has(v.visitorId);
                      // 判断是否已选中
                      const checked = selectedIds.has(v.visitorId);
                      return (
                        <tr key={v.visitorId}>
                          <td><code className="mdocs-visitor-picker-id-short">{idPrefix6(v.visitorId)}</code></td>
                          <td>
                            {v.visitorName}
                            {/* 当前登录访客标记「(你)」 */}
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
                    {showPermissionSelect && <th scope="col">{t("permissionLabel")}</th>}
                    <th scope="col" className="mdocs-visitor-picker-check-col" />
                  </tr>
                </thead>
                <tbody>
                  {selectedRows.length === 0 ? (
                    <tr>
                      <td colSpan={showPermissionSelect ? 4 : 3} className="mdocs-visitor-picker-empty-cell">
                        {t("visitorPickerNoSelection")}
                      </td>
                    </tr>
                  ) : (
                    selectedRows.map((row) => {
                      // 判断是否被锁定（不可移除）
                      const isLocked = lockedIds.has(row.visitorId);
                      return (
                        <tr key={row.visitorId}>
                          <td><code className="mdocs-visitor-picker-id-full">{row.visitorId}</code></td>
                          {/* muted 状态（已停用/已删除）使用灰色斜体 */}
                          <td className={row.muted ? "mdocs-visitor-picker-name-muted" : undefined}>{row.name}</td>
                          {showPermissionSelect && (
                            <td>
                              <MiniSelect
                                options={permissionOptions as MiniSelectOption[]}
                                value={row.permission ?? "read"}
                                onChange={(v) => onPermissionChange?.(row.visitorId, v)}
                              />
                            </td>
                          )}
                          <td className="mdocs-visitor-picker-check-col">
                            {isLocked ? (
                              // 锁定成员显示「—」不可移除
                              <span className="mdocs-visitor-picker-locked" title={t("visitorPickerLockedHint")}>—</span>
                            ) : (
                              // 非锁定成员显示移除按钮
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
