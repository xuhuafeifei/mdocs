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
import { VisitorPickerModal } from "./VisitorPickerModal";
import {
  createCliTokenApi,
  generateRecoveryCodeApi,
  listCliTokensApi,
  fetchBookmarksApi,
  fetchMyDocumentsApi,
  getDocumentInvitesApi,
  addDocumentInviteApi,
  removeDocumentInviteApi,
  removeBookmarkApi,
} from "../services/endpoints";
import type { Bookmark, MyDocument } from "../services/endpoints";
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

type SettingsTab = "general" | "bookmarks" | "myDocuments" | "domainManagement" | "memberTemplates" | "savePublish";

export function SettingsPage(props: {
  onBack: () => void;
  onPublishDraft: (docId: string) => void;
  onOpenDocument: (docId: string) => void;
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

  // ---- 我的收藏 ----
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [bookmarkSearch, setBookmarkSearch] = useState("");

  // ---- 我的文章 ----
  const [myDocuments, setMyDocuments] = useState<MyDocument[]>([]);
  const [myDocumentsLoading, setMyDocumentsLoading] = useState(false);
  const [myDocumentSearch, setMyDocumentSearch] = useState("");

  // ---- 文档邀请成员弹窗 ----
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [currentInviteDocId, setCurrentInviteDocId] = useState<string | null>(null);
  const [existingInvites, setExistingInvites] = useState<Map<string, string>>(new Map());

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
   * 切换到「我的收藏」或「我的文章」Tab 时加载数据。
   */
  useEffect(() => {
    if (tab === "bookmarks") {
      loadBookmarks();
    }
    if (tab === "myDocuments") {
      loadMyDocuments();
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

  /** 加载当前访客的所有收藏 */
  async function loadBookmarks(): Promise<void> {
    try {
      setBookmarksLoading(true);
      const result = await fetchBookmarksApi();
      setBookmarks(result);
    } catch {
      // 加载失败忽略
    } finally {
      setBookmarksLoading(false);
    }
  }

  /** 加载当前访客创建的所有文档 */
  async function loadMyDocuments(): Promise<void> {
    try {
      setMyDocumentsLoading(true);
      const result = await fetchMyDocumentsApi();
      setMyDocuments(result);
    } catch {
      // 加载失败忽略
    } finally {
      setMyDocumentsLoading(false);
    }
  }

  /** 取消收藏 */
  async function handleRemoveBookmark(documentId: string): Promise<void> {
    try {
      await removeBookmarkApi(documentId);
      setBookmarks((prev) => prev.filter((b) => b.documentId !== documentId));
    } catch {
      // 忽略
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

  /** 打开邀请成员弹窗 */
  async function handleOpenInviteModal(documentId: string): Promise<void> {
    setCurrentInviteDocId(documentId);
    try {
      const invites = await getDocumentInvitesApi(documentId);
      const inviteMap = new Map<string, string>();
      invites.forEach((invite: { visitorId: string; permission: string }) => {
        inviteMap.set(invite.visitorId, invite.permission);
      });
      setExistingInvites(inviteMap);
    } catch {
      // 加载失败时初始化为空
      setExistingInvites(new Map());
    }
    setInviteModalOpen(true);
  }

  /** 保存邀请成员列表 */
  async function handleSaveInvite(
    result: Array<{ visitorId: string; permission: string }>,
  ): Promise<void> {
    if (!currentInviteDocId) return;
    try {
      // 计算需要添加和删除的邀请
      const newVisitorIds = new Set(result.map((r) => r.visitorId));
      const oldVisitorIds = new Set(existingInvites.keys());

      // 删除不在新列表中的邀请
      for (const visitorId of oldVisitorIds) {
        if (!newVisitorIds.has(visitorId)) {
          await removeDocumentInviteApi(currentInviteDocId, visitorId);
        }
      }

      // 添加新的邀请或更新权限
      for (const item of result) {
        await addDocumentInviteApi(currentInviteDocId, item.visitorId, item.permission);
      }

      // 重新加载文章列表以刷新状态
      await loadMyDocuments();
    } finally {
      setInviteModalOpen(false);
      setCurrentInviteDocId(null);
    }
  }

  // ---- 过滤后的收藏列表 ----
  const filteredBookmarks = bookmarks.filter((b) => {
    if (!bookmarkSearch.trim()) return true;
    const search = bookmarkSearch.toLowerCase();
    return (
      (b.displayName || b.relativePath || "").toLowerCase().includes(search) ||
      (b.ownerVisitorName || "").toLowerCase().includes(search) ||
      (b.domainId || "").toLowerCase().includes(search)
    );
  });

  // ---- 过滤后的我的文章列表 ----
  const filteredDocuments = myDocuments.filter((d) => {
    if (!myDocumentSearch.trim()) return true;
    const search = myDocumentSearch.toLowerCase();
    return (
      (d.displayName || d.relativePath || "").toLowerCase().includes(search) ||
      (d.domainId || "").toLowerCase().includes(search)
    );
  });

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
          {/* 我的收藏 Tab */}
          <div
            className={"mdocs-config-item" + (tab === "bookmarks" ? " active" : "")}
            onClick={() => setTab("bookmarks")}
          >
            {t("bookmarkTitle")}
          </div>
          {/* 我的文章 Tab */}
          <div
            className={"mdocs-config-item" + (tab === "myDocuments" ? " active" : "")}
            onClick={() => setTab("myDocuments")}
          >
            {t("myDocuments")}
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
        ) : tab === "bookmarks" ? (
          // ---- 我的收藏 Tab ----
          <div className="mdocs-settings">
            <div className="mdocs-settings-header">
              <h2 className="mdocs-settings-title">{t("bookmarkTitle")}</h2>
            </div>
            <div className="mdocs-settings-card">
              <input
                type="text"
                className="mdocs-settings-search"
                placeholder={t("bookmarkSearch")}
                value={bookmarkSearch}
                onChange={(e) => setBookmarkSearch(e.target.value)}
              />
              {bookmarksLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  {t("loading")}
                </div>
              ) : (
                  <>
                    {filteredBookmarks.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "40px 0", opacity: 0.6 }}>
                        {bookmarkSearch ? t("bookmarkNoMatch") : t("bookmarkEmpty")}
                      </div>
                    ) : (
                      <table className="mdocs-settings-table">
                        <thead>
                          <tr>
                            <th>{t("bookmarkColTitle")}</th>
                            <th>{t("bookmarkColDomain")}</th>
                            <th>{t("bookmarkColAuthor")}</th>
                            <th>{t("bookmarkColTime")}</th>
                            <th style={{ textAlign: "right" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBookmarks.map((bookmark) => (
                            <tr key={bookmark.documentId}>
                              <td style={{ cursor: "pointer", fontWeight: 500 }} onClick={() => props.onOpenDocument(bookmark.documentId)}>
                                {bookmark.displayName || bookmark.relativePath || "Untitled"}
                              </td>
                              <td>{bookmark.isDeleted ? (
                                <span style={{ opacity: 0.5, fontStyle: "italic" }}>已删除</span>
                              ) : (
                                bookmark.domainId || "—"
                              )}
                              </td>
                              <td>{bookmark.ownerVisitorName || "—"}</td>
                              <td>{new Date(bookmark.bookmarkedAt).toLocaleDateString()}</td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  type="button"
                                  className="secondary small"
                                  onClick={() => handleRemoveBookmark(bookmark.documentId)}
                                >
                                  {t("bookmarkRemove")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>
            </div>
        ) : tab === "myDocuments" ? (
          // ---- 我的文章 Tab ----
          <div className="mdocs-settings">
            <div className="mdocs-settings-header">
              <h2 className="mdocs-settings-title">{t("myDocuments")}</h2>
            </div>
            <div className="mdocs-settings-card">
              <input
                type="text"
                className="mdocs-settings-search"
                placeholder="搜索文章…"
                value={myDocumentSearch}
                onChange={(e) => setMyDocumentSearch(e.target.value)}
              />
              {myDocumentsLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  {t("loading")}
                </div>
              ) : (
                <>
                  {filteredDocuments.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", opacity: 0.6 }}>
                      {myDocumentSearch ? t("myDocumentsNoMatch") : t("myDocumentsEmpty")}
                    </div>
                  ) : (
                    <table className="mdocs-settings-table">
                      <thead>
                        <tr>
                          <th>{t("myDocumentsColTitle")}</th>
                          <th>{t("myDocumentsColDomain")}</th>
                          <th>{t("myDocumentsColUpdated")}</th>
                          <th>{t("myDocumentsColCreated")}</th>
                          <th colSpan={2}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocuments.map((doc) => (
                          <tr key={doc.documentId}>
                            <td style={{ cursor: "pointer", fontWeight: 500 }} onClick={() => props.onOpenDocument(doc.documentId)}>
                              {doc.displayName || doc.relativePath || "Untitled"}
                            </td>
                            <td>{doc.domainId || "—"}</td>
                            <td>{new Date(doc.updatedAt).toLocaleDateString()}</td>
                            <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() => handleOpenInviteModal(doc.documentId)}
                              >
                                {t("docInfoInviteMember")}
                              </button>
                            </td>
                            <td style={{ textAlign: "right", paddingLeft: 0 }}>
                              <button
                                type="button"
                                className="primary small"
                                onClick={() => props.onOpenDocument(doc.documentId)}
                              >
                                {t("bookmarkOpen")}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
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

      {/* 邀请成员访客选择器弹窗 */}
      <VisitorPickerModal
        open={inviteModalOpen}
        title={t("docInfoInviteMember")}
        initialSelectedIds={[...existingInvites.keys()]}
        initialPermissions={existingInvites}
        templates={[]}
        showPermissionSelect={true}
        permissionOptions={[
          { value: "read", label: t("invitePermissionRead") },
          { value: "edit", label: t("invitePermissionEdit") },
        ]}
        onClose={() => setInviteModalOpen(false)}
        onConfirm={(result) => {
          void handleSaveInvite(result as Array<{ visitorId: string; permission: string }>);
        }}
      />
    </>
  );
}
