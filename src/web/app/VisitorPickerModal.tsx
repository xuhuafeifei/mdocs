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
  onConfirm: (visitorIds: string[]) => void | Promise<void>;
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
  } = props;
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);
  const myVisitorId = getStoredVisitorId();

  const [allVisitors, setAllVisitors] = useState<VisitorDirectoryEntry[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState("");
  const [templatePick, setTemplatePick] = useState("");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const templateOptions = useMemo(
    () => templates.filter((tm) => excludeTemplateId == null || tm.id !== excludeTemplateId),
    [templates, excludeTemplateId],
  );

  const seedMap = useMemo(() => new Map((seedMembers ?? []).map((s) => [s.visitorId, s])), [seedMembers]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(initialSelectedIds));
    setFilter("");
    setTemplatePick("");
    setLocalErr(null);
  }, [open, initialSelectedIds]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadState("loading");
    fetchVisitorsDirectoryApi()
      .then((rows) => {
        if (!cancelled) {
          setAllVisitors(rows);
          setLoadState("ok");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadState("err");
          setLocalErr(translateError(tRef.current, err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  /* 模板菜单点击外部关闭 */
  useEffect(() => {
    if (!templateMenuOpen) return;
    const handler = (e: MouseEvent) => {
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
  const selectedDisplayRows: SelectedDisplayRow[] = useMemo(() => {
    const dirMap = new Map(allVisitors.map((v) => [v.visitorId, v]));
    const rows: SelectedDisplayRow[] = [];
    for (const id of selectedIds) {
      const dir = dirMap.get(id);
      if (dir) {
        rows.push({ visitorId: id, name: dir.visitorName, muted: false });
        continue;
      }
      const seed = seedMap.get(id);
      if (seed) {
        if (seed.missing) {
          /* visitors 表已无此行 → 物理删除 */
          rows.push({ visitorId: id, name: t("visitorPickerMemberMissing"), muted: true });
        } else if (seed.disabled) {
          /* visitors 表有行但 disabled_at 非空 → 已停用（被合并） */
          rows.push({
            visitorId: id,
            name: `${seed.visitorName} · ${t("visitorPickerDisabledTag")}`,
            muted: true,
          });
        } else {
          rows.push({ visitorId: id, name: seed.visitorName, muted: false });
        }
        continue;
      }
      rows.push({ visitorId: id, name: t("visitorPickerUnknownVisitor"), muted: true });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return rows;
  }, [allVisitors, selectedIds, seedMap, t]);

  /* locked 中的成员（域创建者）不可取消勾选 */
  const toggle = useCallback(
    (id: string) => {
      if (locked.has(id)) return;
      setSelectedIds((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
    },
    [locked],
  );

  /* 套用模板：只在当前已选中基础上追加，不会移除已有成员（包括域创建者） */
  const applyTemplate = useCallback(() => {
    const tid = Number(templatePick);
    if (!Number.isInteger(tid) || tid < 1) return;
    const tm = templates.find((x) => x.id === tid);
    if (!tm) return;
    const known = new Set(allVisitors.map((v) => v.visitorId));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      for (const id of tm.visitorIds) {
        if (known.has(id)) n.add(id);
      }
      return n;
    });
  }, [templatePick, templates, allVisitors]);

  async function handleConfirm(): Promise<void> {
    setLocalErr(null);
    setConfirmBusy(true);
    try {
      const ids = [...selectedIds].sort();
      await onConfirm(ids);
      onClose();
    } catch (err) {
      setLocalErr(translateError(t, err));
    } finally {
      setConfirmBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="mdocs-visitor-picker-overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="mdocs-visitor-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mdocs-visitor-picker-title"
      >
        <header className="mdocs-visitor-picker-header">
          <h2 id="mdocs-visitor-picker-title" className="mdocs-visitor-picker-title">
            {title}
          </h2>
          <button type="button" className="mdocs-visitor-picker-close" onClick={onClose} aria-label={t("close")}>
            ×
          </button>
        </header>

        <div className="mdocs-visitor-picker-toolbar">
          <div className="mdocs-visitor-picker-template-bar">
            <div ref={templateRef} className="mdocs-template-picker">
              <button
                type="button"
                className="mdocs-template-picker-trigger"
                onClick={() => setTemplateMenuOpen((v) => !v)}
                disabled={loadState !== "ok" || templateOptions.length === 0}
                aria-haspopup="listbox"
                aria-expanded={templateMenuOpen}
              >
                <span className="mdocs-template-picker-text">
                  {templatePick
                    ? templateOptions.find((t) => String(t.id) === templatePick)?.displayName
                    : t("visitorPickerPickTemplate")}
                </span>
                <svg className={"mdocs-template-picker-chevron" + (templateMenuOpen ? " open" : "")} width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 1l4 4 4-4" />
                </svg>
              </button>
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
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (loadState !== "ok") {
                  setLocalErr(t("loading"));
                  return;
                }
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

        {localErr && (
          <div className="mdocs-visitor-picker-error" role="alert">
            {localErr}
          </div>
        )}

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
          />
        </div>

        <footer className="mdocs-visitor-picker-footer">
          <button type="button" className="secondary" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
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
