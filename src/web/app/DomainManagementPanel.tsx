import { useI18n } from "../i18n";
import { useDomainManagement } from "./hooks/useDomainManagement";
import {
  DOMAIN_PERMISSIONS,
  isBuiltInDomainId,
  isDomainCreator,
  isDomainStructurallyLocked,
} from "@shared/domainUi";

export function DomainManagementPanel() {
  const { t } = useI18n();
  const dm = useDomainManagement(true);

  return (
    <div className="mdocs-settings">
      <div className="mdocs-settings-header">
        <h2 className="mdocs-settings-title">{t("domainManagement")}</h2>
      </div>
      <div className="mdocs-settings-cards">
        <div className="mdocs-settings-card mdocs-domain-mgmt-create">
          <div className="mdocs-settings-card-title">{t("createDomain")}</div>
          <form onSubmit={dm.handleCreateDomain} className="mdocs-domain-mgmt-create-form">
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
            <button type="submit" className="primary mdocs-domain-mgmt-submit" disabled={dm.creating}>
              {dm.creating ? t("creating") : t("create")}
            </button>
          </form>
        </div>

        {dm.domainError && (
          <div className="mdocs-settings-card mdocs-domain-error">
            <span className="mdocs-settings-item-desc" style={{ color: "var(--mdocs-danger)" }}>
              {dm.domainError}
            </span>
          </div>
        )}

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
            {(["all", ...DOMAIN_PERMISSIONS] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={"mdocs-domain-mgmt-filter" + (dm.domainFilter === f ? " active" : "")}
                onClick={() => dm.setDomainFilter(f)}
              >
                {f === "all" ? t("domainFilterAll") : dm.plabel(f)}
              </button>
            ))}
          </div>
        </div>

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
                  const isOwner = isDomainCreator(d, dm.visitorId);
                  const isBuiltIn = isBuiltInDomainId(d.domainId);
                  const locked = isDomainStructurallyLocked(d);
                  const typeTitle = locked ? t("domainTooltipTypeLocked", { count: String(d.docCount) }) : undefined;
                  return (
                    <tr key={d.domainId} className={isBuiltIn ? "mdocs-domain-table-row-builtin" : undefined}>
                      <td>
                        {dm.renamingId === d.domainId ? (
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
                            {isBuiltIn && <span className="mdocs-domain-badge-builtin">{t("domainBuiltIn")}</span>}
                            {!isOwner && !isBuiltIn && (
                              <span className="mdocs-domain-badge-shared">{t("shared")}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="mdocs-domain-table-type" title={typeTitle}>
                          <span className="mdocs-domain-permission-badge" data-permission={d.permission}>
                            {dm.domainTypeLabel(d, isBuiltIn)}
                          </span>
                          {locked && !isBuiltIn && (
                            <span className="mdocs-domain-type-lock" aria-hidden="true">
                              &#128274;
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="mdocs-domain-table-num">{d.docCount}</td>
                      <td className="mdocs-domain-table-actions">
                        {isBuiltIn && (
                          <span className="mdocs-domain-not-modifiable">{t("domainNotModifiable")}</span>
                        )}
                        {!isBuiltIn && !isOwner && (
                          <span className="mdocs-domain-not-creator-inline">{t("domainNotCreator")}</span>
                        )}
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
    </div>
  );
}
