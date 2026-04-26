import { useI18n } from "../i18n";

export function SettingsPage(props: {
  onBack: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  const { onBack } = props;
  return (
    <>
      <aside className="mdocs-sidebar">
        <header className="mdocs-sidebar-header">
          <div className="mdocs-brand">{t("brand")}</div>
        </header>
        <nav className="mdocs-config-tree">
          <div className="mdocs-config-item active">
            {t("general")}
          </div>
        </nav>
        <footer className="mdocs-settings-sidebar-footer" onClick={onBack}>
          {t("backToDocs")}
        </footer>
      </aside>
      <main className="mdocs-main">
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
      </main>
    </>
  );
}
