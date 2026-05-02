import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { DraftListPage } from "./DraftListPage";
import { listAllDrafts } from "../storage/drafts";
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
  const [autoEdit, setAutoEdit] = useState(() => getBool("mdocs.autoEdit", true));
  const [showDrafts, setShowDrafts] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("general");
  const [warnModal, setWarnModal] = useState(false);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    localStorage.setItem("mdocs.autoSave", String(autoSave));
  }, [autoSave]);

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

  const handleAutoSaveToggle = useCallback(() => {
    if (autoSave) {
      setWarnModal(true);
    } else {
      setAutoSave(true);
    }
  }, [autoSave]);

  function confirmTurnOff(): void {
    setAutoSave(false);
    setWarnModal(false);
  }

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
        ) : (
          <div className="mdocs-settings">
            <div className="mdocs-settings-header">
              <h2 className="mdocs-settings-title">{t("saveAndPublish")}</h2>
              <button type="button" className="secondary" onClick={onBack}>
                {t("backToDocs")}
              </button>
            </div>

            <div className="mdocs-settings-cards">
              {/* Auto-save hero section */}
              <div className="mdocs-settings-card mdocs-settings-hero">
                <label className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">
                      <span className="mdocs-settings-hero-icon" aria-hidden="true">🛡️</span>
                      {t("autoSave")}
                      <span className="mdocs-settings-badge">{t("autoSaveBadge")}</span>
                    </span>
                    <span className="mdocs-settings-item-desc">{t("autoSaveDesc")}</span>
                  </span>
                  <button
                    type="button"
                    className={"mdocs-toggle" + (autoSave ? " active" : "")}
                    role="switch"
                    aria-checked={autoSave}
                    onClick={handleAutoSaveToggle}
                  >
                    <span className="mdocs-toggle-knob" />
                  </button>
                </label>
              </div>

              {/* Auto-publish standard item */}
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

              {/* Drafts */}
              {draftCount > 0 ? (
                <button className="mdocs-settings-card mdocs-settings-draft-link" onClick={() => setShowDrafts(true)}>
                  <span className="mdocs-settings-draft-link-text">📄 {t("viewDrafts")} ({draftCount})</span>
                  <span className="mdocs-settings-draft-arrow" aria-hidden="true">›</span>
                </button>
              ) : (
                <div className="mdocs-settings-card mdocs-settings-draft-empty">
                  <span className="mdocs-settings-item-desc">{t("noDrafts")}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DraftListPage overlay — always on top of settings content */}
        {showDrafts && (
          <DraftListPage
            onPublish={onPublishDraft}
            onClose={() => setShowDrafts(false)}
            onCountChange={setDraftCount}
          />
        )}

        {/* Warning modal for turning off auto-save */}
        {warnModal && (
          <div
            className="mdocs-dialog-backdrop"
            role="presentation"
            onMouseDown={(ev) => {
              if (ev.target === ev.currentTarget) setWarnModal(false);
            }}
          >
            <div className="mdocs-dialog card" role="dialog" aria-modal="true">
              <h1>⚠️ {t("autoSaveTurnOffTitle")}</h1>
              <p className="muted">{t("autoSaveTurnOffBody")}</p>
              <div className="mdocs-dialog-actions">
                <button type="button" className="primary" onClick={() => setWarnModal(false)}>
                  {t("autoSaveTurnOffCancel")}
                </button>
                <button type="button" className="danger" onClick={confirmTurnOff}>
                  {t("autoSaveTurnOffConfirm")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
