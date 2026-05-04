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
          rows.push({ visitorId: id, name: t("visitorPickerMemberMissing"), muted: true });
        } else if (seed.disabled) {
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
            <select
              className="mdocs-visitor-picker-template-select"
              value={templatePick}
              onChange={(e) => setTemplatePick(e.target.value)}
              disabled={loadState !== "ok" || templateOptions.length === 0}
              aria-label={t("visitorPickerPickTemplate")}
            >
              <option value="">{t("visitorPickerPickTemplate")}</option>
              {templateOptions.map((tm) => (
                <option key={tm.id} value={String(tm.id)}>
                  {tm.displayName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary"
              onClick={applyTemplate}
              disabled={!templatePick || loadState !== "ok"}
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
          <button type="button" className="secondary" onClick={onClose} disabled={confirmBusy}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void handleConfirm()}
            disabled={confirmBusy || loadState !== "ok"}
          >
            {confirmBusy ? t("saving") : t("visitorPickerConfirm")}
          </button>
        </footer>
      </div>
    </div>
  );
}
