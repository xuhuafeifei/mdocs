import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { DraftListPage } from "./DraftListPage";
import mdocsLogo from "../assets/mdocs-logo.svg";

function getBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key);
  if (v === null) return def;
  return v === "true";
}

type SettingsTab = "general" | "savePublish";

export function SettingsPage(props: {
  onBack: () => void;
  onPublishDraft: (docId: string) => void;
}) {
  const { t, lang, setLang } = useI18n();
  const { onBack, onPublishDraft } = props;
  const [autoSave, setAutoSave] = useState(() => getBool("mdocs.autoSave", true));
  const [autoPublish, setAutoPublish] = useState(() => getBool("mdocs.autoPublish", false));
  const [showDrafts, setShowDrafts] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("general");

  useEffect(() => {
    localStorage.setItem("mdocs.autoSave", String(autoSave));
  }, [autoSave]);

  useEffect(() => {
    localStorage.setItem("mdocs.autoPublish", String(autoPublish));
  }, [autoPublish]);

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
        {showDrafts ? (
          <div className="mdocs-settings">
            <DraftListPage
              onPublish={onPublishDraft}
              onClose={() => setShowDrafts(false)}
            />
          </div>
        ) : tab === "general" ? (
          <div className="mdocs-settings">
            <div className="mdocs-settings-header">
              <h2 className="mdocs-settings-title">{t("general")}</h2>
            </div>
            <div className="mdocs-settings-section">
              <label className="mdocs-settings-label">{t("language")}</label>
              <div className="mdocs-settings-lang">
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
              </div>
            </div>
          </div>
        ) : (
          <div className="mdocs-settings">
            <div className="mdocs-settings-header">
              <h2 className="mdocs-settings-title">{t("saveAndPublish")}</h2>
            </div>
            <div className="mdocs-settings-section">
              <label className="mdocs-settings-toggle">
                <span>
                  <div className="mdocs-settings-label">{t("autoSave")}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{t("autoSaveDesc")}</div>
                </span>
                <button
                  type="button"
                  className={"mdocs-toggle" + (autoSave ? " active" : "")}
                  role="switch"
                  aria-checked={autoSave}
                  onClick={() => setAutoSave((v) => !v)}
                >
                  <span className="mdocs-toggle-knob" />
                </button>
              </label>
            </div>
            <div className="mdocs-settings-section">
              <label className="mdocs-settings-toggle">
                <span>
                  <div className="mdocs-settings-label">{t("autoPublish")}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{t("autoPublishDesc")}</div>
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
            <div className="mdocs-settings-section">
              <label className="mdocs-settings-label">{t("unpublishedDrafts")}</label>
              <button type="button" onClick={() => setShowDrafts(true)}>
                {t("unpublishedDrafts")}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
