import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import {
  createDomainMemberTemplateApi,
  deleteDomainMemberTemplateApi,
  fetchDomainMemberTemplatesApi,
  fetchVisitorsDirectoryApi,
  updateDomainMemberTemplateApi,
} from "../services/endpoints";
import type { DomainMemberTemplate } from "../../shared/types/domainMemberTemplate";
import type { VisitorDirectoryEntry } from "../../shared/types/visitor";
import { getStoredVisitorId } from "../services/client";
import { translateError } from "./utils";
import { VisitorPickerContent } from "./VisitorPickerContent";

/** 取 UUID 前 6 位用于简短展示 */
function idPrefix6(id: string): string {
  if (id.length <= 6) return id;
  return `${id.slice(0, 6)}…`;
}

type WizardStep = 1 | 2 | 3;

export function MemberTemplatesPanel() {
  const { t } = useI18n();
  const mountedRef = useRef(true);

  /* ---- 模板列表 ---- */
  const [list, setList] = useState<DomainMemberTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  /* ---- 向导表单 ---- */
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  /* 当前访客 ID */
  const myVisitorId = getStoredVisitorId();

  /* ---- 访客目录（供模板标签展示名称 + 向导第 2 步使用） ---- */
  const [visitors, setVisitors] = useState<VisitorDirectoryEntry[]>([]);
  const [visitorLoadState, setVisitorLoadState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* 启动时加载访客目录 */
  useEffect(() => {
    setVisitorLoadState("loading");
    fetchVisitorsDirectoryApi()
      .then((rows) => {
        if (!mountedRef.current) return;
        setVisitors(rows);
        setVisitorLoadState("ok");
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setVisitorLoadState("err");
      });
  }, []);

  /* visitorId → displayName 映射 */
  const visitorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of visitors) map.set(v.visitorId, v.visitorName);
    return map;
  }, [visitors]);

  /* 加载模板列表 */
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchDomainMemberTemplatesApi();
      if (mountedRef.current) setList(rows);
    } catch (err) {
      if (mountedRef.current) setError(translateError(t, err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => { void reload(); }, [reload]);

  /* 已选成员的行数据（给共享组件用） */
  const selectedPickedRows = useMemo(() => {
    return pickedIds.map((id) => {
      const v = visitors.find((x) => x.visitorId === id);
      return { visitorId: id, name: v ? v.visitorName : t("visitorPickerUnknownVisitor"), muted: !v };
    });
  }, [pickedIds, visitors, t]);

  function toggleVisitor(id: string): void {
    setPickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /* ---- 向导导航 ---- */
  const canGoNext =
    currentStep === 1 ? displayName.trim().length > 0 : currentStep === 2 ? pickedIds.length > 0 : true;

  function goNext(): void {
    if (currentStep >= 3) return;
    if (!canGoNext) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setCurrentStep((currentStep + 1) as WizardStep);
    setSearchFilter("");
  }

  function goBack(): void {
    if (currentStep <= 1) return;
    setShowValidation(false);
    setCurrentStep((currentStep - 1) as WizardStep);
  }

  /* ---- 新建 / 编辑切换 ---- */
  function startNew(): void {
    setConfirmDeleteId(null);
    setEditingId(null);
    setDisplayName("");
    setPickedIds(myVisitorId ? [myVisitorId] : []);
    setError(null);
    setCurrentStep(1);
    setSearchFilter("");
    setShowValidation(false);
  }

  function startEdit(row: DomainMemberTemplate): void {
    setConfirmDeleteId(null);
    setEditingId(row.id);
    setDisplayName(row.displayName);
    /* 确保自己默认在名单中，用户可自行取消 */
    const ids = myVisitorId && !row.visitorIds.includes(myVisitorId)
      ? [...row.visitorIds, myVisitorId]
      : [...row.visitorIds];
    setPickedIds(ids);
    setError(null);
    setCurrentStep(1);
    setSearchFilter("");
    setShowValidation(false);
  }

  /* ---- 保存 & 删除 ---- */
  async function handleSave(): Promise<void> {
    if (!displayName.trim() || pickedIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId === null) {
        await createDomainMemberTemplateApi({ displayName: displayName.trim(), visitorIds: pickedIds });
      } else {
        await updateDomainMemberTemplateApi(editingId, {
          displayName: displayName.trim(),
          visitorIds: pickedIds,
        });
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

  async function handleDeleteConfirmed(id: number): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await deleteDomainMemberTemplateApi(id);
      if (!mountedRef.current) return;
      setConfirmDeleteId(null);
      if (editingId === id) startNew();
      await reload();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(translateError(t, err));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  /* ---- 渲染 ---- */
  const steps: { key: WizardStep; label: string }[] = [
    { key: 1, label: t("memberTemplateStepName") },
    { key: 2, label: t("memberTemplateStepMembers") },
    { key: 3, label: t("memberTemplateStepSave") },
  ];

  const progressWidth = `${((currentStep - 1) / 2) * 100}%`;

  return (
    <div className="mdocs-settings">
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">
          {editingId !== null ? t("memberTemplateUpdate") : t("memberTemplateFormNew")}
        </h2>
        {editingId !== null && (
          <button type="button" className="secondary" onClick={startNew} style={{ fontSize: 12 }}>
            {t("memberTemplateCancelEdit")}
          </button>
        )}
      </div>

      {/* 进度条 */}
      <div className="mdocs-wizard-progress">
        <div className="mdocs-wizard-progress-track">
          <div className="mdocs-wizard-progress-fill" style={{ width: progressWidth }} />
        </div>
        <div className="mdocs-wizard-progress-steps">
          {steps.map((step) => {
            const isCurrent = currentStep === step.key;
            const isDone = currentStep > step.key;
            return (
              <div className="mdocs-wizard-step-indicator" key={step.key}>
                <div className={`mdocs-wizard-step-circle${isCurrent ? " current" : ""}${isDone ? " done" : ""}`}>
                  {isDone ? "\u2713" : step.key}
                </div>
                <span className={`mdocs-wizard-step-label${isCurrent ? " current" : ""}${isDone ? " done" : ""}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mdocs-settings-item-desc" style={{ color: "var(--mdocs-danger)", marginBottom: 12, marginTop: 12 }}>
          {error}
        </div>
      )}

      <div className="mdocs-settings-cards">
        {/* 向导卡片 */}
        <div className="mdocs-settings-card mdocs-wizard-card">
          {/* 步骤 1：名称 */}
          {currentStep === 1 && (
            <div className="mdocs-wizard-step-content">
              <input
                className="mdocs-wizard-name-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("memberTemplateNamePlaceholder")}
                maxLength={200}
                disabled={saving}
                autoFocus
                aria-invalid={showValidation && !displayName.trim()}
              />
              {showValidation && !displayName.trim() && (
                <p className="mdocs-wizard-hint" style={{ color: "var(--mdocs-danger)" }}>
                  {t("domainNameRequired")}
                </p>
              )}
            </div>
          )}

          {/* 步骤 2：选择成员 */}
          {currentStep === 2 && (
            <div className="mdocs-wizard-step-content">
              <VisitorPickerContent
                visitors={visitors}
                loadState={visitorLoadState}
                searchFilter={searchFilter}
                onSearchChange={setSearchFilter}
                selectedIds={new Set(pickedIds)}
                onToggle={toggleVisitor}
                selectedRows={selectedPickedRows}
                myVisitorId={myVisitorId}
              />
              <p className={`mdocs-wizard-hint${showValidation && pickedIds.length === 0 ? " danger" : ""}`}>
                {"\uD83D\uDCA1 " + t("memberTemplateStep2Hint")}
              </p>
            </div>
          )}

          {/* 步骤 3：确认 */}
          {currentStep === 3 && (
            <div className="mdocs-wizard-step-content">
              <div className="mdocs-wizard-preview-card">
                <div className="mdocs-wizard-preview-row">
                  <span className="mdocs-wizard-preview-label">{t("memberTemplateNameLabel")}</span>
                  <span className="mdocs-wizard-preview-value">{displayName}</span>
                </div>
                <div className="mdocs-wizard-preview-row">
                  <span className="mdocs-wizard-preview-label">{t("memberTemplateIdsLabel")}</span>
                  <span className="mdocs-wizard-preview-value">
                    {t("memberTemplateSelectedSummary", { count: String(pickedIds.length) })}
                  </span>
                </div>
                {pickedIds.length > 0 && (
                  <div className="mdocs-wizard-preview-tags">
                    {pickedIds.slice(0, 15).map((id) => (
                      <span key={id} className="mdocs-wizard-preview-tag">{idPrefix6(id)}</span>
                    ))}
                    {pickedIds.length > 15 && (
                      <span className="mdocs-wizard-preview-tag mdocs-wizard-preview-tag-more">
                        +{pickedIds.length - 15}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 底部导航 */}
          <div className="mdocs-wizard-footer">
            <button
              type="button"
              className="secondary"
              onClick={goBack}
            >
              {"\u2190 "}{t("memberTemplateWizardBack")}
            </button>
            {currentStep < 3 ? (
              <button
                type="button"
                className="primary"
                onClick={goNext}
              >
                {t("memberTemplateWizardNext")}{" \u2192"}
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={() => void handleSave()}
              >
                {saving ? t("saving") : editingId === null ? t("memberTemplateCreate") : t("memberTemplateUpdate")}
              </button>
            )}
          </div>
        </div>

        {/* 已保存的模板列表 */}
        <div className="mdocs-settings-card">
          <div className="mdocs-settings-card-title">{t("memberTemplateSavedList")}</div>

          {loading ? (
            <span className="mdocs-settings-item-desc">{t("loading")}</span>
          ) : list.length === 0 ? (
            <div className="mdocs-member-template-empty">
              <span className="mdocs-settings-item-desc">{t("memberTemplateEmpty")}</span>
              {editingId === null && (
                <button type="button" className="primary" onClick={startNew}>
                  {t("memberTemplateEmptyAction")}
                </button>
              )}
            </div>
          ) : (
            <ul className="mdocs-member-template-list">
              {list.map((row) => (
                <li key={row.id} className="mdocs-member-template-row">
                  {confirmDeleteId === row.id ? (
                    <div className="mdocs-member-template-confirm-row">
                      <span className="mdocs-member-template-confirm-text">
                        {t("memberTemplateConfirmDeleteDesc", { name: row.displayName })}
                      </span>
                      <div className="mdocs-member-template-confirm-actions">
                        <button
                          type="button"
                          className="secondary"
                          style={{ color: "var(--mdocs-danger)" }}
                          onClick={() => void handleDeleteConfirmed(row.id)}
                        >
                          {saving ? t("saving") : t("memberTemplateConfirmDeleteSubmit")}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {t("memberTemplateConfirmDeleteCancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mdocs-member-template-row-head">
                        <strong>{row.displayName}</strong>
                        <span className="mdocs-settings-item-desc">
                          {t("memberTemplateCount", { count: String(row.visitorIds.length) })}
                        </span>
                        {row.visitorIds.length > 0 && (
                          <div className="mdocs-member-template-tags mdocs-member-template-tags-scroll">
                            {row.visitorIds.map((id) => (
                              <span key={id} className="mdocs-member-template-tag">
                                {visitorNameMap.get(id) ?? idPrefix6(id)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mdocs-member-template-row-actions">
                        <button type="button" className="secondary" onClick={() => startEdit(row)}>
                          {t("edit")}
                        </button>
                        <button type="button" className="secondary" onClick={() => setConfirmDeleteId(row.id)}>
                          {t("memberTemplateDelete")}
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
