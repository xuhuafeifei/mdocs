/**
 * 设置页面组件
 * 提供侧边栏 Tab 导航，包含四个设置模块：
 * 1. 通用设置（语言、自动编辑）
 * 2. 域管理（创建/重命名/删除域）
 * 3. 成员模板（保存常用访客列表）
 * 4. 保存与发布（自动同步开关、未发布草稿列表）
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CloudUpload,
  FileText,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  Cable,
  ScanSearch,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n/types";
import { isDemoMode } from "../services/client";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftListPage } from "./DraftListPage";
import { listAllDrafts } from "../storage/drafts";
import { DomainManagementPanel } from "./DomainManagementPanel";
import { MemberTemplatesPanel } from "./MemberTemplatesPanel";
import { AgentConfigPanel } from "./AgentConfigPanel";
import { AgentUserSkillsPanel } from "./AgentUserSkillsPanel";
import { McpServersPanel } from "./McpServersPanel";
import { PluginMarketplacePanel } from "./PluginMarketplacePanel";
import { EmbeddingIndexPanel } from "./EmbeddingIndexPanel";
import { TrashPanel } from "./TrashPanel";
import { VisitorPickerModal } from "./VisitorPickerModal";
import { useIsNarrowViewport } from "./hooks/useIsNarrowViewport";
import { copyTextToClipboard } from "./copyText";
import { useEdgeSwipeOpen } from "./hooks/useEdgeSwipeOpen";
import {
  createCliTokenApi,
  generateRecoveryCodeApi,
  listCliTokensApi,
  setCliTokenRevokedApi,
  deleteCliTokenApi,
  fetchBookmarksApi,
  fetchMyDocumentsApi,
  getDocumentInvitesApi,
  addDocumentInviteApi,
  removeDocumentInviteApi,
  removeBookmarkApi,
  setPasswordApi,
  fetchDomainsApi,
  fetchVisitorsDirectoryApi,
  searchDocumentsApi,
  fetchServerSettingsApi,
  updateServerSettingsApi,
} from "../services/endpoints";
import type { Bookmark, MyDocument, SearchMode, SearchResult } from "../services/endpoints";
import type { DomainSummary } from "../../shared/types/domain";
import type { VisitorDirectoryEntry } from "../../shared/types/visitor";
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

function formatDocDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function formatMyDocFileType(
  fileType: string | undefined,
  t: (key: TranslationKey) => string,
): string {
  if (fileType === "md") return t("myDocumentsFileTypeMd");
  if (fileType === "sheet") return t("myDocumentsFileTypeSheet");
  if (fileType === "html") return t("myDocumentsFileTypeHtml");
  return fileType || "—";
}

type SettingsTab =
  | "general"
  | "bookmarks"
  | "myDocuments"
  | "trash"
  | "embeddingIndex"
  | "domainManagement"
  | "memberTemplates"
  | "savePublish"
  | "agentConfig"
  | "mcpServers"
  | "pluginMarket";

const SETTINGS_NAV: Array<{
  id: SettingsTab;
  labelKey: TranslationKey;
  /** 额外检索词（中英混搜），不含 label 本身 */
  keywords: string[];
  Icon: LucideIcon;
}> = [
  { id: "general", labelKey: "general", keywords: ["设置", "语言", "settings", "language"], Icon: Settings2 },
  { id: "bookmarks", labelKey: "bookmarkTitle", keywords: ["收藏", "bookmark", "star"], Icon: Star },
  { id: "myDocuments", labelKey: "myDocuments", keywords: ["文章", "文档", "documents", "articles"], Icon: FileText },
  { id: "trash", labelKey: "trashTitle", keywords: ["回收站", "删除", "恢复", "trash", "recycle"], Icon: Trash2 },
  { id: "embeddingIndex", labelKey: "embeddingIndex", keywords: ["语义", "索引", "embedding", "vector", "检索"], Icon: ScanSearch },
  { id: "domainManagement", labelKey: "domainManagement", keywords: ["域", "工作空间", "workspace", "domain"], Icon: LayoutGrid },
  { id: "memberTemplates", labelKey: "memberTemplates", keywords: ["成员", "模板", "members", "template", "邀请"], Icon: Users },
  { id: "agentConfig", labelKey: "agentConfig", keywords: ["ai", "助手", "模型", "agent", "llm", "deepseek"], Icon: Sparkles },
  { id: "mcpServers", labelKey: "mcpServersTitle", keywords: ["mcp", "服务器", "server"], Icon: Cable },
  { id: "pluginMarket", labelKey: "pluginMarketTitle", keywords: ["插件", "市场", "plugin", "engram", "memorix"], Icon: Puzzle },
  { id: "savePublish", labelKey: "saveAndPublish", keywords: ["草稿", "发布", "同步", "draft", "publish", "sync"], Icon: CloudUpload },
];

export function SettingsPage(props: {
  onBack: () => void;
  onPublishDraft: (docId: string) => void;
  onOpenDocument: (docId: string) => void;
  onRecoverDraft?: (draft: any) => void;
}) {
  const { t, lang, setLang } = useI18n();
  const { onBack, onPublishDraft } = props;
  const isNarrow = useIsNarrowViewport();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavLayoutRef = useRef<HTMLDivElement>(null);
  const mobileNavSwipe = useEdgeSwipeOpen(isNarrow, {
    open: mobileNavOpen,
    onOpenChange: setMobileNavOpen,
    layoutRef: mobileNavLayoutRef,
  });

  // 组件挂载状态跟踪，防止卸载后 async setState 导致内存泄漏
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!isNarrow) setMobileNavOpen(false);
  }, [isNarrow]);

  // ---- 自动同步开关（推送到服务器） ----
  const [autoPublish, setAutoPublish] = useState(() => getBool("mdocs.autoPublish", false));

  // ---- 自动编辑开关（打开文档时自动进入编辑模式） ----
  const [autoEdit, setAutoEdit] = useState(() => getBool("mdocs.autoEdit", true));

  // ---- 服务端单文件上传上限（MB，热更新） ----
  const [uploadLimitMb, setUploadLimitMb] = useState("100");
  const [uploadLimitBusy, setUploadLimitBusy] = useState(false);
  const [uploadLimitMsg, setUploadLimitMsg] = useState<string | null>(null);

  // ---- 是否展示草稿列表抽屉 ----
  const [showDrafts, setShowDrafts] = useState(false);

  // ---- 当前激活的 Tab ----
  const [tab, setTab] = useState<SettingsTab>("general");
  const [navQuery, setNavQuery] = useState("");

  function selectTab(next: SettingsTab) {
    setTab(next);
    if (isNarrow) setMobileNavOpen(false);
  }

  const navItems = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return SETTINGS_NAV;
    return SETTINGS_NAV.filter((item) => {
      const label = t(item.labelKey).toLowerCase();
      if (label.includes(q)) return true;
      return item.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [navQuery, t]);

  const tabTitle =
    tab === "general"
      ? t("general")
      : tab === "bookmarks"
        ? t("bookmarkTitle")
        : tab === "myDocuments"
          ? t("myDocuments")
          : tab === "trash"
            ? t("trashTitle")
            : tab === "embeddingIndex"
              ? t("embeddingIndex")
              : tab === "domainManagement"
                ? t("domainManagement")
                : tab === "memberTemplates"
                  ? t("memberTemplates")
                  : tab === "agentConfig"
                    ? t("agentConfig")
                    : tab === "mcpServers"
                      ? t("mcpServersTitle")
                      : tab === "pluginMarket"
                        ? t("pluginMarketTitle")
                        : t("saveAndPublish");

  // ---- CLI Token 相关状态 ----
  // CLI Token 列表
  const [cliTokens, setCliTokens] = useState<{ tokenId: string; name: string; revoked: boolean; createdAt: string }[]>([]);
  // 是否正在加载 Token 列表
  const [cliTokensLoading, setCliTokensLoading] = useState(true);
  // 创建/重置后返回的原始 token（仅展示一次，关闭后清空）
  const [cliTokenResult, setCliTokenResult] = useState<{ token: string; name: string } | null>(null);
  const [cliTokenBusy, setCliTokenBusy] = useState(false);
  /** 待硬删的 tokenId；非空则弹出确认 */
  const [deleteTokenId, setDeleteTokenId] = useState<string | null>(null);
  const [cliTokenCopied, setCliTokenCopied] = useState(false);
  const [cliTokenCopyFailed, setCliTokenCopyFailed] = useState(false);

  // ---- 恢复码相关 ----
  const [recoveryCodeResult, setRecoveryCodeResult] = useState<string | null>(null);
  const [recoveryCodeCopied, setRecoveryCodeCopied] = useState(false);
  const [recoveryCodeCopyFailed, setRecoveryCodeCopyFailed] = useState(false);
  const [recoveryCodeBusy, setRecoveryCodeBusy] = useState(false);

  // ---- 密码设置相关 ----
  const [password, setPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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
  const [myDocSearchMode, setMyDocSearchMode] = useState<SearchMode>("auto");
  const [myDocSearchResults, setMyDocSearchResults] = useState<SearchResult[] | null>(null);
  const [myDocSearchReady, setMyDocSearchReady] = useState(true);
  const [myDocPage, setMyDocPage] = useState(0);
  const [myDocJump, setMyDocJump] = useState("1");
  const [myDocTotal, setMyDocTotal] = useState(0);
  const [myDocDomainId, setMyDocDomainId] = useState("");
  const [myDocCreatorId, setMyDocCreatorId] = useState("");
  const [myDocFileType, setMyDocFileType] = useState<"" | "md" | "html" | "sheet">("");
  const [myDocGroupBy, setMyDocGroupBy] = useState<"" | "domain" | "creator">("");
  const [myDocGroups, setMyDocGroups] = useState<{ key: string; items: MyDocument[] }[] | null>(null);
  const [visitorOptions, setVisitorOptions] = useState<VisitorDirectoryEntry[]>([]);
  const myDocSearchSeq = useRef(0);
  const MY_DOC_PAGE_SIZE = 20;
  /** 搜索态：非空搜索词生效，表格渲染搜索结果而非分页列表 */
  const myDocSearchActive = myDocSearchResults !== null;

  // ---- 域列表（用于 domainId -> domainName 映射）----
  const [domains, setDomains] = useState<DomainSummary[]>([]);

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

  useEffect(() => {
    if (isDemoMode()) return;
    let cancelled = false;
    void fetchServerSettingsApi()
      .then((s) => {
        if (cancelled || !mountedRef.current) return;
        setUploadLimitMb(String(Math.round(s.maxUploadBytes / (1024 * 1024))));
      })
      .catch(() => {
        /* 未登录或旧服务端无此接口时忽略 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveUploadLimit(): Promise<void> {
    const mb = Number(uploadLimitMb);
    if (!Number.isFinite(mb) || mb < 1 || mb > 2048 || !Number.isInteger(mb)) {
      setUploadLimitMsg(t("maxUploadSizeInvalid"));
      return;
    }
    setUploadLimitBusy(true);
    setUploadLimitMsg(null);
    try {
      const s = await updateServerSettingsApi(mb * 1024 * 1024);
      if (!mountedRef.current) return;
      setUploadLimitMb(String(Math.round(s.maxUploadBytes / (1024 * 1024))));
      setUploadLimitMsg(t("maxUploadSizeSaved"));
      window.setTimeout(() => {
        if (mountedRef.current) setUploadLimitMsg(null);
      }, 2000);
    } catch (err) {
      if (!mountedRef.current) return;
      setUploadLimitMsg(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setUploadLimitBusy(false);
    }
  }

  /**
   * 切换到「保存与发布」Tab 时，统计未发布草稿数量用于展示徽标。
   */
  useEffect(() => {
    if (tab === "savePublish") {
      listAllDrafts().then((drafts) => {
        if (!mountedRef.current) return;
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
      fetchVisitorsDirectoryApi().then((rows) => {
        if (mountedRef.current) setVisitorOptions(rows);
      }).catch(() => {});
    }
  }, [tab, myDocDomainId, myDocCreatorId, myDocFileType, myDocGroupBy]);

  /**
   * 我的文章搜索：防抖 300ms 接 POST /search。
   * 有词 → 结果集渲染；清空 → 恢复分页列表。搜索不限定创建者（D2）。
   */
  useEffect(() => {
    if (tab !== "myDocuments") return;
    const q = myDocumentSearch.trim();
    if (!q) {
      myDocSearchSeq.current += 1;
      setMyDocSearchResults(null);
      setMyDocSearchReady(true);
      return;
    }
    const seq = ++myDocSearchSeq.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await searchDocumentsApi({
            query: q,
            mode: myDocSearchMode,
            domainId: myDocDomainId || undefined,
            topN: 50,
          });
          if (!mountedRef.current || seq !== myDocSearchSeq.current) return;
          setMyDocSearchResults(res.results);
          setMyDocSearchReady(res.modelReady);
        } catch {
          if (!mountedRef.current || seq !== myDocSearchSeq.current) return;
          setMyDocSearchResults([]);
          setMyDocSearchReady(true);
        }
      })();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tab, myDocumentSearch, myDocSearchMode, myDocDomainId]);

  // 注意：loadBookmarks / loadMyDocuments 内部已使用 mountedRef 做保护

  /**
   * 首次渲染时加载 CLI Token 列表。
   */
  useEffect(() => {
    loadCliTokens();
  }, []);

  /**
   * 首次渲染时加载域列表。
   */
  useEffect(() => {
    fetchDomainsApi().then((doms) => {
      if (mountedRef.current) setDomains(doms);
    }).catch(() => {});
  }, []);

  /** domainId -> domainName 映射 */
  const domainNameMap = new Map(domains.map((d) => [d.domainId, d.domainName]));

  // 注意：loadCliTokens 内部已使用 mountedRef 做保护

  /**
   * 从服务端加载当前访客的所有 CLI Token。
   */
  async function loadCliTokens(): Promise<void> {
    try {
      setCliTokensLoading(true);
      const tokens = await listCliTokensApi();
      if (!mountedRef.current) return;
      setCliTokens(tokens);
    } catch {
      // 加载失败忽略
    } finally {
      if (mountedRef.current) setCliTokensLoading(false);
    }
  }

  /** 加载当前访客的所有收藏 */
  async function loadBookmarks(): Promise<void> {
    try {
      setBookmarksLoading(true);
      const result = await fetchBookmarksApi();
      if (!mountedRef.current) return;
      setBookmarks(result);
    } catch {
      // 加载失败忽略
    } finally {
      if (mountedRef.current) setBookmarksLoading(false);
    }
  }

  /** 加载当前访客创建的所有文档 */
  async function loadMyDocuments(page = 0): Promise<void> {
    try {
      setMyDocumentsLoading(true);
      const result = await fetchMyDocumentsApi({
        offset: page * MY_DOC_PAGE_SIZE,
        limit: MY_DOC_PAGE_SIZE,
        domainId: myDocDomainId || undefined,
        creatorVisitorId: myDocCreatorId || undefined,
        fileType: myDocFileType || undefined,
        groupBy: myDocGroupBy || undefined,
      });
      if (!mountedRef.current) return;
      setMyDocuments(result.items);
      setMyDocGroups(result.groups ?? null);
      setMyDocTotal(result.total);
      setMyDocPage(page);
      setMyDocJump(String(page + 1));
    } catch {
      // 加载失败忽略
    } finally {
      if (mountedRef.current) setMyDocumentsLoading(false);
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

  async function handleCreateCliToken(): Promise<void> {
    try {
      setCliTokenBusy(true);
      const result = await createCliTokenApi();
      setCliTokenResult({ token: result.token, name: result.name });
      await loadCliTokens();
    } finally {
      setCliTokenBusy(false);
    }
  }

  async function handleToggleCliToken(tokenId: string, revoked: boolean): Promise<void> {
    try {
      setCliTokenBusy(true);
      await setCliTokenRevokedApi(tokenId, revoked);
      await loadCliTokens();
    } finally {
      setCliTokenBusy(false);
    }
  }

  async function handleDeleteCliToken(tokenId: string): Promise<void> {
    try {
      setCliTokenBusy(true);
      await deleteCliTokenApi(tokenId);
      setDeleteTokenId(null);
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

  /** 设置密码 */
  async function handleSetPassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const pwd = password.trim();
    if (pwd && pwd.length < 4) {
      return;
    }
    try {
      setPasswordBusy(true);
      await setPasswordApi(pwd);
      setPassword("");
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } finally {
      setPasswordBusy(false);
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

  const myDocTotalPages = Math.ceil(myDocTotal / MY_DOC_PAGE_SIZE);

  return (
    <div
      ref={mobileNavLayoutRef}
      className={
        "mdocs-layout" +
        (isNarrow ? " mdocs-layout--reader mdocs-layout--settings" : "") +
        (isNarrow && mobileNavOpen ? " mdocs-layout--nav-open" : "") +
        (isNarrow && mobileNavSwipe.dragging ? " is-nav-dragging" : "")
      }
      style={
        isNarrow
          ? ({ ["--mdocs-nav-reveal" as string]: `${mobileNavSwipe.revealPx}px` } as CSSProperties)
          : undefined
      }
    >
      {/* ========== 左侧设置导航栏 ========== */}
      <aside
        className={
          "mdocs-sidebar" +
          (isNarrow
            ? mobileNavOpen
              ? " mdocs-sidebar--drawer-open"
              : " mdocs-sidebar--drawer"
            : "")
        }
      >
        <header className="mdocs-sidebar-header">
          <div className="mdocs-brand">
            <img src={mdocsLogo} alt={t("brand")} className="mdocs-brand-logo" />
            <span>{t("brand")}</span>
          </div>
          {isNarrow ? (
            <button
              type="button"
              className="mdocs-sidebar-toggle"
              onClick={() => setMobileNavOpen(false)}
              aria-label={t("collapseSidebar")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                color: "var(--mdocs-text-muted, #999)",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PanelLeftClose size={18} />
            </button>
          ) : null}
        </header>
        <div className="mdocs-config-nav-search">
          <div className="mdocs-config-nav-search-inner">
            <Search size={14} strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder={t("settingsNavSearch")}
              aria-label={t("settingsNavSearch")}
            />
          </div>
        </div>
        <nav className="mdocs-config-tree">
          {navItems.length === 0 ? (
            <div className="mdocs-config-nav-empty">{t("settingsNavNoMatch")}</div>
          ) : (
            navItems.map((item) => {
              const Icon = item.Icon;
              const active = tab === item.id;
              return (
                <div
                  key={item.id}
                  className={"mdocs-config-item" + (active ? " active" : "")}
                  onClick={() => selectTab(item.id)}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                  <span>{t(item.labelKey)}</span>
                </div>
              );
            })
          )}
        </nav>
        {/* 底部返回按钮 */}
        <footer className="mdocs-settings-sidebar-footer" onClick={onBack}>
          {t("backToDocs")}
        </footer>
      </aside>

      {/* ========== 主内容区 ========== */}
      <main className="mdocs-main">
        {isNarrow ? (
          <div className="mdocs-settings-mobile-bar">
            <button
              type="button"
              className="mdocs-reader-nav-btn"
              onClick={() => setMobileNavOpen(true)}
              aria-label={t("expandSidebar")}
            >
              <PanelLeftOpen size={18} strokeWidth={1.75} />
            </button>
            <span className="mdocs-settings-mobile-bar-title">{tabTitle}</span>
          </div>
        ) : null}
        {isDemoMode() && (
          <div style={{ padding: "8px 16px", background: "#fff3cd", borderBottom: "1px solid #ffc107", fontSize: "0.85rem", color: "#856404", flexShrink: 0 }}>
            Demo 模式下设置功能有限，数据不会同步到服务器。
          </div>
        )}
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

              {/* 单文件上传上限（服务端） */}
              {!isDemoMode() ? (
                <div className="mdocs-settings-card">
                  <div className="mdocs-settings-item">
                    <span className="mdocs-settings-item-info">
                      <span className="mdocs-settings-card-title">{t("maxUploadSize")}</span>
                      <span className="mdocs-settings-item-desc">{t("maxUploadSizeDesc")}</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="number"
                        min={1}
                        max={2048}
                        step={1}
                        value={uploadLimitMb}
                        onChange={(e) => setUploadLimitMb(e.target.value)}
                        disabled={uploadLimitBusy}
                        style={{ width: 88 }}
                        aria-label={t("maxUploadSize")}
                      />
                      <span className="mdocs-settings-item-desc">MB</span>
                      <button
                        type="button"
                        className="secondary"
                        disabled={uploadLimitBusy}
                        onClick={() => void handleSaveUploadLimit()}
                      >
                        {uploadLimitBusy ? "…" : t("maxUploadSizeSave")}
                      </button>
                    </span>
                  </div>
                  {uploadLimitMsg ? (
                    <div className="mdocs-settings-item-desc" style={{ marginTop: 8 }}>
                      {uploadLimitMsg}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* CLI Token 管理卡片 */}
              <div className="mdocs-settings-card">
                <div className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">{t("cliToken")}</span>
                    <span className="mdocs-settings-item-desc">{t("cliTokenDesc")}</span>
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void handleCreateCliToken()}
                    disabled={cliTokenBusy || cliTokensLoading}
                  >
                    {cliTokenBusy ? "…" : t("cliTokenCreate")}
                  </button>
                </div>
                {!cliTokensLoading && cliTokens.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {cliTokens.map((token) => (
                      <div
                        key={token.tokenId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span className="mdocs-settings-item-desc" style={{ fontSize: "0.85em" }}>
                          {token.name} — {new Date(token.createdAt).toLocaleString()}{" "}
                          {token.revoked ? `(${t("cliTokenRevoked")})` : `(${t("cliTokenActive")})`}
                        </span>
                        <span style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="secondary"
                            disabled={cliTokenBusy}
                            onClick={() => void handleToggleCliToken(token.tokenId, !token.revoked)}
                          >
                            {token.revoked ? t("cliTokenEnable") : t("cliTokenDisable")}
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            disabled={cliTokenBusy}
                            onClick={() => setDeleteTokenId(token.tokenId)}
                          >
                            {t("cliTokenDelete")}
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {cliTokenResult && (
                  <div className="mdocs-settings-secret-result mdocs-settings-secret-result--ok">
                    <div className="mdocs-settings-secret-result-head">
                      <span className="mdocs-settings-card-title">{t("cliTokenGenerated")}</span>
                      <span className="mdocs-settings-secret-value">{cliTokenResult.token}</span>
                    </div>
                    <div className="mdocs-settings-secret-result-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          void copyTextToClipboard(cliTokenResult.token).then((ok) => {
                            setCliTokenCopyFailed(!ok);
                            setCliTokenCopied(ok);
                            window.setTimeout(() => {
                              setCliTokenCopied(false);
                              setCliTokenCopyFailed(false);
                            }, ok ? 2000 : 3000);
                          });
                        }}
                      >
                        {cliTokenCopied ? t("cliTokenCopied") : t("cliTokenCopy")}
                      </button>
                      <button type="button" onClick={() => setCliTokenResult(null)}>
                        {t("close")}
                      </button>
                    </div>
                    {cliTokenCopied && (
                      <div className="mdocs-settings-copy-feedback mdocs-settings-copy-feedback--ok" role="status">
                        ✓ {t("cliTokenCopied")}
                      </div>
                    )}
                    {cliTokenCopyFailed && (
                      <div className="mdocs-settings-copy-feedback mdocs-settings-copy-feedback--err" role="status">
                        {t("cliTokenCopyFailed")}
                      </div>
                    )}
                  </div>
                )}
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
                {recoveryCodeResult && (
                  <div className="mdocs-settings-secret-result mdocs-settings-secret-result--warn">
                    <div className="mdocs-settings-secret-result-head">
                      <span className="mdocs-settings-card-title">🔑 你的恢复码</span>
                      <span className="mdocs-settings-item-desc" style={{ marginTop: 8 }}>
                        请立即复制保存，关闭后不可再查看。
                      </span>
                      <div className="mdocs-settings-secret-code">{recoveryCodeResult}</div>
                    </div>
                    <div className="mdocs-settings-secret-result-actions">
                      <button
                        type="button"
                        className="primary"
                        onClick={() => {
                          void copyTextToClipboard(recoveryCodeResult).then((ok) => {
                            setRecoveryCodeCopyFailed(!ok);
                            setRecoveryCodeCopied(ok);
                            window.setTimeout(() => {
                              setRecoveryCodeCopied(false);
                              setRecoveryCodeCopyFailed(false);
                            }, ok ? 2000 : 3000);
                          });
                        }}
                      >
                        {recoveryCodeCopied ? "已复制" : "复制恢复码"}
                      </button>
                      <button type="button" onClick={() => setRecoveryCodeResult(null)}>
                        {t("close")}
                      </button>
                    </div>
                    {recoveryCodeCopied && (
                      <div className="mdocs-settings-copy-feedback mdocs-settings-copy-feedback--ok" role="status">
                        ✓ 已复制到剪贴板
                      </div>
                    )}
                    {recoveryCodeCopyFailed && (
                      <div className="mdocs-settings-copy-feedback mdocs-settings-copy-feedback--err" role="status">
                        复制失败，请手动选中上方内容复制
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 密码设置卡片 */}
              <div className="mdocs-settings-card">
                <div className="mdocs-settings-item">
                  <span className="mdocs-settings-item-info">
                    <span className="mdocs-settings-card-title">🔐 登录密码</span>
                    <span className="mdocs-settings-item-desc">
                      设置密码后，可在其他浏览器或设备用「用户名+密码」登录。
                    </span>
                  </span>
                </div>
                <form onSubmit={handleSetPassword} style={{ marginTop: 12 }}>
                  <input
                    type="password"
                    placeholder="输入新密码（至少 4 位，留空则清除密码）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={0}
                    style={{ marginBottom: 8 }}
                  />
                  {passwordSuccess && (
                    <div style={{ color: "#4caf50", marginBottom: 8, fontSize: "0.875rem" }}>
                      ✓ 密码设置成功
                    </div>
                  )}
                  <button
                    type="submit"
                    className="secondary"
                    disabled={passwordBusy}
                  >
                    {passwordBusy ? "设置中…" : "保存密码"}
                  </button>
                </form>
              </div>
            </div>
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
                      <div className="mdocs-settings-table-wrap">
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
                                domainNameMap.get(bookmark.domainId || "") || bookmark.domainId || "—"
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
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
        ) : tab === "trash" ? (
          <TrashPanel onRestored={(docId) => props.onOpenDocument(docId)} />
        ) : tab === "myDocuments" ? (
          <div className="mdocs-settings mdocs-my-docs">
            <div className="mdocs-settings-header">
              <h2 className="mdocs-settings-title">{t("myDocuments")}</h2>
            </div>
            <div className="mdocs-settings-card">
              <div className="mdocs-my-docs-toolbar">
                <div className="mdocs-my-docs-search">
                  <Search size={16} strokeWidth={2} aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="搜索文章…"
                    value={myDocumentSearch}
                    onChange={(e) => setMyDocumentSearch(e.target.value)}
                  />
                </div>
                <select
                  className="mdocs-my-docs-select"
                  value={myDocDomainId}
                  aria-label={t("myDocumentsFilterDomain")}
                  onChange={(e) => setMyDocDomainId(e.target.value)}
                >
                  <option value="">{t("myDocumentsFilterAllDomains")}</option>
                  {domains.map((d) => (
                    <option key={d.domainId} value={d.domainId}>
                      {domainNameMap.get(d.domainId) || d.domainName}
                    </option>
                  ))}
                </select>
                {!myDocSearchActive && (
                  <select
                    className="mdocs-my-docs-select"
                    value={myDocFileType}
                    aria-label={t("myDocumentsFilterFileType")}
                    onChange={(e) => setMyDocFileType(e.target.value as "" | "md" | "html" | "sheet")}
                  >
                    <option value="">{t("myDocumentsFilterAllFileTypes")}</option>
                    <option value="md">{t("myDocumentsFileTypeMd")}</option>
                    <option value="sheet">{t("myDocumentsFileTypeSheet")}</option>
                    <option value="html">{t("myDocumentsFileTypeHtml")}</option>
                  </select>
                )}
                <select
                  className="mdocs-my-docs-select"
                  value={myDocSearchMode}
                  aria-label={t("myDocumentsSearchMode")}
                  onChange={(e) => setMyDocSearchMode(e.target.value as SearchMode)}
                >
                  <option value="auto">{t("myDocumentsModeAuto")}</option>
                  <option value="keyword">{t("myDocumentsModeKeyword")}</option>
                  <option value="semantic">{t("myDocumentsModeSemantic")}</option>
                </select>
                {!myDocSearchActive && (
                  <select
                    className="mdocs-my-docs-select"
                    value={myDocCreatorId}
                    aria-label={t("myDocumentsFilterCreator")}
                    onChange={(e) => setMyDocCreatorId(e.target.value)}
                  >
                    <option value="">{t("myDocumentsFilterAllCreators")}</option>
                    {visitorOptions.map((v) => (
                      <option key={v.visitorId} value={v.visitorId}>
                        {v.visitorName}
                      </option>
                    ))}
                  </select>
                )}
                {!myDocSearchActive && (
                  <select
                    className="mdocs-my-docs-select"
                    value={myDocGroupBy}
                    aria-label={t("myDocumentsGroupBy")}
                    onChange={(e) => setMyDocGroupBy(e.target.value as "" | "domain" | "creator")}
                  >
                    <option value="">{t("myDocumentsGroupNone")}</option>
                    <option value="domain">{t("myDocumentsGroupDomain")}</option>
                    <option value="creator">{t("myDocumentsGroupCreator")}</option>
                  </select>
                )}
              </div>
              {myDocumentsLoading && !myDocSearchActive ? (
                <div className="mdocs-my-docs-empty">{t("loading")}</div>
              ) : myDocSearchActive ? (
                <>
                  {myDocSearchResults!.length === 0 ? (
                    <div className="mdocs-my-docs-empty">
                      {myDocSearchMode === "semantic" && !myDocSearchReady
                        ? t("myDocumentsSemanticNotReady")
                        : t("myDocumentsNoMatch")}
                    </div>
                  ) : (
                    <>
                      <div className="mdocs-my-docs-search-meta">
                        {t("myDocumentsResultCount", { count: String(myDocSearchResults!.length) })}
                        {myDocSearchMode === "semantic" && !myDocSearchReady
                          ? ` · ${t("myDocumentsSemanticNotReadyShort")}`
                          : ""}
                      </div>
                      <div className="mdocs-settings-table-wrap">
                        <table className="mdocs-settings-table">
                          <thead>
                            <tr>
                              <th>{t("myDocumentsColTitle")}</th>
                              <th>{t("myDocumentsColDomain")}</th>
                              <th>{t("myDocumentsColCreator")}</th>
                              <th>{t("myDocumentsColUpdated")}</th>
                              <th>{t("myDocumentsColCreated")}</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {myDocSearchResults!.map((doc) => (
                              <tr key={doc.documentId}>
                                <td className="mdocs-my-docs-title" onClick={() => props.onOpenDocument(doc.documentId)}>
                                  {doc.displayName || doc.relativePath || "Untitled"}
                                </td>
                                <td>{domainNameMap.get(doc.domainId || "") || doc.domainId || "—"}</td>
                                <td>{doc.ownerVisitorName || "—"}</td>
                                <td className="mdocs-my-docs-date">{formatDocDate(doc.updatedAt)}</td>
                                <td className="mdocs-my-docs-date">{doc.createdAt ? formatDocDate(doc.createdAt) : "—"}</td>
                                <td className="mdocs-my-docs-actions">
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
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {myDocuments.length === 0 ? (
                    <div className="mdocs-my-docs-empty">
                      {myDocumentSearch ? t("myDocumentsNoMatch") : t("myDocumentsEmpty")}
                    </div>
                  ) : (
                    <div className="mdocs-settings-table-wrap">
                      <table className="mdocs-settings-table">
                      <thead>
                        <tr>
                          <th>{t("myDocumentsColTitle")}</th>
                          <th>{t("myDocumentsColFileType")}</th>
                          <th>{t("myDocumentsColDomain")}</th>
                          <th>{t("myDocumentsColCreator")}</th>
                          <th>{t("myDocumentsColUpdated")}</th>
                          <th>{t("myDocumentsColCreated")}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(myDocGroups ?? [{ key: "", items: myDocuments }]).flatMap((group) => {
                          const header = group.key ? (
                            <tr key={`group-${group.key}`} className="mdocs-my-docs-group">
                              <td colSpan={7}>
                                {myDocGroupBy === "domain"
                                  ? (domainNameMap.get(group.key) || group.key)
                                  : (group.items[0]?.creatorName || group.key)}
                              </td>
                            </tr>
                          ) : null;
                          const rows = group.items.map((doc) => (
                          <tr key={doc.documentId}>
                            <td className="mdocs-my-docs-title" onClick={() => props.onOpenDocument(doc.documentId)}>
                              {doc.displayName || doc.relativePath || "Untitled"}
                            </td>
                            <td>{formatMyDocFileType(doc.fileType, t)}</td>
                            <td>{domainNameMap.get(doc.domainId || "") || doc.domainId || "—"}</td>
                            <td>{doc.creatorName || doc.creatorVisitorId || "—"}</td>
                            <td className="mdocs-my-docs-date">{formatDocDate(doc.updatedAt)}</td>
                            <td className="mdocs-my-docs-date">{formatDocDate(doc.createdAt)}</td>
                            <td className="mdocs-my-docs-actions">
                              <button
                                type="button"
                                className="ghost small"
                                onClick={() => handleOpenInviteModal(doc.documentId)}
                              >
                                {t("docInfoInviteMember")}
                              </button>
                              <button
                                type="button"
                                className="primary small"
                                onClick={() => props.onOpenDocument(doc.documentId)}
                              >
                                {t("bookmarkOpen")}
                              </button>
                            </td>
                          </tr>
                          ));
                          return header ? [header, ...rows] : rows;
                        })}
                      </tbody>
                    </table>
                    </div>
                  )}
                  {!myDocSearchActive && (
                  <div className="mdocs-my-docs-footer">
                    <span className="mdocs-settings-page-info">
                      {t("myDocumentsPageInfo", {
                        current: String(myDocTotalPages > 0 ? myDocPage + 1 : 0),
                        total: String(myDocTotalPages),
                        count: String(myDocTotal),
                      })}
                    </span>
                    {myDocTotalPages > 1 && (
                      <form
                        className="mdocs-my-docs-jump"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const n = Number.parseInt(myDocJump, 10);
                          if (!Number.isFinite(n)) return;
                          const page = Math.min(Math.max(n, 1), myDocTotalPages) - 1;
                          if (page !== myDocPage) void loadMyDocuments(page);
                        }}
                      >
                        <span>{t("myDocumentsJumpTo")}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={myDocTotalPages}
                          aria-label={t("myDocumentsJumpTo")}
                          value={myDocJump}
                          onChange={(e) => setMyDocJump(e.target.value)}
                        />
                        <button type="submit" className="secondary small">
                          {t("myDocumentsJump")}
                        </button>
                      </form>
                    )}
                    {myDocTotalPages > 1 && (
                      <div className="mdocs-settings-pagination">
                        <button
                          type="button"
                          className="secondary small"
                          disabled={myDocPage <= 0}
                          onClick={() => loadMyDocuments(myDocPage - 1)}
                        >
                          {t("myDocumentsPrev")}
                        </button>
                        <button
                          type="button"
                          className="secondary small"
                          disabled={myDocPage >= myDocTotalPages - 1}
                          onClick={() => loadMyDocuments(myDocPage + 1)}
                        >
                          {t("myDocumentsNext")}
                        </button>
                      </div>
                    )}
                  </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : tab === "embeddingIndex" ? (
          <EmbeddingIndexPanel onOpenDocument={props.onOpenDocument} />
        ) : tab === "domainManagement" ? (
          // ---- 域管理 Tab ----
          <DomainManagementPanel />
        ) : tab === "memberTemplates" ? (
          // ---- 成员模板 Tab ----
          <MemberTemplatesPanel />
        ) : tab === "agentConfig" ? (
          <div className="mdocs-settings">
            <AgentConfigPanel />
            <AgentUserSkillsPanel />
          </div>
        ) : tab === "mcpServers" ? (
          <McpServersPanel />
        ) : tab === "pluginMarket" ? (
          <PluginMarketplacePanel />
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
            onRecover={props.onRecoverDraft}
          />
        )}
      </main>

      {deleteTokenId && (
        <ConfirmDialog
          title={t("cliToken")}
          message={t("cliTokenDeleteConfirm")}
          confirmLabel={t("cliTokenDelete")}
          cancelLabel={t("cancel")}
          busy={cliTokenBusy}
          onConfirm={() => {
            void handleDeleteCliToken(deleteTokenId);
          }}
          onCancel={() => setDeleteTokenId(null)}
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
    </div>
  );
}
