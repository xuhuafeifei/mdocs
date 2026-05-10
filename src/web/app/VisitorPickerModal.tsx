/**
 * 访客选择器弹窗
 * 用于受限域成员管理和成员模板编辑。
 * 支持：
 * 1. 从访客目录勾选成员（左栏）
 * 2. 已选成员展示与移除（右栏）
 * 3. 套用已保存的成员模板
 * 4. 区分正常/已停用/已删除三种成员状态
 * 创建者等 lockedIds 不可取消勾选。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { DomainMemberListEntry } from "../../shared/types/domain";
import type { DomainMemberTemplate } from "../../shared/types/domainMemberTemplate";
import type { VisitorDirectoryEntry } from "../../shared/types/visitor";
import { fetchVisitorsDirectoryApi } from "../services/endpoints";
import { getStoredVisitorId } from "../services/client";
import { translateError } from "./utils";
import { VisitorPickerContent } from "./VisitorPickerContent";

export interface VisitorPickerModalProps {
  open: boolean;
  title: string;
  /** 打开时用该列表初始化勾选（域成员 / 模板已保存的 id） */
  initialSelectedIds: string[];
  /** 不可取消勾选（如域创建者） */
  lockedIds?: string[];
  /** 受限域：来自 GET members，用于右栏展示不在「活跃访客目录」里的成员 */
  seedMembers?: DomainMemberListEntry[];
  /** 编辑模板时从下拉中排除自身，避免套用当前模板 */
  excludeTemplateId?: number;
  templates: DomainMemberTemplate[];
  onClose: () => void;
  /** 确认回调：showPermissionSelect=true 时返回带权限的对象数组，否则返回 ID 数组 */
  onConfirm: (result: string[] | Array<{ visitorId: string; permission: string }>) => void | Promise<void>;
  /** 是否显示权限选择下拉（文档邀请时使用） */
  showPermissionSelect?: boolean;
  /** 权限选项 */
  permissionOptions?: { value: string; label: string }[];
  /** 已有成员的初始权限 */
  initialPermissions?: Map<string, string>;
}

type SelectedDisplayRow = { visitorId: string; name: string; muted: boolean };

export function VisitorPickerModal(props: VisitorPickerModalProps) {
  const {
    open,
    title,
    initialSelectedIds,
    lockedIds = [],
    seedMembers,
    excludeTemplateId,
    templates,
    onClose,
    onConfirm,
    showPermissionSelect = false,
    permissionOptions = [],
    initialPermissions,
  } = props;
  const { t } = useI18n();

  // 用 ref 保存最新的 t 函数，供异步回调使用（避免闭包陷阱）
  const tRef = useRef(t);
  tRef.current = t;

  // 将 lockedIds 转为 Set，提高查找效率
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);

  // 当前登录的访客 ID
  const myVisitorId = getStoredVisitorId();

  // ---- 全部访客数据 ----
  const [allVisitors, setAllVisitors] = useState<VisitorDirectoryEntry[]>([]);

  // ---- 访客目录加载状态 ----
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ok" | "err">("idle");

  // ---- 已选访客 ID 集合 ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // ---- 已选访客的权限 Map ----
  const [permissions, setPermissions] = useState<Map<string, string>>(() => new Map());

  // ---- 搜索过滤词 ----
  const [filter, setFilter] = useState("");

  // ---- 当前选中的模板 ID ----
  const [templatePick, setTemplatePick] = useState("");

  // ---- 模板下拉菜单是否打开 ----
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  // ---- 模板下拉菜单引用（用于点击外部关闭） ----
  const templateRef = useRef<HTMLDivElement>(null);

  // ---- 确认按钮加载状态 ----
  const [confirmBusy, setConfirmBusy] = useState(false);

  // ---- 本地错误提示 ----
  const [localErr, setLocalErr] = useState<string | null>(null);

  /**
   * 过滤模板选项：编辑模板时排除自身，避免套用自己。
   */
  const templateOptions = useMemo(
    () => templates.filter((tm) => excludeTemplateId == null || tm.id !== excludeTemplateId),
    [templates, excludeTemplateId],
  );

  /**
   * 将 seedMembers 构建为 Map，便于后续按 visitorId 快速查找成员状态。
   */
  const seedMap = useMemo(() => new Map((seedMembers ?? []).map((s) => [s.visitorId, s])), [seedMembers]);

  /**
   * 弹窗打开时：重置为初始已选项，清空搜索和模板选择。
   */
  useEffect(() => {
    // 弹窗未打开时不处理
    if (!open) return;
    // 用初始已选项初始化勾选集合
    setSelectedIds(new Set(initialSelectedIds));
    // 初始化权限 Map
    setPermissions(initialPermissions ? new Map(initialPermissions) : new Map());
    // 清空搜索词
    setFilter("");
    // 清空模板选择
    setTemplatePick("");
    // 清空错误提示
    setLocalErr(null);
  }, [open, initialSelectedIds, initialPermissions]);

  /**
   * 弹窗打开时加载访客目录，组件卸载或弹窗关闭时取消未完成的请求。
   */
  useEffect(() => {
    if (!open) return;
    // 用于取消未完成请求的标记
    let cancelled = false;
    setLoadState("loading");
    fetchVisitorsDirectoryApi()
      .then((rows) => {
        // 如果请求完成后组件已卸载或弹窗已关闭，忽略结果
        if (!cancelled) {
          setAllVisitors(rows);
          setLoadState("ok");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadState("err");
          // 使用 ref 中的 t 函数，避免闭包问题
          setLocalErr(translateError(tRef.current, err));
        }
      });
    // 清理函数：标记为已取消
    return () => {
      cancelled = true;
    };
  }, [open]);

  /**
   * 模板下拉菜单：点击外部自动关闭。
   */
  useEffect(() => {
    if (!templateMenuOpen) return;
    const handler = (e: MouseEvent) => {
      // 如果点击位置不在模板下拉菜单内，关闭菜单
      if (!templateRef.current?.contains(e.target as Node)) setTemplateMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [templateMenuOpen]);

  /**
   * 右栏「已选成员」的行数据构建。
   *
   * 成员可来自两个数据源，优先级：
   *   dirMap — 活跃访客目录（fetchVisitorsDirectoryApi，仅含 disabled_at IS NULL 的访客）
   *   seedMap — 域成员接口（GET /:id/members，含正常 / 已停用 / 已删除三种状态）
   *
   * 最终呈现三种状态：
   *   1. 正常       → 显示昵称（白色字）
   *   2. 已停用     → 显示「昵称 · 已停用」（灰色斜体）
   *   3. 已删除     → 显示「已删除的访客（库中无记录）」（灰色斜体）
   */
  const selectedDisplayRows = useMemo(() => {
    // 构建访客目录 Map，用于快速查找
    const dirMap = new Map(allVisitors.map((v) => [v.visitorId, v]));
    const rows: Array<{ visitorId: string; name: string; muted: boolean; permission?: string }> = [];
    // 遍历所有已选成员 ID
    for (const id of selectedIds) {
      // 获取该访客的权限
      const permission = permissions.get(id);
      // 先在活跃访客目录中查找
      const dir = dirMap.get(id);
      if (dir) {
        // 找到了，显示正常状态
        rows.push({ visitorId: id, name: dir.visitorName, muted: false, permission });
        continue;
      }
      // 在 seedMembers（域成员接口）中查找
      const seed = seedMap.get(id);
      if (seed) {
        if (seed.missing) {
          // visitors 表已无此行 → 物理删除
          rows.push({ visitorId: id, name: t("visitorPickerMemberMissing"), muted: true, permission });
        } else if (seed.disabled) {
          // visitors 表有行但 disabled_at 非空 → 已停用（被合并）
          rows.push({
            visitorId: id,
            name: `${seed.visitorName} · ${t("visitorPickerDisabledTag")}`,
            muted: true,
            permission,
          });
        } else {
          // 正常成员
          rows.push({ visitorId: id, name: seed.visitorName, muted: false, permission });
        }
        continue;
      }
      // 两个数据源都找不到 → 未知访客
      rows.push({ visitorId: id, name: t("visitorPickerUnknownVisitor"), muted: true, permission });
    }
    // 按名称字母顺序排序
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return rows;
  }, [allVisitors, selectedIds, seedMap, permissions, t]);

  /**
   * 切换访客选中状态，locked（域创建者等）不可取消。
   */
  const toggle = useCallback(
    (id: string) => {
      // locked 成员不可操作
      if (locked.has(id)) return;
      setSelectedIds((prev) => {
        const n = new Set(prev);
        if (n.has(id)) {
          // 已选中则取消，同时移除权限
          n.delete(id);
          setPermissions((p) => {
            const np = new Map(p);
            np.delete(id);
            return np;
          });
        } else {
          // 未选中则添加，默认权限为 read
          n.add(id);
          setPermissions((p) => {
            const np = new Map(p);
            np.set(id, "read");
            return np;
          });
        }
        return n;
      });
    },
    [locked],
  );

  /**
   * 修改访客权限
   */
  const handlePermissionChange = useCallback((visitorId: string, permission: string) => {
    setPermissions((prev) => {
      const np = new Map(prev);
      np.set(visitorId, permission);
      return np;
    });
  }, []);

  /**
   * 套用已选模板：在当前已选成员基础上追加模板中的访客（仅追加已知访客，不移除任何人）。
   */
  const applyTemplate = useCallback(() => {
    // 将选中的模板 ID 转为数字
    const tid = Number(templatePick);
    // 验证 ID 是否合法
    if (!Number.isInteger(tid) || tid < 1) return;
    // 在模板列表中查找对应模板
    const tm = templates.find((x) => x.id === tid);
    if (!tm) return;
    // 构建已知访客 ID 集合（只追加活跃访客目录中存在的访客）
    const known = new Set(allVisitors.map((v) => v.visitorId));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      // 将模板中的访客 ID 追加到已选集合
      for (const id of tm.visitorIds) {
        if (known.has(id)) n.add(id);
      }
      return n;
    });
  }, [templatePick, templates, allVisitors]);

  /**
   * 确认选择：将已选访客 ID 排序后回调给父组件，成功后关闭弹窗。
   */
  async function handleConfirm(): Promise<void> {
    setLocalErr(null);
    setConfirmBusy(true);
    try {
      if (showPermissionSelect) {
        // 文档邀请模式：返回带权限的对象数组
        const result = [...selectedIds].sort().map((visitorId) => ({
          visitorId,
          permission: permissions.get(visitorId) ?? "read",
        }));
        await onConfirm(result);
      } else {
        // 普通模式：仅返回 ID 数组
        const ids = [...selectedIds].sort();
        await onConfirm(ids);
      }
      onClose();
    } catch (err) {
      setLocalErr(translateError(t, err));
    } finally {
      setConfirmBusy(false);
    }
  }

  /**
   * 弹窗未打开时直接返回 null，不渲染任何 DOM。
   */
  if (!open) return null;

  return (
    <div
      className="mdocs-visitor-picker-overlay"
      role="presentation"
      // 点击遮罩层关闭弹窗
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="mdocs-visitor-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mdocs-visitor-picker-title"
      >
        {/* 头部 */}
        <header className="mdocs-visitor-picker-header">
          <h2 id="mdocs-visitor-picker-title" className="mdocs-visitor-picker-title">
            {title}
          </h2>
          <button type="button" className="mdocs-visitor-picker-close" onClick={onClose} aria-label={t("close")}>
            ×
          </button>
        </header>

        {/* 工具栏：模板选择 */}
        <div className="mdocs-visitor-picker-toolbar">
          <div className="mdocs-visitor-picker-template-bar">
            <div ref={templateRef} className="mdocs-template-picker">
              <button
                type="button"
                className="mdocs-template-picker-trigger"
                onClick={() => setTemplateMenuOpen((v) => !v)}
                // 访客目录未加载完成或没有可用模板时禁用
                disabled={loadState !== "ok" || templateOptions.length === 0}
                aria-haspopup="listbox"
                aria-expanded={templateMenuOpen}
              >
                <span className="mdocs-template-picker-text">
                  {/* 显示当前选中的模板名称，或提示文字 */}
                  {templatePick
                    ? templateOptions.find((t) => String(t.id) === templatePick)?.displayName
                    : t("visitorPickerPickTemplate")}
                </span>
                <svg className={"mdocs-template-picker-chevron" + (templateMenuOpen ? " open" : "")} width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 1l4 4 4-4" />
                </svg>
              </button>
              {/* 模板下拉菜单 */}
              {templateMenuOpen && (
                <div className="mdocs-template-picker-menu card" role="listbox">
                  {templateOptions.map((tm) => (
                    <button
                      key={tm.id}
                      type="button"
                      className={"mdocs-template-picker-option" + (String(tm.id) === templatePick ? " active" : "")}
                      role="option"
                      aria-selected={String(tm.id) === templatePick}
                      onClick={() => { setTemplatePick(String(tm.id)); setTemplateMenuOpen(false); }}
                    >
                      {tm.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* 套用模板按钮 */}
            <button
              type="button"
              className="secondary"
              onClick={() => {
                // 访客目录未加载完成时提示
                if (loadState !== "ok") {
                  setLocalErr(t("loading"));
                  return;
                }
                // 未选择模板时提示
                if (!templatePick) {
                  setLocalErr(t("visitorPickerPickTemplate"));
                  return;
                }
                applyTemplate();
              }}
            >
              {t("visitorPickerApplyTemplate")}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {localErr && (
          <div className="mdocs-visitor-picker-error" role="alert">
            {localErr}
          </div>
        )}

        {/* 访客选择器内容：搜索栏 + 左右双栏表格 */}
        <div style={{ padding: "8px 18px 12px" }}>
          <VisitorPickerContent
            visitors={allVisitors}
            loadState={loadState}
            searchFilter={filter}
            onSearchChange={setFilter}
            selectedIds={selectedIds}
            onToggle={toggle}
            selectedRows={selectedDisplayRows}
            lockedIds={locked}
            myVisitorId={myVisitorId}
            showPermissionSelect={showPermissionSelect}
            permissionOptions={permissionOptions}
            onPermissionChange={handlePermissionChange}
          />
        </div>

        {/* 底部操作栏 */}
        <footer className="mdocs-visitor-picker-footer">
          <button type="button" className="secondary" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              // 访客目录未加载完成时提示
              if (loadState !== "ok") {
                setLocalErr(t("loading"));
                return;
              }
              void handleConfirm();
            }}
          >
            {confirmBusy ? t("saving") : t("visitorPickerConfirm")}
          </button>
        </footer>
      </div>
    </div>
  );
}
