import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { DraftListPage } from "./DraftListPage";
import { listAllDrafts } from "../storage/drafts";
import { DomainManagementPanel } from "./DomainManagementPanel";
import { MemberTemplatesPanel } from "./MemberTemplatesPanel";
import mdocsLogo from "../assets/mdocs-logo.svg";

function getBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key);
  if (v === null) return def;
  return v === "true";
}

type SettingsTab = "general" | "domainManagement" | "memberTemplates" | "savePublish";

export function SettingsPage(props: {
  onBack: () => void;
  onPublishDraft: (docId: string) => void;
}) {
  const { t, lang, setLang } = useI18n();
  const { onBack, onPublishDraft } = props;
  const [autoPublish, setAutoPublish] = useState(() => getBool("mdocs.autoPublish", false));
  const [autoEdit, setAutoEdit] = useState(() => getBool("mdocs.autoEdit", true));
  const [showDrafts, setShowDrafts] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("general");
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    localStorage.setItem("mdocs.autoPublish", String(autoPublish));
  }, [autoPublish]);

  useEffect(() => {
    localStorage.setItem("mdocs.autoEdit", String(autoEdit));
  }, [autoEdit]);

  useEffect(() => {
    if (tab === "savePublish") {
      listAllDrafts().then((drafts) => {
        setDraftCount(drafts.filter((d) => !d.published).length);
      });
    }
  }, [tab]);

  return (
    <>
      <aside className="mdocs-sidebar">
        <header className="mdocs-sidebar-header">
          <div className="mdocs-brand">
            <img src={mdocsLogo} alt={t("brand")} className="mdocs-brand-logo" />
            <span>{t("brand")}</span>
          </div>
        </header>
        <nav className="mdocs-config-tree">
          <div
            className={"mdocs-config-item" + (tab === "general" ? " active" : "")}
            onClick={() => setTab("general")}
          >
            {t("general")}
          </div>
          <div
            className={"mdocs-config-item" + (tab === "domainManagement" ? " active" : "")}
            onClick={() => setTab("domainManagement")}
          >
            {t("domainManagement")}
          </div>
          <div
            className={"mdocs-config-item" + (tab === "memberTemplates" ? " active" : "")}
            onClick={() => setTab("memberTemplates")}
          >
            {t("memberTemplates")}
          </div>
          <div
            className={"mdocs-config-item" + (tab === "savePublish" ? " active" : "")}
            onClick={() => setTab("savePublish")}
          >
            {t("saveAndPublish")}
          </div>
        </nav>
        <footer className="mdocs-settings-sidebar-footer" onClick={onBack}>
          {t("backToDocs")}
        </footer>
      </aside>
      <main className="mdocs-main">
        {tab === "general" ? (
          <div className="mdocs-settings">
            <div className="mdocs-settings-header">
              <h2 className="mdocs-settings-title">{t("general")}</h2>
            </div>
            <div className="mdocs-settings-cards">
              <div className="mdocs-settings-card">
                <label className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">{t("language")}</span>
                  </span>
                  <span className="mdocs-settings-lang">
                    <button
                      type="button"
                      className={lang === "en" ? "active" : ""}
                      onClick={() => setLang("en")}
                    >
                      EN
                    </button>
                    <span>/</span>
                    <button
                      type="button"
                      className={lang === "zh" ? "active" : ""}
                      onClick={() => setLang("zh")}
                    >
                      中
                    </button>
                  </span>
                </label>
              </div>

              <div className="mdocs-settings-card">
                <label className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">{t("autoEdit")}</span>
                    <span className="mdocs-settings-item-desc">{t("autoEditDesc")}</span>
                  </span>
                  <button
                    type="button"
                    className={"mdocs-toggle" + (autoEdit ? " active" : "")}
                    role="switch"
                    aria-checked={autoEdit}
                    onClick={() => setAutoEdit((v) => !v)}
                  >
                    <span className="mdocs-toggle-knob" />
                  </button>
                </label>
              </div>
            </div>
          </div>
        ) : tab === "domainManagement" ? (
          <DomainManagementPanel />
        ) : tab === "memberTemplates" ? (
          <MemberTemplatesPanel />
        ) : (
          <div className="mdocs-settings">
            <div className="mdocs-settings-header">
              <h2 className="mdocs-settings-title">{t("saveAndPublish")}</h2>
              <button type="button" className="secondary" onClick={onBack}>
                {t("backToDocs")}
              </button>
            </div>

            <div className="mdocs-settings-cards">
              <div className="mdocs-settings-card">
                <label className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">{t("autoSave")}</span>
                    <span className="mdocs-settings-item-desc">{t("autoSaveAlwaysOnDesc")}</span>
                  </span>
                  <span
                    className="mdocs-toggle active"
                    role="switch"
                    aria-checked="true"
                    aria-disabled="true"
                    style={{ opacity: 0.6, cursor: "not-allowed" }}
                  >
                    <span className="mdocs-toggle-knob" />
                  </span>
                </label>
              </div>

              <div className="mdocs-settings-card">
                <label className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">{t("autoPublish")}</span>
                    <span className="mdocs-settings-item-desc">{t("autoPublishDesc")}</span>
                  </span>
                  <button
                    type="button"
                    className={"mdocs-toggle" + (autoPublish ? " active" : "")}
                    role="switch"
                    aria-checked={autoPublish}
                    onClick={() => setAutoPublish((v) => !v)}
                  >
                    <span className="mdocs-toggle-knob" />
                  </button>
                </label>
              </div>

              {draftCount > 0 ? (
                <button className="mdocs-settings-card mdocs-settings-draft-link" onClick={() => setShowDrafts(true)}>
                  <span className="mdocs-settings-draft-link-text">
                    📄 {t("viewDrafts")} ({draftCount})
                  </span>
                  <span className="mdocs-settings-draft-arrow" aria-hidden="true">
                    ›
                  </span>
                </button>
              ) : (
                <div className="mdocs-settings-card mdocs-settings-draft-empty">
                  <span className="mdocs-settings-item-desc">{t("noDrafts")}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {showDrafts && (
          <DraftListPage
            onPublish={onPublishDraft}
            onClose={() => setShowDrafts(false)}
            onCountChange={setDraftCount}
          />
        )}
      </main>
    </>
  );
}
