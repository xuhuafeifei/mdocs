import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { DomainMemberListEntry } from "../../shared/types/domain";
import type { DomainMemberTemplate } from "../../shared/types/domainMemberTemplate";
import type { VisitorDirectoryEntry } from "../../shared/types/visitor";
import { fetchVisitorsDirectoryApi } from "../services/endpoints";
import { translateError } from "./utils";

function idPrefix6(id: string): string {
  if (id.length <= 6) return id;
  return `${id.slice(0, 6)}…`;
}

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

  const filteredLeft = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allVisitors;
    return allVisitors.filter(
      (v) =>
        v.visitorName.toLowerCase().includes(q) || v.visitorId.toLowerCase().includes(q),
    );
  }, [allVisitors, filter]);

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
          <input
            type="search"
            className="mdocs-visitor-picker-search"
            placeholder={t("visitorPickerSearchPlaceholder")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            disabled={loadState !== "ok"}
          />
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

        {loadState === "loading" && <div className="mdocs-visitor-picker-loading">{t("loading")}</div>}
        {loadState === "err" && <div className="mdocs-visitor-picker-error">{t("visitorPickerLoadError")}</div>}

        {loadState === "ok" && (
          <div className="mdocs-visitor-picker-columns">
            <div className="mdocs-visitor-picker-col">
              <h3 className="mdocs-visitor-picker-col-title">{t("visitorPickerColumnAll")}</h3>
              <div className="mdocs-visitor-picker-table-wrap">
                <table className="mdocs-visitor-picker-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("visitorPickerColIdShort")}</th>
                      <th scope="col">{t("visitorPickerColName")}</th>
                      <th scope="col" className="mdocs-visitor-picker-check-col">
                        {t("visitorPickerColPick")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeft.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="mdocs-visitor-picker-empty-cell">
                          {allVisitors.length === 0 ? t("visitorPickerEmptyDirectory") : t("domainNoMatch")}
                        </td>
                      </tr>
                    ) : (
                      filteredLeft.map((v) => {
                        const isLocked = locked.has(v.visitorId);
                        const checked = selectedIds.has(v.visitorId);
                        return (
                          <tr key={v.visitorId}>
                            <td>
                              <code className="mdocs-visitor-picker-id-short">{idPrefix6(v.visitorId)}</code>
                            </td>
                            <td>{v.visitorName}</td>
                            <td className="mdocs-visitor-picker-check-col">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isLocked}
                                onChange={() => toggle(v.visitorId)}
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
            <div className="mdocs-visitor-picker-col mdocs-visitor-picker-col-selected">
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
                    {selectedDisplayRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="mdocs-visitor-picker-empty-cell">
                          {t("visitorPickerNoSelection")}
                        </td>
                      </tr>
                    ) : (
                      selectedDisplayRows.map((row) => {
                        const isLocked = locked.has(row.visitorId);
                        return (
                          <tr key={row.visitorId}>
                            <td>
                              <code className="mdocs-visitor-picker-id-full">{row.visitorId}</code>
                            </td>
                            <td className={row.muted ? "mdocs-visitor-picker-name-muted" : undefined}>{row.name}</td>
                            <td className="mdocs-visitor-picker-check-col">
                              {!isLocked && (
                                <button
                                  type="button"
                                  className="mdocs-visitor-picker-remove"
                                  onClick={() => toggle(row.visitorId)}
                                  aria-label={t("visitorPickerRemove")}
                                >
                                  ×
                                </button>
                              )}
                              {isLocked && (
                                <span className="mdocs-visitor-picker-locked" title={t("visitorPickerLockedHint")}>
                                  —
                                </span>
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
