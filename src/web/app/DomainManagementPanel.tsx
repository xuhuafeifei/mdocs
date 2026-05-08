/**
 * 域管理面板
 * 设置页面中的「域管理」Tab 内容。
 * 支持：创建新域、搜索/过滤域列表、重命名、修改权限、删除域。
 * 受限域支持通过弹窗管理成员（访客选择器）。
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { useDomainManagement } from "./hooks/useDomainManagement";
import {
  fetchDomainMemberTemplatesApi,
  fetchDomainMembersApi,
  putDomainMembersApi,
} from "../services/endpoints";
import type { DomainMemberListEntry, DomainSummary } from "../../shared/types/domain";
import type { DomainMemberTemplate } from "../../shared/types/domainMemberTemplate";
import {
  DOMAIN_PERMISSIONS,
  isBuiltInDomainId,
  isDomainCreator,
  isDomainStructurallyLocked,
} from "@shared/domainUi";
import { translateError } from "./utils";
import { VisitorPickerModal } from "./VisitorPickerModal";

export function DomainManagementPanel() {
  const { t } = useI18n();

  // ---- 使用 DomainManagement Hook 管理域列表和相关操作 ----
  const dm = useDomainManagement();

  // ---- 成员模板列表（用于成员管理弹窗中的模板套用） ----
  const [templates, setTemplates] = useState<DomainMemberTemplate[]>([]);

  // ---- 导入成员后的提示横幅（成功/失败） ----
  const [importBanner, setImportBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // ---- 成员管理弹窗状态 ----
  const [memberModal, setMemberModal] = useState<{
    domainId: string;
    creatorVisitorId: string;
    initialIds: string[];
    memberRows: DomainMemberListEntry[];
  } | null>(null);

  /**
   * 加载成员模板列表（容错：失败时清空）。
   */
  const loadTemplates = useCallback(async () => {
    try {
      const rows = await fetchDomainMemberTemplatesApi();
      setTemplates(rows);
    } catch {
      setTemplates([]);
    }
  }, []);

  /**
   * 挂载后自动加载成员模板列表。
   */
  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  /**
   * 打开成员管理弹窗：加载该域的现有成员列表作为初始已选项。
   */
  async function openMemberModal(d: DomainSummary): Promise<void> {
    // 清空之前的导入提示
    setImportBanner(null);
    try {
      // 从后端获取该域的当前成员列表
      const members = await fetchDomainMembersApi(d.domainId);
      setMemberModal({
        domainId: d.domainId,
        creatorVisitorId: d.creatorVisitorId,
        // 提取成员 ID 作为初始已选项
        initialIds: members.map((m) => m.visitorId),
        memberRows: members,
      });
    } catch (err) {
      setImportBanner({ kind: "err", text: translateError(t, err) });
    }
  }

  return (
    <div className="mdocs-settings">
      {/* 头部标题 */}
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">{t("domainManagement")}</h2>
      </div>
      {/* 受限域成员管理提示 */}
      <p className="mdocs-domain-mgmt-restricted-hint">{t("domainMgmtRestrictedMemberHint")}</p>
      <div className="mdocs-settings-cards">
        {/* 创建新域表单 */}
        <div className="mdocs-settings-card mdocs-domain-mgmt-create">
          <div className="mdocs-settings-card-title">{t("createDomain")}</div>
          <form onSubmit={dm.handleCreateDomain} className="mdocs-domain-mgmt-create-form">
            {/* 域名称输入 */}
            <label className="mdocs-domain-mgmt-field">
              <span className="mdocs-domain-mgmt-label">{t("domainName")}</span>
              <input
                value={dm.newDomainName}
                onChange={(e) => dm.setNewDomainName(e.target.value)}
                placeholder={t("domainName")}
                maxLength={100}
                disabled={dm.creating}
                className="mdocs-domain-name-input"
              />
            </label>
            {/* 域权限选择 */}
            <fieldset className="mdocs-domain-mgmt-fieldset">
              <legend className="mdocs-domain-mgmt-label">{t("domainPermission")}</legend>
              <div className="mdocs-domain-mgmt-type-radios">
                {DOMAIN_PERMISSIONS.map((p) => (
                  <label key={p} className="mdocs-domain-mgmt-radio">
                    <input
                      type="radio"
                      name="newDomainPermission"
                      checked={dm.newDomainPermission === p}
                      onChange={() => dm.setNewDomainPermission(p)}
                      disabled={dm.creating}
                    />
                    <span>{dm.plabel(p)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {/* 提交按钮 */}
            <button type="submit" className="primary mdocs-domain-mgmt-submit" disabled={dm.creating}>
              {dm.creating ? t("creating") : t("create")}
            </button>
          </form>
        </div>

        {/* 导入成员结果提示 */}
        {importBanner && (
          <div
            className="mdocs-settings-card"
            style={{
              color: importBanner.kind === "ok" ? "var(--mdocs-success, #0a7)" : "var(--mdocs-danger)",
            }}
          >
            <span className="mdocs-settings-item-desc">{importBanner.text}</span>
          </div>
        )}

        {/* 域操作错误提示 */}
        {dm.domainError && (
          <div className="mdocs-settings-card mdocs-domain-error">
            <span className="mdocs-settings-item-desc" style={{ color: "var(--mdocs-danger)" }}>
              {dm.domainError}
            </span>
          </div>
        )}

        {/* 搜索和过滤工具栏 */}
        <div className="mdocs-settings-card mdocs-domain-mgmt-toolbar">
          <input
            type="search"
            value={dm.domainSearch}
            onChange={(e) => dm.setDomainSearch(e.target.value)}
            placeholder={t("domainSearchPlaceholder")}
            className="mdocs-domain-mgmt-search"
            aria-label={t("domainSearchPlaceholder")}
          />
          <div className="mdocs-domain-mgmt-filters" role="group" aria-label={t("domainPermission")}>
            {/* 全部 + 三种权限类型的过滤按钮 */}
            {(["all", ...DOMAIN_PERMISSIONS] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={"mdocs-domain-mgmt-filter" + (dm.domainFilter === f ? " active" : "")}
                aria-pressed={dm.domainFilter === f}
                onClick={() => dm.setDomainFilter(f)}
              >
                {f === "all" ? t("domainFilterAll") : dm.plabel(f)}
              </button>
            ))}
          </div>
        </div>

        {/* 域列表表格 */}
        {dm.loadingDomains ? (
          <div className="mdocs-settings-card">
            <span className="mdocs-settings-item-desc">{t("loading")}</span>
          </div>
        ) : dm.domains.length === 0 ? (
          <div className="mdocs-settings-card mdocs-settings-draft-empty">
            <span className="mdocs-settings-item-desc">{t("noDomains")}</span>
          </div>
        ) : dm.filteredDomains.length === 0 ? (
          <div className="mdocs-settings-card mdocs-settings-draft-empty">
            <span className="mdocs-settings-item-desc">{t("domainNoMatch")}</span>
          </div>
        ) : (
          <div className="mdocs-settings-card mdocs-domain-table-wrap">
            <table className="mdocs-domain-table">
              <thead>
                <tr>
                  <th scope="col">{t("domainColName")}</th>
                  <th scope="col">{t("domainColType")}</th>
                  <th scope="col" className="mdocs-domain-table-num">
                    {t("domainColDocCount")}
                  </th>
                  <th scope="col">{t("domainColActions")}</th>
                </tr>
              </thead>
              <tbody>
                {dm.filteredDomains.map((d) => {
                  // 判断当前访客是否是该域的创建者
                  const isOwner = isDomainCreator(d, dm.visitorId);
                  // 判断是否是系统内置域（如 Default、个人域）
                  const isBuiltIn = isBuiltInDomainId(d.domainId);
                  // 判断域是否被锁定（有文档时不可修改类型或删除）
                  const locked = isDomainStructurallyLocked(d);
                  // 锁定时的提示文字
                  const typeTitle = locked ? t("domainTooltipTypeLocked", { count: String(d.docCount) }) : undefined;
                  return (
                    <tr key={d.domainId} className={isBuiltIn ? "mdocs-domain-table-row-builtin" : undefined}>
                      {/* 域名列 */}
                      <td>
                        {dm.renamingId === d.domainId ? (
                          // 重命名状态：显示输入框和保存/取消按钮
                          <div className="mdocs-domain-table-rename">
                            <input
                              value={dm.renameDraft}
                              onChange={(e) => dm.setRenameDraft(e.target.value)}
                              maxLength={100}
                              autoFocus
                              className="mdocs-domain-name-input"
                            />
                            <button type="button" className="primary" onClick={() => void dm.handleRename(d.domainId)}>
                              {t("save")}
                            </button>
                            <button type="button" onClick={dm.cancelRename}>
                              {t("cancel")}
                            </button>
                          </div>
                        ) : (
                          <div className="mdocs-domain-table-name-cell">
                            <span className="mdocs-domain-table-name">{dm.localizeDomain(d)}</span>
                            {/* 内置域标记 */}
                            {isBuiltIn && <span className="mdocs-domain-badge-builtin">{t("domainBuiltIn")}</span>}
                            {/* 共享域标记（非内置且非创建者） */}
                            {!isOwner && !isBuiltIn && (
                              <span className="mdocs-domain-badge-shared">{t("shared")}</span>
                            )}
                          </div>
                        )}
                      </td>
                      {/* 权限类型列 */}
                      <td>
                        <span className="mdocs-domain-table-type" title={typeTitle}>
                          <span className="mdocs-domain-permission-badge" data-permission={d.permission}>
                            {dm.domainTypeLabel(d, isBuiltIn)}
                          </span>
                          {/* 锁定图标 */}
                          {locked && !isBuiltIn && (
                            <span className="mdocs-domain-type-lock" aria-hidden="true">
                              &#128274;
                            </span>
                          )}
                        </span>
                      </td>
                      {/* 文档数量列 */}
                      <td className="mdocs-domain-table-num">{d.docCount}</td>
                      {/* 操作列 */}
                      <td className="mdocs-domain-table-actions">
                        {/* 内置域不可修改 */}
                        {isBuiltIn && (
                          <span className="mdocs-domain-not-modifiable">{t("domainNotModifiable")}</span>
                        )}
                        {/* 非内置域且非创建者时提示无权修改 */}
                        {!isBuiltIn && !isOwner && (
                          <span className="mdocs-domain-not-creator-inline">{t("domainNotCreator")}</span>
                        )}
                        {/* 修改权限面板 */}
                        {!isBuiltIn && isOwner && dm.changeTypeForId === d.domainId && (
                          <div className="mdocs-domain-change-type-panel">
                            <div className="mdocs-domain-permission-select">
                              {DOMAIN_PERMISSIONS.map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  className={d.permission === p ? "active" : ""}
                                  onClick={() => void dm.handlePermissionChange(d.domainId, p)}
                                >
                                  {dm.plabel(p)}
                                </button>
                              ))}
                            </div>
                            <button type="button" className="secondary" onClick={() => dm.setChangeTypeForId(null)}>
                              {t("cancel")}
                            </button>
                          </div>
                        )}
                        {/* 操作按钮组：重命名、改类型、删除、管理成员 */}
                        {!isBuiltIn &&
                          isOwner &&
                          dm.renamingId !== d.domainId &&
                          dm.changeTypeForId !== d.domainId && (
                            <div className="mdocs-domain-action-buttons">
                              <button
                                type="button"
                                className="secondary"
                                title={locked ? t("domainLocked") : undefined}
                                onClick={() => {
                                  dm.setChangeTypeForId(null);
                                  dm.startRename(d);
                                }}
                                disabled={locked}
                              >
                                {t("rename")}
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                title={locked ? typeTitle : undefined}
                                onClick={() => {
                                  dm.setRenamingId(null);
                                  dm.setChangeTypeForId(d.domainId);
                                }}
                                disabled={locked}
                              >
                                {t("domainChangeType")}
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                title={locked ? t("domainLocked") : undefined}
                                onClick={() => void dm.handleDelete(d)}
                                disabled={locked}
                              >
                                {t("deleteDomain")}
                              </button>
                              {/* 受限域显示成员管理按钮 */}
                              {d.permission === "restricted" && !isBuiltIn && (
                                <button type="button" className="secondary" onClick={() => void openMemberModal(d)}>
                                  {t("domainMembersManageButton")}
                                </button>
                              )}
                            </div>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 成员管理弹窗 */}
      <VisitorPickerModal
        open={memberModal !== null}
        title={t("domainMembersPickerTitle")}
        initialSelectedIds={memberModal?.initialIds ?? []}
        // 域创建者不可取消勾选
        lockedIds={memberModal ? [memberModal.creatorVisitorId] : []}
        seedMembers={memberModal?.memberRows}
        templates={templates}
        onClose={() => setMemberModal(null)}
        onConfirm={async (visitorIds) => {
          if (!memberModal) return;
          // 调用 API 更新域成员列表
          await putDomainMembersApi(memberModal.domainId, visitorIds);
          setImportBanner({
            kind: "ok",
            text: t("domainMembersSaved", { count: String(visitorIds.length) }),
          });
        }}
      />
    </div>
  );
}
