/**
 * 域成员模板面板
 * 设置页面中的「成员模板」Tab 内容。
 * 向导式三步流程（填名称 → 选成员 → 保存），用于创建可复用的访客列表模板。
 * 保存后的模板可在受限域的成员管理弹窗中一键套用。
 */
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

  // ---- 用于防止组件卸载后 setState 的标记 ----
  const mountedRef = useRef(true);

  /**
   * ---- 模板列表状态 ----
   */
  const [list, setList] = useState<DomainMemberTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  /**
   * ---- 向导表单状态 ----
   */
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  /**
   * 当前登录访客的 ID
   */
  const myVisitorId = getStoredVisitorId();

  /**
   * ---- 访客目录（供模板标签展示名称 + 向导第 2 步使用） ----
   */
  const [visitors, setVisitors] = useState<VisitorDirectoryEntry[]>([]);
  const [visitorLoadState, setVisitorLoadState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [searchFilter, setSearchFilter] = useState("");

  /**
   * 挂载标记：用于异步操作后判断组件是否已卸载，避免内存泄漏。
   */
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /**
   * 启动时加载访客目录，供模板标签展示和向导第 2 步使用。
   */
  useEffect(() => {
    setVisitorLoadState("loading");
    fetchVisitorsDirectoryApi()
      .then((rows) => {
        // 组件已卸载时忽略结果
        if (!mountedRef.current) return;
        setVisitors(rows);
        setVisitorLoadState("ok");
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setVisitorLoadState("err");
      });
  }, []);

  /**
   * 构建 visitorId → visitorName 映射表，用于模板标签快速展示昵称。
   */
  const visitorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of visitors) map.set(v.visitorId, v.visitorName);
    return map;
  }, [visitors]);

  /**
   * 加载已保存的成员模板列表。
   */
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

  /**
   * 组件挂载后自动加载模板列表。
   */
  useEffect(() => { void reload(); }, [reload]);

  /**
   * 将已选 visitorId 转换为 VisitorPickerContent 需要的行数据格式。
   */
  const selectedPickedRows = useMemo(() => {
    return pickedIds.map((id) => {
      const v = visitors.find((x) => x.visitorId === id);
      return { visitorId: id, name: v ? v.visitorName : t("visitorPickerUnknownVisitor"), muted: !v };
    });
  }, [pickedIds, visitors, t]);

  /**
   * 切换某个访客的选中状态。
   */
  function toggleVisitor(id: string): void {
    setPickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /**
   * 判断当前步骤是否可以进入下一步：第 1 步要求名称非空，第 2 步要求至少选 1 人。
   */
  const canGoNext =
    currentStep === 1 ? displayName.trim().length > 0 : currentStep === 2 ? pickedIds.length > 0 : true;

  /**
   * 进入下一步，若校验不通过则显示验证提示。
   */
  function goNext(): void {
    // 已经在最后一步，不能再前进
    if (currentStep >= 3) return;
    // 校验不通过，显示验证错误
    if (!canGoNext) {
      setShowValidation(true);
      return;
    }
    // 隐藏验证错误，进入下一步
    setShowValidation(false);
    setCurrentStep((currentStep + 1) as WizardStep);
    // 进入下一步时清空搜索过滤词
    setSearchFilter("");
  }

  /**
   * 返回上一步。
   */
  function goBack(): void {
    // 已经在第一步，不能再后退
    if (currentStep <= 1) return;
    setShowValidation(false);
    setCurrentStep((currentStep - 1) as WizardStep);
  }

  /**
   * 重置为新建模板状态，默认把自己加入已选成员。
   */
  function startNew(): void {
    // 关闭删除确认弹窗
    setConfirmDeleteId(null);
    // 清除编辑状态
    setEditingId(null);
    // 清空模板名称
    setDisplayName("");
    // 默认把自己加入已选成员（用户可取消）
    setPickedIds(myVisitorId ? [myVisitorId] : []);
    // 清空错误
    setError(null);
    // 回到第一步
    setCurrentStep(1);
    // 清空搜索过滤词
    setSearchFilter("");
    // 隐藏验证提示
    setShowValidation(false);
  }

  /**
   * 进入编辑模板状态：填充已有数据，并确保当前访客在名单中。
   */
  function startEdit(row: DomainMemberTemplate): void {
    // 关闭删除确认弹窗
    setConfirmDeleteId(null);
    // 设置正在编辑的模板 ID
    setEditingId(row.id);
    // 填充模板名称
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

  /**
   * 保存模板：根据 editingId 区分新建或更新，成功后重置表单并刷新列表。
   */
  async function handleSave(): Promise<void> {
    // 前置校验：名称和成员都不能为空
    if (!displayName.trim() || pickedIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId === null) {
        // 新建模板
        await createDomainMemberTemplateApi({ displayName: displayName.trim(), visitorIds: pickedIds });
      } else {
        // 更新已有模板
        await updateDomainMemberTemplateApi(editingId, {
          displayName: displayName.trim(),
          visitorIds: pickedIds,
        });
      }
      // 组件已卸载时不更新状态
      if (!mountedRef.current) return;
      // 重置为新建状态
      startNew();
      // 刷新模板列表
      await reload();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(translateError(t, err));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  /**
   * 确认删除模板：若正在编辑该模板则重置表单，然后刷新列表。
   */
  async function handleDeleteConfirmed(id: number): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await deleteDomainMemberTemplateApi(id);
      if (!mountedRef.current) return;
      // 关闭删除确认弹窗
      setConfirmDeleteId(null);
      // 如果正在编辑该模板，重置表单
      if (editingId === id) startNew();
      await reload();
    } catch (err) {
      if (!mountedRef.current) return;
      setError(translateError(t, err));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  /**
   * 向导三步标签定义。
   */
  const steps: { key: WizardStep; label: string }[] = [
    { key: 1, label: t("memberTemplateStepName") },
    { key: 2, label: t("memberTemplateStepMembers") },
    { key: 3, label: t("memberTemplateStepSave") },
  ];

  /**
   * 计算进度条宽度（第 1 步 0%，第 2 步 50%，第 3 步 100%）。
   */
  const progressWidth = `${((currentStep - 1) / 2) * 100}%`;

  return (
    <div className="mdocs-settings">
      {/* 头部标题 */}
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">
          {/* 根据是否在编辑状态显示不同标题 */}
          {editingId !== null ? t("memberTemplateUpdate") : t("memberTemplateFormNew")}
        </h2>
        {/* 编辑状态下显示「取消编辑」按钮 */}
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
                {/* 步骤圆圈：已完成显示 ✓，当前显示数字 */}
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

      {/* 错误提示 */}
      {error && (
        <div className="mdocs-settings-item-desc" style={{ color: "var(--mdocs-danger)", marginBottom: 12, marginTop: 12 }}>
          {error}
        </div>
      )}

      <div className="mdocs-settings-cards">
        {/* 向导卡片 */}
        <div className="mdocs-settings-card mdocs-wizard-card">
          {/* 步骤 1：填写模板名称 */}
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
                // 校验失败时标记输入框为错误状态
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

          {/* 步骤 3：确认并保存 */}
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
                {/* 展示已选成员标签（最多 15 个） */}
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

          {/* 底部导航按钮 */}
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
              {/* 只有在未编辑状态下才显示「创建第一个模板」按钮 */}
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
                  {/* 删除确认状态 */}
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
                        {/* 展示成员标签（用昵称或 ID 前 6 位） */}
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
