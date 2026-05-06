/**
 * 设置页面组件
 * 提供侧边栏 Tab 导航，包含四个设置模块：
 * 1. 通用设置（语言、自动编辑）
 * 2. 域管理（创建/重命名/删除域）
 * 3. 成员模板（保存常用访客列表）
 * 4. 保存与发布（自动同步开关、未发布草稿列表）
 */
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { DraftListPage } from "./DraftListPage";
import { listAllDrafts } from "../storage/drafts";
import { DomainManagementPanel } from "./DomainManagementPanel";
import { MemberTemplatesPanel } from "./MemberTemplatesPanel";
import mdocsLogo from "../assets/mdocs-logo.svg";

/**
 * 从 localStorage 读取布尔值，不存在时返回默认值。
 */
function getBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key);
  // 如果 key 不存在，返回默认值
  if (v === null) return def;
  // localStorage 只存储字符串，"true" 表示 true，其他表示 false
  return v === "true";
}

type SettingsTab = "general" | "domainManagement" | "memberTemplates" | "savePublish";

export function SettingsPage(props: {
  onBack: () => void;
  onPublishDraft: (docId: string) => void;
}) {
  const { t, lang, setLang } = useI18n();
  const { onBack, onPublishDraft } = props;

  // ---- 自动同步开关（推送到服务器） ----
  const [autoPublish, setAutoPublish] = useState(() => getBool("mdocs.autoPublish", false));

  // ---- 自动编辑开关（打开文档时自动进入编辑模式） ----
  const [autoEdit, setAutoEdit] = useState(() => getBool("mdocs.autoEdit", true));

  // ---- 是否展示草稿列表抽屉 ----
  const [showDrafts, setShowDrafts] = useState(false);

  // ---- 当前激活的 Tab ----
  const [tab, setTab] = useState<SettingsTab>("general");

  // ---- 未发布草稿数量（用于徽标显示） ----
  const [draftCount, setDraftCount] = useState(0);

  /**
   * 自动同步开关变更时持久化到 localStorage。
   */
  useEffect(() => {
    localStorage.setItem("mdocs.autoPublish", String(autoPublish));
  }, [autoPublish]);

  /**
   * 自动编辑开关变更时持久化到 localStorage。
   */
  useEffect(() => {
    localStorage.setItem("mdocs.autoEdit", String(autoEdit));
  }, [autoEdit]);

  /**
   * 切换到「保存与发布」Tab 时，统计未发布草稿数量用于展示徽标。
   */
  useEffect(() => {
    if (tab === "savePublish") {
      listAllDrafts().then((drafts) => {
        // 过滤掉已标记为发布的草稿，统计真正的未发布数量
        setDraftCount(drafts.filter((d) => !d.published).length);
      });
    }
  }, [tab]);

  return (
    <>
      {/* ========== 左侧设置导航栏 ========== */}
      <aside className="mdocs-sidebar">
        <header className="mdocs-sidebar-header">
          <div className="mdocs-brand">
            <img src={mdocsLogo} alt={t("brand")} className="mdocs-brand-logo" />
            <span>{t("brand")}</span>
          </div>
        </header>
        <nav className="mdocs-config-tree">
          {/* 通用设置 Tab */}
          <div
            className={"mdocs-config-item" + (tab === "general" ? " active" : "")}
            onClick={() => setTab("general")}
          >
            {t("general")}
          </div>
          {/* 域管理 Tab */}
          <div
            className={"mdocs-config-item" + (tab === "domainManagement" ? " active" : "")}
            onClick={() => setTab("domainManagement")}
          >
            {t("domainManagement")}
          </div>
          {/* 成员模板 Tab */}
          <div
            className={"mdocs-config-item" + (tab === "memberTemplates" ? " active" : "")}
            onClick={() => setTab("memberTemplates")}
          >
            {t("memberTemplates")}
          </div>
          {/* 保存与发布 Tab */}
          <div
            className={"mdocs-config-item" + (tab === "savePublish" ? " active" : "")}
            onClick={() => setTab("savePublish")}
          >
            {t("saveAndPublish")}
          </div>
        </nav>
        {/* 底部返回按钮 */}
        <footer className="mdocs-settings-sidebar-footer" onClick={onBack}>
          {t("backToDocs")}
        </footer>
      </aside>

      {/* ========== 主内容区 ========== */}
      <main className="mdocs-main">
        {tab === "general" ? (
          // ---- 通用设置 Tab ----
          <div className="mdocs-settings">
            <div className="mdocs-settings-header">
              <h2 className="mdocs-settings-title">{t("general")}</h2>
            </div>
            <div className="mdocs-settings-cards">
              {/* 语言设置卡片 */}
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

              {/* 自动编辑设置卡片 */}
              <div className="mdocs-settings-card">
                <label className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">{t("autoEdit")}</span>
                    <span className="mdocs-settings-item-desc">{t("autoEditDesc")}</span>
                  </span>
                  {/* 开关按钮 */}
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
          // ---- 域管理 Tab ----
          <DomainManagementPanel />
        ) : tab === "memberTemplates" ? (
          // ---- 成员模板 Tab ----
          <MemberTemplatesPanel />
        ) : (
          // ---- 保存与发布 Tab ----
          <div className="mdocs-settings">
            <div className="mdocs-settings-header">
              <h2 className="mdocs-settings-title">{t("saveAndPublish")}</h2>
              <button type="button" className="secondary" onClick={onBack}>
                {t("backToDocs")}
              </button>
            </div>

            <div className="mdocs-settings-cards">
              {/* 自动保存卡片（始终开启，不可关闭） */}
              <div className="mdocs-settings-card">
                <label className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">{t("autoSave")}</span>
                    <span className="mdocs-settings-item-desc">{t("autoSaveAlwaysOnDesc")}</span>
                  </span>
                  {/* 禁用状态的开关（自动保存始终开启） */}
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

              {/* 自动同步开关卡片 */}
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

              {/* 草稿列表入口卡片 */}
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

        {/* 草稿列表抽屉（仅在点击「查看未发布草稿」时显示） */}
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
