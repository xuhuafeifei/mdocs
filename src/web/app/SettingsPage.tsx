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
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftListPage } from "./DraftListPage";
import { listAllDrafts } from "../storage/drafts";
import { DomainManagementPanel } from "./DomainManagementPanel";
import { MemberTemplatesPanel } from "./MemberTemplatesPanel";
import { createCliTokenApi, generateRecoveryCodeApi, listCliTokensApi } from "../services/endpoints";
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

  // ---- CLI Token 相关状态 ----
  // CLI Token 列表
  const [cliTokens, setCliTokens] = useState<{ tokenId: string; name: string; revoked: boolean; createdAt: string }[]>([]);
  // 是否正在加载 Token 列表
  const [cliTokensLoading, setCliTokensLoading] = useState(true);
  // 创建/重置后返回的原始 token（仅展示一次，关闭后清空）
  const [cliTokenResult, setCliTokenResult] = useState<{ token: string; name: string } | null>(null);
  // 是否正在重置
  const [cliTokenBusy, setCliTokenBusy] = useState(false);
  // 是否显示重置确认弹窗
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // 是否刚复制成功（用于按钮文字切换）
  const [cliTokenCopied, setCliTokenCopied] = useState(false);

  // ---- 恢复码相关 ----
  const [recoveryCodeResult, setRecoveryCodeResult] = useState<string | null>(null);
  const [recoveryCodeCopied, setRecoveryCodeCopied] = useState(false);
  const [recoveryCodeBusy, setRecoveryCodeBusy] = useState(false);

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

  /**
   * 首次渲染时加载 CLI Token 列表。
   */
  useEffect(() => {
    loadCliTokens();
  }, []);

  /**
   * 从服务端加载当前访客的所有 CLI Token。
   */
  async function loadCliTokens(): Promise<void> {
    try {
      setCliTokensLoading(true);
      const tokens = await listCliTokensApi();
      setCliTokens(tokens);
    } catch {
      // 加载失败忽略
    } finally {
      setCliTokensLoading(false);
    }
  }

  /**
   * 创建或重置 CLI Token。
   * 创建前会自动吊销所有已有 Token。
   * 生成的原始 token 仅在创建/重置时展示一次。
   */
  function handleCreateOrResetCliToken(): void {
    // 如果已有活跃 token，则先弹出确认弹窗
    const hasActive = cliTokens.some((t) => !t.revoked);
    if (hasActive) {
      setShowResetConfirm(true);
      return;
    }
    doResetCliToken();
  }

  async function doResetCliToken(): Promise<void> {
    try {
      setCliTokenBusy(true);
      const result = await createCliTokenApi();
      // 把原始 token 保存为结果，供 UI 展示
      setCliTokenResult({ token: result.token, name: result.name });
      // 重新加载列表
      await loadCliTokens();
    } finally {
      setCliTokenBusy(false);
    }
  }

  /** 生成新的恢复码 */
  async function handleGenerateRecoveryCode(): Promise<void> {
    try {
      setRecoveryCodeBusy(true);
      const result = await generateRecoveryCodeApi();
      setRecoveryCodeResult(result.recoveryCode);
    } finally {
      setRecoveryCodeBusy(false);
    }
  }

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

              {/* CLI Token 管理卡片 */}
              <div className="mdocs-settings-card">
                <div className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">{t("cliToken")}</span>
                    <span className="mdocs-settings-item-desc">{t("cliTokenDesc")}</span>
                    {/* 已有 Token 列表 */}
                    {!cliTokensLoading && cliTokens.length > 0 && (
                      <span className="mdocs-settings-item-desc" style={{ marginTop: 8, fontSize: "0.85em", opacity: 0.8 }}>
                        {cliTokens.map((token) => (
                          <span key={token.tokenId} style={{ display: "block" }}>
                            {token.name} — {new Date(token.createdAt).toLocaleString()}{" "}
                            {token.revoked ? `(${t("cliTokenRevoked")})` : `(${t("cliTokenActive")})`}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  {/* 无 token 显示创建，有则显示重置 */}
                  <button
                    type="button"
                    className={"secondary"}
                    onClick={handleCreateOrResetCliToken}
                    disabled={cliTokenBusy || cliTokensLoading}
                  >
                    {cliTokenBusy
                      ? "…"
                      : cliTokens.some((t) => !t.revoked)
                        ? t("cliTokenReset")
                        : t("cliTokenCreate")}
                  </button>
                </div>
              </div>

              {/* 恢复码管理卡片 */}
              <div className="mdocs-settings-card">
                <div className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">🔑 恢复码</span>
                    <span className="mdocs-settings-item-desc">
                      当 Token 丢失时，可用恢复码找回身份。生成后请立即保存，仅显示一次。
                    </span>
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleGenerateRecoveryCode}
                    disabled={recoveryCodeBusy}
                  >
                    {recoveryCodeBusy ? "…" : "生成恢复码"}
                  </button>
                </div>
              </div>
            </div>

            {/* CLI Token 生成结果弹窗：仅展示一次，关闭后不可再查看 */}
            {cliTokenResult && (
              <div className="mdocs-settings-card" style={{ marginTop: 16, borderColor: "#4caf50", background: "#f1f8f1" }}>
                <div className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">{t("cliTokenGenerated")}</span>
                    <span className="mdocs-settings-item-desc" style={{ wordBreak: "break-all", fontFamily: "monospace", marginTop: 8 }}>
                      {cliTokenResult.token}
                    </span>
                  </span>
                  <span style={{ display: "flex", gap: 8 }}>
                    {/* 复制按钮 */}
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(cliTokenResult.token);
                        setCliTokenCopied(true);
                        setTimeout(() => setCliTokenCopied(false), 2000);
                      }}
                    >
                      {cliTokenCopied ? t("cliTokenCopied") : t("cliTokenCopy")}
                    </button>
                    {/* 关闭按钮 */}
                    <button
                      type="button"
                      onClick={() => setCliTokenResult(null)}
                    >
                      {t("close")}
                    </button>
                  </span>
                </div>
              </div>
            )}

            {/* 恢复码生成结果：仅展示一次 */}
            {recoveryCodeResult && (
              <div className="mdocs-settings-card" style={{ marginTop: 16, borderColor: "#e67e22", background: "#fef9f0" }}>
                <div className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">🔑 你的恢复码</span>
                    <span className="mdocs-settings-item-desc" style={{ marginTop: 8 }}>
                      请立即复制保存，关闭后不可再查看。
                    </span>
                    <div style={{
                      fontFamily: "monospace",
                      fontSize: "1.25rem",
                      letterSpacing: "0.1em",
                      background: "#fff",
                      border: "1px solid #e0e0e0",
                      borderRadius: 8,
                      padding: "10px 14px",
                      marginTop: 8,
                      userSelect: "all",
                    }}>
                      {recoveryCodeResult}
                    </div>
                  </span>
                  <span style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        navigator.clipboard.writeText(recoveryCodeResult);
                        setRecoveryCodeCopied(true);
                        setTimeout(() => setRecoveryCodeCopied(false), 2000);
                      }}
                    >
                      {recoveryCodeCopied ? "已复制" : "复制恢复码"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecoveryCodeResult(null)}
                    >
                      {t("close")}
                    </button>
                  </span>
                </div>
              </div>
            )}
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

      {/* CLI Token 重置确认弹窗 */}
      {showResetConfirm && (
        <ConfirmDialog
          title={t("cliToken")}
          message={t("cliTokenResetConfirm")}
          confirmLabel={t("cliTokenReset")}
          cancelLabel={t("cancel")}
          busy={cliTokenBusy}
          onConfirm={() => {
            setShowResetConfirm(false);
            doResetCliToken();
          }}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </>
  );
}
