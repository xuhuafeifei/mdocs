import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import {
  createDomainMemberTemplateApi,
  deleteDomainMemberTemplateApi,
  fetchDomainMemberTemplatesApi,
  updateDomainMemberTemplateApi,
} from "../services/endpoints";
import type { DomainMemberTemplate } from "../../shared/types/domainMemberTemplate";
import { translateError } from "./utils";
import { VisitorPickerModal } from "./VisitorPickerModal";

export function MemberTemplatesPanel() {
  const { t } = useI18n();
  const mountedRef = useRef(true);
  const [list, setList] = useState<DomainMemberTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchDomainMemberTemplatesApi();
      if (!mountedRef.current) return;
      setList(rows);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(translateError(t, err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function startNew(): void {
    setEditingId(null);
    setDisplayName("");
    setPickedIds([]);
    setError(null);
  }

  function startEdit(row: DomainMemberTemplate): void {
    setEditingId(row.id);
    setDisplayName(row.displayName);
    setPickedIds([...row.visitorIds]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError(t("domainNameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId === null) {
        await createDomainMemberTemplateApi({ displayName: name, visitorIds: pickedIds });
      } else {
        await updateDomainMemberTemplateApi(editingId, { displayName: name, visitorIds: pickedIds });
      }
      if (!mountedRef.current) return;
      startNew();
      await reload();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(translateError(t, err));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  async function handleDelete(id: number, name: string): Promise<void> {
    if (!window.confirm(t("memberTemplateDeleteConfirm", { name }))) return;
    setError(null);
    try {
      await deleteDomainMemberTemplateApi(id);
      if (!mountedRef.current) return;
      if (editingId === id) startNew();
      await reload();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(translateError(t, err));
    }
  }

  return (
    <div className="mdocs-settings">
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">{t("memberTemplates")}</h2>
      </div>
      <p className="mdocs-member-template-intro">{t("memberTemplateIntro")}</p>
      <div className="mdocs-settings-cards">
        <form className="mdocs-settings-card mdocs-member-template-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="mdocs-settings-card-title">
            {editingId === null ? t("memberTemplateFormNew") : t("memberTemplateUpdate")}
          </div>
          {error && (
            <div className="mdocs-settings-item-desc" style={{ color: "var(--mdocs-danger)" }}>
              {error}
            </div>
          )}
          <label className="mdocs-domain-mgmt-field">
            <span className="mdocs-domain-mgmt-label">{t("memberTemplateNameLabel")}</span>
            <input
              className="mdocs-member-template-name-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={200}
              disabled={saving}
            />
          </label>
          <div className="mdocs-domain-mgmt-field">
            <span className="mdocs-domain-mgmt-label">{t("memberTemplateIdsLabel")}</span>
            <span className="mdocs-settings-item-desc">{t("memberTemplateIdsHint")}</span>
            <div className="mdocs-member-template-members-row">
              <span className="mdocs-member-template-selected-count">
                {t("memberTemplateSelectedSummary", { count: String(pickedIds.length) })}
              </span>
              <button type="button" className="secondary" disabled={saving} onClick={() => setPickerOpen(true)}>
                {t("memberTemplatePickMembersButton")}
              </button>
            </div>
          </div>
          <div className="mdocs-member-template-form-actions">
            <button type="submit" className="primary" disabled={saving}>
              {saving ? t("saving") : editingId === null ? t("memberTemplateCreate") : t("memberTemplateUpdate")}
            </button>
            {editingId !== null && (
              <button type="button" className="secondary" disabled={saving} onClick={startNew}>
                {t("memberTemplateCancelEdit")}
              </button>
            )}
          </div>
        </form>

        <div className="mdocs-settings-card">
          <div className="mdocs-settings-card-title">{t("memberTemplateSavedList")}</div>
          {loading ? (
            <span className="mdocs-settings-item-desc">{t("loading")}</span>
          ) : list.length === 0 ? (
            <span className="mdocs-settings-item-desc">{t("memberTemplateEmpty")}</span>
          ) : (
            <ul className="mdocs-member-template-list">
              {list.map((row) => (
                <li key={row.id} className="mdocs-member-template-row">
                  <div className="mdocs-member-template-row-head">
                    <strong>{row.displayName}</strong>
                    <span className="mdocs-settings-item-desc">
                      {t("memberTemplateCount", { count: String(row.visitorIds.length) })}
                    </span>
                  </div>
                  <div className="mdocs-member-template-row-actions">
                    <button type="button" className="secondary" onClick={() => startEdit(row)}>
                      {t("edit")}
                    </button>
                    <button type="button" className="secondary" onClick={() => void handleDelete(row.id, row.displayName)}>
                      {t("memberTemplateDelete")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <VisitorPickerModal
        open={pickerOpen}
        title={t("memberTemplatePickerTitle")}
        initialSelectedIds={pickedIds}
        excludeTemplateId={editingId ?? undefined}
        templates={list}
        onClose={() => setPickerOpen(false)}
        onConfirm={(ids) => {
          setPickedIds(ids);
        }}
      />
    </div>
  );
}
