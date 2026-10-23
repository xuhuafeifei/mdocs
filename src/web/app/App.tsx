/**
 * mdocs 核心应用组件
 * 负责整个应用的生命周期管理：
 * 1. 访客注册与身份恢复
 * 2. 域（Domain）加载与切换
 * 3. 文档树（Tree）的加载与刷新
 * 4. 文档的打开、发布、删除
 * 5. 新建文档/文件夹的模态框管理
 * 6. 全局消息提示与冲突处理
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BookOpen, Code, Code2, File, FileText, FolderPlus, LogOut, MessageSquare, Network, PanelLeftClose, PanelLeftOpen, PanelRightClose, Search, Star, Table } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import type { VisitorPublic } from "../../shared/types/visitor";
import type { ActiveDocumentMeta, DocumentDetail, VersionConflictDetails } from "../../shared/types/document";
import { documentDetailToMeta } from "./documentMeta";
import { getDocumentTaskQueue } from "./documentTaskQueue";
import type { DomainSummary } from "../../shared/types/domain";
import type { TreeNode } from "../../shared/types/tree";
import { isPublicWritePermission } from "../../shared/permissions.js";
import { isFolderDescPath } from "../../shared/folderDesc.js";
import { loadLastSession, saveLastSession } from "../storage/lastSession";
import { copyTextToClipboard } from "./copyText";
import {
  ApiRequestError,
  MDOCS_API_ERROR_EVENT,
  clearVisitorId,
  storeVisitorId,
  isDemoMode,
} from "../services/client";
import { fetchDomainsSafe, pickInitialDomainId } from "../services/domainsBootstrap";
import {
  deleteDocumentApi,
  deleteFolderApi,
  fetchMe,
  fetchTreeApi,
  getDocumentApi,
  moveDocumentApi,
  registerVisitorApi,
  updateDocumentApi,
  fetchBookmarksApi,
  removeBookmarkApi,
  convertContentApi,
  createDocumentApi,
  type Bookmark,
} from "../services/endpoints";
import { VisitorRegisterDialog } from "./VisitorRegisterDialog";
import { VisitorIdNotice } from "./VisitorIdNotice";
import { DocumentTree, type TreeContextMenu as TreeContextMenuPayload } from "./DocumentTree";
import { GraphPage } from "./GraphPage";
import { TreeContextMenu } from "./TreeContextMenu";
import { DomainSelect } from "./DomainSelect";
import {
  AgentFab,
  agentPanelAnchorStyle,
  loadAgentDocked,
  loadAgentDockWidth,
  loadAgentTreeRailOpen,
  saveAgentDocked,
  saveAgentDockWidth,
  saveAgentTreeRailOpen,
  useAgentFabPosition,
} from "./AgentFab";
import { MessageDialog } from "./MessageDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { DocSearchOverlay } from "./DocSearchOverlay";
import { useCreateModal } from "./hooks/useCreateModal";
import { useIsNarrowViewport } from "./hooks/useIsNarrowViewport";
import { useEdgeSwipeOpen } from "./hooks/useEdgeSwipeOpen";
import { ConflictModal } from "./ConflictModal";
import { CommentsPanel } from "./CommentsPanel";
import { PublishMessageDialog } from "./PublishMessageDialog";
import {
  getDraft,
  saveDraft as saveDraftRecord,
  deleteDraft,
  clearDraftPublishError,
  DRAFT_PUBLISH_ERROR,
  saveDraftConflict,
  clearDraftConflict,
  upsertContentDraft,
  type DraftConflictRecord,
  type DraftRecord,
} from "../storage/drafts";
import { translateError, localizeDomainName, parentDirForCreates } from "./utils";
import {
  DraftPublishAborted,
  failDraftPublish,
  formatDraftPublishFailureMessage,
} from "./draftPublishFailure";
import { useAutoPublish } from "./hooks/useAutoPublish";
import { useDocumentVersion } from "./hooks/useDocumentVersion";
import { aiWriteResultToHtml, htmlToAiWriteSeed } from "./ai-write/htmlAiWrite";
import { installAssetLinkDownloads } from "./assetLinkDownload";
import { FILE_TYPE } from "../../shared/file-types";
import { EditorPaneHost } from "./EditorPaneHost";
import type { RecentDocTabsProps } from "./RecentDocTabs";
import {
  clearSecondaryRecentDocTabs,
  loadRecentDocTabsByPane,
  promoteSecondaryTabsToPrimary,
  removeRecentDocTab,
  touchRecentDocTab,
  type RecentDocTab,
  type RecentDocTabsByPane,
  type RecentTabsPane,
} from "../storage/recentDocTabs";
import {
  loadLobeToolbarVisible,
  loadTabsPinned,
  saveLobeToolbarVisible,
  saveTabsPinned,
} from "../storage/editorWorkbenchPrefs";
import {
  loadEditorSplitOpen,
  loadEditorSplitRatio,
  loadEditorSplitSecondaryId,
  saveEditorSplitOpen,
  saveEditorSplitRatio,
  saveEditorSplitSecondaryId,
} from "./editorSplitStorage";
import mdocsLogo from "../assets/mdocs-logo.svg";
import deepseekLogoUrl from "../assets/deepseek.svg";
import "./App.css";
import "./merge.css";
import "./domain.css";
import "./comments.css";

/** 重依赖按需加载：首屏只拉壳，编辑器/助手/设置进独立 chunk */
const SettingsPage = lazy(() =>
  import("./SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const AgentChatPanel = lazy(() =>
  import("./AgentChatPanel").then((m) => ({ default: m.AgentChatPanel })),
);
type AgentChatPanelHandle = import("./AgentChatPanel").AgentChatPanelHandle;
const AiWriteWorkbench = lazy(() =>
  import("./ai-write/AiWriteWorkbench").then((m) => ({ default: m.AiWriteWorkbench })),
);
const MergeView = lazy(() => import("./MergeView").then((m) => ({ default: m.MergeView })));

type Phase = "loading" | "needsRegister" | "ready";

/**
 * 使用 Intl.RelativeTimeFormat 将 ISO 时间字符串格式化为相对时间。
 * 自动适配 locale（中文/英文），降级时返回 ISO 日期简写。
 */
function formatRelativeTime(isoStr: string, locale: string): string {
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay > 30) return rtf.format(-Math.floor(diffDay / 30), "month");
    if (diffDay > 0) return rtf.format(-diffDay, "day");
    if (diffHour > 0) return rtf.format(-diffHour, "hour");
    if (diffMin > 0) return rtf.format(-diffMin, "minute");
    return rtf.format(-Math.floor(diffMs / 1000), "second");
  } catch {
    return isoStr.slice(0, 10);
  }
}

/**
 * 初始化域列表与文档树。
 * 先拉取域列表，再根据访客 ID 挑选默认域，最后加载对应域的目录树。
 */
async function initDomainsAndTree(
  visitorId: string,
  setDomains: (doms: DomainSummary[]) => void,
  setCurrentDomainId: (id: string) => void,
  refreshTree: (domainId?: string) => Promise<unknown>,
): Promise<void> {
  // 向后端请求域列表，如果失败则返回 fallback 默认域
  const doms = await fetchDomainsSafe();
  // 更新 React 状态，让侧边栏显示域列表
  setDomains(doms);
  // 优先从 localStorage 恢复上次保存的域 ID，检查是否仍在当前域列表中
  const saved = localStorage.getItem("mdocs.currentDomainId");
  const savedStillValid = saved && doms.some((d) => d.domainId === saved);
  // 取有效值：上次保存的域 > 个人域 > 系统默认域 > 第一个域
  const initial = savedStillValid ? saved : pickInitialDomainId(doms, visitorId);
  // 设置当前激活的域 ID
  setCurrentDomainId(initial);
  // 加载该域的文档树数据
  await refreshTree(initial);
}

export function App() {
  // ---- 国际化 ----
  const { t, lang, setLang } = useI18n();

  // ---- 应用阶段状态 ----
  // "loading": 正在初始化，显示加载中
  // "needsRegister": 需要注册访客身份
  // "ready": 已登录，可以正常使用
  const [phase, setPhase] = useState<Phase>("loading");

  // ---- 侧边栏收起状态 ----
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem("mdocs.sidebarCollapsed");
    return stored === "true";
  });
  const isNarrow = useIsNarrowViewport();
  /** 窄屏：目录抽屉开合（收起 = 完全不占位） */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleSidebar = () => {
    if (isNarrow) {
      setMobileNavOpen((v) => !v);
      return;
    }
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    localStorage.setItem("mdocs.sidebarCollapsed", String(newValue));
  };

  useEffect(() => {
    if (!isNarrow) setMobileNavOpen(false);
    if (isNarrow) clearEditorSplit();
  }, [isNarrow]);

  /** 窄屏 push 轨比视口宽：focus 输入会把 shell 横向滚偏，叠 transform 后正文只剩左边一条缝 */
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // shell 只在 ready 后挂载；依赖 phase，避免 loading 时 shellRef 为空就永久跳过
    if (phase !== "ready" || !isNarrow) return;
    const shell = shellRef.current;
    if (!shell) return;
    const lockX = () => {
      if (shell.scrollLeft !== 0) shell.scrollLeft = 0;
    };
    lockX();
    shell.addEventListener("scroll", lockX, { passive: true });
    shell.addEventListener("focusin", lockX);
    return () => {
      shell.removeEventListener("scroll", lockX);
      shell.removeEventListener("focusin", lockX);
    };
  }, [isNarrow, phase]);

  useEffect(() => installAssetLinkDownloads(), []);

  // ---- 评论区展开状态 ----
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // ---- 文档打开请求的竞态保护 ----
  // 快速切换文档时，标记当前预期的 documentId，旧请求返回后如果不匹配则丢弃
  const expectedDocIdRef = useRef<string | null>(null);

  // ---- 访客信息 ----
  const [visitor, setVisitor] = useState<VisitorPublic | null>(null);

  // ---- 注册成功后临时展示访客 ID 的提示条 ----
  const [pendingVisitorId, setPendingVisitorId] = useState<string | null>(null);

  // ---- 注册成功后显示的恢复码（仅展示一次） ----
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  // ---- 侧边栏文档树数据 ----
  const [tree, setTree] = useState<TreeNode[]>([]);

  // ---- 域列表与当前域 ----
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [currentDomainId, setCurrentDomainId] = useState("default");
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const createDropdownRef = useRef<HTMLDivElement>(null);

  // ---- 路由参数：URL 中的文档 ID ----
  const { documentId } = useParams();

  // ---- 路由导航函数 ----
  const navigate = useNavigate();

  // ---- 单一焦点（文档 | 图谱） ----
  type AppFocus =
    | { kind: "document"; documentId: string }
    | { kind: "graph"; scope: "folder" | "domain"; resourceId: string; name: string }
    | null;

  const [focus, setFocus] = useState<AppFocus>(null);

  // 从焦点派生活动文档 ID（仅 document 焦点时有效）；分屏时可能是下栏
  const activeDocumentId = focus?.kind === "document" ? focus.documentId : null;
  const [activeDocMeta, setActiveDocMeta] = useState<ActiveDocumentMeta | null>(null);
  const [editorContent, setEditorContent] = useState<{
    documentId: string;
    content: string;
    displayName: string;
  } | null>(null);
  const editorContentRef = useRef(editorContent);
  editorContentRef.current = editorContent;

  /** PC「最近打开」标签：上下栏分列（窄屏不渲染） */
  const [recentTabsByPane, setRecentTabsByPane] = useState<RecentDocTabsByPane>(() =>
    loadRecentDocTabsByPane(),
  );
  const [tabsPinned, setTabsPinned] = useState(() => loadTabsPinned());
  const [lobeToolbarVisible, setLobeToolbarVisible] = useState(() => loadLobeToolbarVisible());

  /** PC 中间上下分屏（下栏） */
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(() => loadEditorSplitRatio());
  const [focusedPane, setFocusedPane] = useState<"primary" | "secondary">("primary");
  const [secondaryMeta, setSecondaryMeta] = useState<ActiveDocumentMeta | null>(null);
  const [secondaryContent, setSecondaryContent] = useState<{
    documentId: string;
    content: string;
    displayName: string;
  } | null>(null);
  const [secondaryRevision, setSecondaryRevision] = useState(0);
  const [secondaryDraftExists, setSecondaryDraftExists] = useState(false);
  const splitDragRef = useRef<{ startY: number; startRatio: number } | null>(null);
  const mainSplitRef = useRef<HTMLDivElement | null>(null);
  const focusedDocMeta =
    splitOpen && focusedPane === "secondary" && secondaryMeta
      ? secondaryMeta
      : activeDocMeta;
  const pcSplitActive =
    !isNarrow &&
    splitOpen &&
    Boolean(activeDocMeta && editorContent && secondaryMeta && secondaryContent);
  const [contentRevision, setContentRevision] = useState(0);
  const [editBaseCommitId, setEditBaseCommitId] = useState<string | null>(null);

  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [forceOverwriteBusy, setForceOverwriteBusy] = useState(false);
  const [mergeViewOpen, setMergeViewOpen] = useState(false);
  const [editorDraftExists, setEditorDraftExists] = useState(false);

  const syncTargetDocumentId = activeDocMeta?.documentId ?? null;
  const { syncBehind, remoteCommitId } = useDocumentVersion(syncTargetDocumentId, editBaseCommitId);

  const [mergeConflict, setMergeConflict] = useState<DraftConflictRecord | null>(null);

  useEffect(() => {
    if (!mergeViewOpen || !activeDocMeta) {
      setMergeConflict(null);
      return;
    }
    void (async () => {
      const draft = await getDraft(activeDocMeta.documentId);
      if (draft?.conflict) {
        setMergeConflict(draft.conflict);
        return;
      }
      if (draft && editBaseCommitId && remoteCommitId) {
        const editBase = draft.localBaseCommitId ?? editBaseCommitId;
        if (!editBase) return;
        const built: DraftConflictRecord = {
          localBaseCommitId: editBase,
          remoteCommitId,
          localSnapshotContent: draft.content,
        };
        await saveDraftConflict(activeDocMeta.documentId, {
          localBaseCommitId: built.localBaseCommitId,
          conflictStatus: "diverged",
          conflict: built,
        });
        setMergeConflict(built);
      }
    })();
  }, [mergeViewOpen, activeDocMeta, editBaseCommitId, remoteCommitId]);

  useEffect(() => {
    if (!activeDocMeta || !syncBehind || !editorDraftExists) return;
    void getDraft(activeDocMeta.documentId).then(async (draft) => {
      if (!draft || draft.conflict || draft.conflictStatus === "publish_conflict") return;
      if (draft.conflictStatus === "diverged") return;
      await saveDraftRecord({ ...draft, conflictStatus: "diverged" });
    });
  }, [activeDocMeta?.documentId, syncBehind, editorDraftExists]);

  useEffect(() => {
    if (!activeDocMeta) {
      setEditBaseCommitId(null);
      return;
    }
    let cancelled = false;
    void getDraft(activeDocMeta.documentId).then((draft) => {
      if (cancelled) return;
      if (draft && !draft.published && draft.localBaseCommitId) {
        setEditBaseCommitId(draft.localBaseCommitId);
      } else {
        setEditBaseCommitId(activeDocMeta.headCommitId ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeDocMeta?.documentId, activeDocMeta?.headCommitId, editorDraftExists]);

  // ---- 全局 Toast 消息（如「已发布」） ----
  const [message, setMessage] = useState<string | null>(null);

  // ---- 错误弹窗消息 ----
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // ---- 删除确认弹窗 ----
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "document" | "folder";
    id: string;
    name: string;
  } | null>(null);

  // ---- 右键菜单状态 ----
  const [menu, setMenu] = useState<TreeContextMenuPayload | null>(null);

  // ---- 新建文档/文件夹时的默认父路径 ----
  const [selectedCreateParentPath, setSelectedCreateParentPath] = useState("");
  /** 新建目录后滚到并聚焦该目录行；打开其它文档时清空 */
  const [revealFolderId, setRevealFolderId] = useState<string | null>(null);

  // ---- 当前视图：docs（文档）或 settings（设置） ----
  const [view, setView] = useState<"docs" | "settings">("docs");
  /** 启动时先读上次会话，读完前不要把空首页写回 IndexedDB */
  const [sessionReady, setSessionReady] = useState(false);
  const sessionBootRef = useRef(false);

  const mobileNavLayoutRef = useRef<HTMLDivElement>(null);
  const mobileNavSwipe = useEdgeSwipeOpen(isNarrow && view === "docs", {
    open: mobileNavOpen,
    onOpenChange: setMobileNavOpen,
    layoutRef: mobileNavLayoutRef,
  });

  // ---- 上手助手浮层 / PC 贴左 ----
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [agentPanelFullscreen, setAgentPanelFullscreen] = useState(false);
  const [agentDocked, setAgentDocked] = useState(() => loadAgentDocked());
  const [agentDockWidth, setAgentDockWidth] = useState(() => loadAgentDockWidth());
  const [agentTreeRailOpen, setAgentTreeRailOpen] = useState(() => loadAgentTreeRailOpen());
  const [agentFabPos, setAgentFabPos] = useAgentFabPosition();
  const agentPanelRef = useRef<AgentChatPanelHandle | null>(null);
  /** PC 且偏好贴左且面板打开 → 左列替换文档树 */
  const agentDockLayout = agentDocked && agentPanelOpen && !isNarrow;

  function setAgentDockedPersist(next: boolean): void {
    setAgentDocked(next);
    saveAgentDocked(next);
    if (next) setAgentPanelFullscreen(false);
  }

  function setAgentDockWidthPersist(width: number): void {
    setAgentDockWidth(width);
    saveAgentDockWidth(width);
  }

  function setAgentTreeRailOpenPersist(open: boolean): void {
    setAgentTreeRailOpen(open);
    saveAgentTreeRailOpen(open);
  }

  // ---- 帮写全屏层 ----
  const [aiWriteOpen, setAiWriteOpen] = useState(false);
  const [aiWriteBoot, setAiWriteBoot] = useState<{
    markdown: string;
    documentId: string | null;
    displayName: string;
    /** 写回目标：html → contentKind=html；否则 Lexical */
    fileType: string;
  } | null>(null);

  // ---- 导航前保存草稿的引用 ----
  // DocumentEditor 会通过这个 ref 暴露 saveDraft 方法
  const saveBeforeNavRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const exportMarkdownRef = useRef<(() => string) | undefined>(undefined);

  // ---- 手动发布说明弹框（Promise 桥）----
  const [publishMsgPrompt, setPublishMsgPrompt] = useState<{
    content: string;
    documentId: string;
    contentFormat?: "markdown" | "lexical" | "plain";
    mode?: "publish" | "merge";
    mergeSuggest?: {
      localContent: string;
      remoteContent: string;
      mergedContent: string;
      baseContent?: string;
    };
    resolve: (message: string | null) => void;
  } | null>(null);

  function requestPublishMessage(
    content: string,
    documentId: string,
    contentFormat?: "markdown" | "lexical" | "plain",
  ): Promise<string | null> {
    return new Promise((resolve) => {
      setPublishMsgPrompt({ content, documentId, contentFormat, mode: "publish", resolve });
    });
  }

  /** 冲突合并收尾：合并说明弹窗（AI 走 suggest-merge-message）。 */
  function requestMergePublishMessage(opts: {
    documentId: string;
    content: string;
    contentFormat?: "markdown" | "lexical" | "plain";
    localContent: string;
    remoteContent: string;
    mergedContent: string;
    baseContent?: string;
  }): Promise<string | null> {
    return new Promise((resolve) => {
      setPublishMsgPrompt({
        mode: "merge",
        documentId: opts.documentId,
        content: opts.content,
        contentFormat: opts.contentFormat,
        mergeSuggest: {
          localContent: opts.localContent,
          remoteContent: opts.remoteContent,
          mergedContent: opts.mergedContent,
          baseContent: opts.baseContent,
        },
        resolve,
      });
    });
  }

  // ---- 自动发布：每 10 秒扫描一次本地草稿，闲置超过 30 秒的自动推送到服务器 ----
  // 仅在用户开启「自动同步至云端」时启用
  useAutoPublish(localStorage.getItem("mdocs.autoPublish") === "true", (docId) =>
    publishDraftFromList(docId, { source: "auto" }),
  );

  /**
   * 导航守卫：在切换路由前先触发保存草稿，确保内容不丢失。
   */
  async function guardNavigate(onProceed: () => void): Promise<void> {
    // 先调用 DocumentEditor 暴露的 saveDraft，等待保存完成
    await saveBeforeNavRef.current?.();
    // 保存完成后再执行真正的导航操作
    onProceed();
  }

  function fileNameFromTitle(title: string): string {
    const raw = title.trim() || "untitled";
    const safe = raw.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
    return safe.endsWith(".md") ? safe : `${safe}.md`;
  }

  /** Agent get_editor_draft：静默取主栏当前稿（MD/HTML，非 Lexical） */
  async function provideEditorDraft(documentId: string): Promise<
    | {
        status: "ok";
        documentId: string;
        content: string;
        contentFormat: "markdown" | "html" | "plain";
        source: "editor" | "indexeddb";
        localBaseCommitId?: string | null;
        displayName?: string;
      }
    | { status: "unavailable"; reason: string }
  > {
    if (!activeDocMeta || activeDocMeta.documentId !== documentId) {
      return { status: "unavailable", reason: "not_active_document" };
    }
    if (activeDocMeta.fileType === FILE_TYPE.SHEET) {
      return { status: "unavailable", reason: "sheet_not_supported" };
    }
    const isHtml = activeDocMeta.fileType === FILE_TYPE.HTML;

    if (editorContent && editorContent.documentId === documentId) {
      if (isHtml) {
        return {
          status: "ok",
          documentId,
          content: editorContent.content,
          contentFormat: "html",
          source: "editor",
          localBaseCommitId: editBaseCommitId,
          displayName: editorContent.displayName,
        };
      }
      let markdown = exportMarkdownRef.current?.() ?? "";
      if (!markdown.trim()) {
        try {
          const converted = await convertContentApi({
            content: editorContent.content,
            from: "lexical",
            to: "markdown",
          });
          markdown = converted.content;
        } catch {
          return { status: "unavailable", reason: "convert_failed" };
        }
      }
      return {
        status: "ok",
        documentId,
        content: markdown,
        contentFormat: "markdown",
        source: "editor",
        localBaseCommitId: editBaseCommitId,
        displayName: editorContent.displayName,
      };
    }

    const draft = await getDraft(documentId);
    if (!draft) return { status: "unavailable", reason: "no_draft" };
    if (draft.contentKind === "sheet") {
      return { status: "unavailable", reason: "sheet_not_supported" };
    }
    if (isHtml || draft.contentKind === "html") {
      return {
        status: "ok",
        documentId,
        content: draft.content,
        contentFormat: "html",
        source: "indexeddb",
        localBaseCommitId: draft.localBaseCommitId ?? editBaseCommitId,
        displayName: draft.displayName,
      };
    }
    try {
      const converted = await convertContentApi({
        content: draft.content,
        from: "lexical",
        to: "markdown",
      });
      return {
        status: "ok",
        documentId,
        content: converted.content,
        contentFormat: "markdown",
        source: "indexeddb",
        localBaseCommitId: draft.localBaseCommitId ?? editBaseCommitId,
        displayName: draft.displayName,
      };
    } catch {
      return { status: "unavailable", reason: "convert_failed" };
    }
  }

  async function openAiWriteForCurrentDoc(): Promise<void> {
    if (!activeDocMeta || !editorContent) return;
    if (activeDocMeta.fileType === FILE_TYPE.SHEET) return;
    await saveBeforeNavRef.current?.();
    const isHtml = activeDocMeta.fileType === FILE_TYPE.HTML;
    let markdown = "";
    if (isHtml) {
      markdown = htmlToAiWriteSeed(editorContent.content);
    } else {
      // 必须用 lobe 官方 markdown 导出；convert lexical→md 只是纯文本近似，会丢掉 MD 结构
      markdown = exportMarkdownRef.current?.() ?? "";
      if (!markdown.trim()) {
        try {
          const converted = await convertContentApi({
            content: editorContent.content,
            from: "lexical",
            to: "markdown",
          });
          markdown = converted.content;
        } catch {
          markdown = "";
        }
      }
    }
    setAiWriteBoot({
      markdown,
      documentId: activeDocMeta.documentId,
      displayName: editorContent.displayName || activeDocMeta.displayName || "未命名",
      fileType: isHtml ? FILE_TYPE.HTML : FILE_TYPE.DOCUMENT,
    });
    setAiWriteOpen(true);
    setAgentPanelOpen(false);
  }

  function openAiWriteBlank(): void {
    setAiWriteBoot({
      markdown: "",
      documentId: null,
      displayName: "未命名",
      fileType: FILE_TYPE.DOCUMENT,
    });
    setAiWriteOpen(true);
    setAgentPanelOpen(false);
  }

  /** Ask：用户选「打开帮写审阅」后按 documentId 打开工作台 */
  async function openAiWriteForDocument(payload: {
    documentId: string;
    displayName: string;
  }): Promise<void> {
    const documentId = payload.documentId.trim();
    if (!documentId) return;
    await saveBeforeNavRef.current?.();
    let markdown = "";
    let displayName = payload.displayName.trim() || "未命名";
    let fileType: string = FILE_TYPE.DOCUMENT;
    try {
      const doc = await getDocumentApi(documentId);
      displayName = doc.displayName?.trim() || displayName;
      if (doc.fileType === FILE_TYPE.SHEET) return;
      fileType = doc.fileType === FILE_TYPE.HTML ? FILE_TYPE.HTML : FILE_TYPE.DOCUMENT;
      if (fileType === FILE_TYPE.HTML) {
        markdown = htmlToAiWriteSeed(doc.content);
      } else {
        try {
          const converted = await convertContentApi({
            content: doc.content,
            from: "lexical",
            to: "markdown",
          });
          markdown = converted.content;
        } catch {
          markdown = "";
        }
      }
    } catch {
      /* 读失败仍打开空稿 */
    }
    setAiWriteBoot({ markdown, documentId, displayName, fileType });
    setAiWriteOpen(true);
    setAgentPanelOpen(false);
    setView("docs");
    void guardNavigate(() => navigate(`/doc/${documentId}`));
  }

  /** AI 覆写文档成功：直接触发拉取更新逻辑 */
  /**
   * 助手已在服务端发布成功：若当前正打开该文，清本地草稿并拉远端（等同「拉取更新」且不被草稿挡住）。
   */
  async function handleDocumentOverwritten(payload: {
    documentId: string;
    headCommitId: string;
  }): Promise<void> {
    const docId = payload.documentId;
    const hitPrimary = activeDocMeta?.documentId === docId;
    const hitSecondary = secondaryMeta?.documentId === docId;
    if (!hitPrimary && !hitSecondary) return;

    await deleteDraft(docId);
    await clearDraftConflict(docId);
    await clearDraftPublishError(docId);

    try {
      const doc = await getDocumentApi(docId);
      if (hitPrimary) {
        expectedDocIdRef.current = docId;
        setActiveDocMeta(documentDetailToMeta(doc));
        loadEditorFromServer(doc);
        setEditorDraftExists(false);
        setEditBaseCommitId(doc.headCommitId ?? null);
      }
      if (hitSecondary) {
        setSecondaryMeta(documentDetailToMeta(doc));
        setSecondaryContent({
          documentId: doc.documentId,
          content: doc.content,
          displayName: doc.displayName,
        });
        setSecondaryDraftExists(false);
        setSecondaryRevision((r) => r + 1);
      }
      setMessage(t("syncPullDone"));
      window.setTimeout(() => setMessage(null), 1200);
    } catch (err) {
      setAlertMessage(translateError(t, err));
    }
  }

  async function completeAiWrite(result: {
    markdown: string;
    documentId: string | null;
    displayName: string;
  }): Promise<{ documentId: string }> {
    const targetFileType =
      result.documentId && aiWriteBoot?.documentId === result.documentId
        ? aiWriteBoot.fileType
        : activeDocMeta?.documentId === result.documentId
          ? activeDocMeta.fileType
          : FILE_TYPE.DOCUMENT;
    const isHtml = targetFileType === FILE_TYPE.HTML;

    if (result.documentId) {
      const meta = activeDocMeta?.documentId === result.documentId ? activeDocMeta : null;
      let draftContent: string;
      if (isHtml) {
        draftContent = aiWriteResultToHtml(result.markdown);
      } else {
        const converted = await convertContentApi({
          content: result.markdown,
          from: "markdown",
          to: "lexical",
        });
        draftContent = converted.content;
      }
      await upsertContentDraft({
        documentId: result.documentId,
        content: draftContent,
        displayName: result.displayName,
        localBaseCommitIdAtEditStart: meta?.headCommitId ?? null,
        contentKind: isHtml ? "html" : "lexical",
        snapshotMeta: meta
          ? {
              permission: meta.permission,
              ownerVisitorId: meta.ownerVisitorId,
              domainId: meta.domainId,
            }
          : undefined,
      });
      if (activeDocMeta?.documentId === result.documentId) {
        setEditorContent({
          documentId: result.documentId,
          content: draftContent,
          displayName: result.displayName,
        });
        setContentRevision((r) => r + 1);
        setEditorDraftExists(true);
      } else {
        await openDocument(result.documentId);
      }
      setMessage("帮写已写入草稿，可在编辑器中继续修改后发布");
      return { documentId: result.documentId };
    }

    const created = await createDocumentApi({
      fileName: fileNameFromTitle(result.displayName),
      displayName: result.displayName,
      content: result.markdown,
      contentFormat: "markdown",
      domainId: currentDomainId || undefined,
      parentId: undefined,
    });
    await refreshTree();
    await openDocument(created.documentId);
    setMessage("已创建文档");
    return { documentId: created.documentId };
  }

  /**
   * 组件挂载后执行应用启动引导。
   */
  useEffect(() => {
    void bootstrap();
  }, []);

  /**
   * 全局 Toast 消息：展示后点击页面任意位置自动消失。
   */
  useEffect(() => {
    // 如果没有消息，不需要监听点击
    if (!message) return;
    // 定义点击任意位置关闭 Toast 的处理器
    const dismiss = (): void => {
      setMessage(null);
    };
    // 在捕获阶段监听 pointerdown，确保能拦截到点击
    window.addEventListener("pointerdown", dismiss, true);
    // 清理函数：组件卸载或 message 变化时移除监听，防止内存泄漏
    return () => window.removeEventListener("pointerdown", dismiss, true);
  }, [message]);

  // 全局 API 错误统一弹窗入口：网络层抛出的 ApiRequestError 会分发该事件。
  useEffect(() => {
    const onApiError = (ev: Event): void => {
      const custom = ev as CustomEvent<{ status?: number; code?: string; message?: string }>;
      // 409 冲突统一由业务弹窗处理（如 ConflictModal / MergeView），不走通用错误弹窗
      if (custom.detail?.status === 409) return;
      // 未配置 AI：由发起页面自行引导（如图谱页给出「配置 AI」入口），弹窗只会盖住它
      if (custom.detail?.code === "AI_NOT_CONFIGURED") return;
      const msg = custom.detail?.message;
      if (msg) setAlertMessage(msg);
    };
    window.addEventListener(MDOCS_API_ERROR_EVENT, onApiError);
    return () => window.removeEventListener(MDOCS_API_ERROR_EVENT, onApiError);
  }, []);

  /**
   * 应用启动引导：先尝试 Cookie 静默登录 → 失败再走注册页。
   * 浏览器自动携带 Cookie，无需 localStorage。
   */
  async function bootstrap(): Promise<void> {
    // Demo 模式由构建参数 VITE_DEMO_MODE 决定，编译后固定
    if (isDemoMode()) {
      const me = await fetchMe();
      setVisitor(me);
      await initDomainsAndTree(me.visitorId, setDomains, setCurrentDomainId, refreshTree);
      setPhase("ready");
      return;
    }

    try {
      // 直接尝试获取当前访客信息：
      // - 如果有 Cookie（其他端口设置的）→ 直接登录成功
      // - 如果 401 → 进入注册页
      const me = await fetchMe();
      // Cookie 认证成功
      setVisitor(me);
      // 保存访客 ID 到 localStorage，Token 由后端通过 Cookie 管理
      storeVisitorId(me.visitorId);
      await initDomainsAndTree(me.visitorId, setDomains, setCurrentDomainId, refreshTree);
      setPhase("ready");
    } catch (err) {
      // 401 = 未登录，正常进入注册页
      if (err instanceof ApiRequestError && err.status === 401) {
        setPhase("needsRegister");
        return;
      }
      // 其他错误（如网络错误）显示错误提示
      setAlertMessage(translateError(t, err));
      setPhase("needsRegister");
    }
  }

  /**
   * 处理访客注册：调用注册接口 → 后端自动设 Cookie → 初始化域与树。
   */
  async function handleRegister(visitorName: string, password?: string): Promise<void> {
    // 向后端提交访客名称和密码，创建新身份
    const res = await registerVisitorApi(visitorName, password);
    // 更新 React 状态中的访客信息
    setVisitor(res.visitor);
    // 触发访客 ID 提示条，提醒用户保存 ID 以便恢复
    setPendingVisitorId(res.visitor.visitorId);
    // 保存恢复码用于展示
    setRecoveryCode(res.recoveryCode);
    // 保存访客 ID 到 localStorage，Cookie 已由后端自动设置
    storeVisitorId(res.visitor.visitorId);
    // 加载域列表和文档树
    await initDomainsAndTree(res.visitor.visitorId, setDomains, setCurrentDomainId, refreshTree);
    // 切换到 ready 阶段，展示主界面
    setPhase("ready");
  }

  /** 恢复码找回：已通过 storeIdentity 保存身份，只需加载数据进入主界面 */
  async function handleRecover(visitorId: string): Promise<void> {
    const me = await fetchMe();
    setVisitor(me);
    await initDomainsAndTree(me.visitorId, setDomains, setCurrentDomainId, refreshTree);
    setPhase("ready");
  }

  /**
   * 刷新指定域（或当前域）的文档树数据。
   */
  async function refreshTree(domainId?: string): Promise<TreeNode[]> {
    // 如果没有传入 domainId，则使用当前激活的域
    const did = domainId ?? currentDomainId;
    // 向后端请求该域的文档树结构
    const nodes = await fetchTreeApi(did);
    // 更新侧边栏树数据
    setTree(nodes);
    return nodes;
  }

  function loadEditorFromServer(doc: DocumentDetail): void {
    setEditorContent({
      documentId: doc.documentId,
      content: doc.content,
      displayName: doc.displayName,
    });
    setContentRevision((r) => r + 1);
    setEditorDraftExists(false);
  }

  /** 版本历史恢复：对齐 head + 正文，清本地草稿。 */
  async function handleVersionRestored(doc: DocumentDetail): Promise<void> {
    await deleteDraft(doc.documentId);
    if (activeDocMeta?.documentId === doc.documentId) {
      setActiveDocMeta(documentDetailToMeta(doc));
      loadEditorFromServer(doc);
    }
    if (secondaryMeta?.documentId === doc.documentId) {
      setSecondaryMeta(documentDetailToMeta(doc));
      setSecondaryContent({
        documentId: doc.documentId,
        content: doc.content,
        displayName: doc.displayName,
      });
      setSecondaryRevision((r) => r + 1);
      setSecondaryDraftExists(false);
    }
  }

  function loadEditorFromDraft(docId: string, draft: NonNullable<Awaited<ReturnType<typeof getDraft>>>): void {
    setEditorContent({
      documentId: docId,
      content: draft.content,
      displayName: draft.displayName,
    });
    setContentRevision((r) => r + 1);
    setEditorDraftExists(true);
  }

  /**
   * publish 成功后：删草稿 + GET 拉新 meta。
   * 若仍打开本篇：更新 head / 清「未保存」；当服务端正文与刚发布内容一致时不 bump contentRevision，
   * 避免 editor.setDocument 整棵重挂导致视口跳动。
   */
  async function finalizeAfterPublish(
    docId: string,
    publishedContent?: string,
  ): Promise<DocumentDetail> {
    await deleteDraft(docId);
    const doc = await getDocumentApi(docId);
    if (activeDocMeta?.documentId === docId && expectedDocIdRef.current === docId) {
      setActiveDocMeta(documentDetailToMeta(doc));
      setEditorDraftExists(false);

      const prev = editorContentRef.current;
      const serverMatchesPublished =
        publishedContent !== undefined && doc.content === publishedContent;
      const serverMatchesLoaded =
        prev?.documentId === docId && prev.content === doc.content;

      if (serverMatchesPublished || serverMatchesLoaded) {
        // Keep DOM: do not change `content` in editorContent (that prop alone would setDocument).
        if (prev?.documentId === docId && prev.displayName !== doc.displayName) {
          setEditorContent({ ...prev, displayName: doc.displayName });
        }
      } else {
        loadEditorFromServer(doc);
      }
    }
    if (secondaryMeta?.documentId === docId) {
      setSecondaryMeta(documentDetailToMeta(doc));
      setSecondaryDraftExists(false);
      const serverMatchesPublished =
        publishedContent !== undefined && doc.content === publishedContent;
      const prev = secondaryContent;
      const serverMatchesLoaded = prev?.documentId === docId && prev.content === doc.content;
      if (!(serverMatchesPublished || serverMatchesLoaded)) {
        setSecondaryContent({
          documentId: doc.documentId,
          content: doc.content,
          displayName: doc.displayName,
        });
        setSecondaryRevision((r) => r + 1);
      } else if (prev && prev.displayName !== doc.displayName) {
        setSecondaryContent({ ...prev, displayName: doc.displayName });
      }
    }
    return doc;
  }

  /**
   * 打开文档：GET 写入 activeDocMeta；正文互斥来自草稿或 GET。
   */
  // ---- 知识图谱 ----
  function clearEditorSplit(): void {
    setSplitOpen(false);
    saveEditorSplitOpen(false);
    setSecondaryMeta(null);
    setSecondaryContent(null);
    setSecondaryDraftExists(false);
    saveEditorSplitSecondaryId(null);
    setFocusedPane("primary");
  }

  function closeSecondaryPane(): void {
    clearEditorSplit();
    if (activeDocMeta) {
      setFocus({ kind: "document", documentId: activeDocMeta.documentId });
    }
  }

  function openGraph(
    resourceId: string,
    name: string,
    scope: "folder" | "domain" = "folder",
  ): void {
    console.log("[openGraph]", scope, resourceId, name);
    // 切到图谱焦点：清文档焦点（activeDocMeta 清空，编辑器卸载）+ 清分屏
    clearEditorSplit();
    setActiveDocMeta(null);
    setEditorContent(null);
    setFocus({ kind: "graph", scope, resourceId, name });
  }

  function closeGraph(): void {
    // 清图谱焦点，回无焦点状态
    setFocus(null);
  }

  // 点击外部关闭创建类型下拉
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target as Node)) {
        setCreateDropdownOpen(false);
      }
    }
    if (createDropdownOpen) {
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }
  }, [createDropdownOpen]);

  async function loadDocIntoSecondary(docId: string): Promise<void> {
    try {
      const draft = await getDraft(docId);
      const doc = await getDocumentApi(docId);
      if (doc.domainId !== currentDomainId) {
        localStorage.setItem("mdocs.currentDomainId", doc.domainId);
        setCurrentDomainId(doc.domainId);
        void refreshTree(doc.domainId);
      }
      if (doc.headCommitId && draft && !draft.published) {
        if (draft.publishError === DRAFT_PUBLISH_ERROR.SYNC_HEAD_MISSING) {
          await clearDraftPublishError(docId);
        }
        if (!draft.localBaseCommitId) {
          await saveDraftRecord({ ...draft, localBaseCommitId: doc.headCommitId });
        }
      }
      setSecondaryMeta(documentDetailToMeta(doc));
      if (draft && !draft.published) {
        setSecondaryContent({
          documentId: docId,
          content: draft.content,
          displayName: draft.displayName,
        });
        setSecondaryDraftExists(true);
      } else {
        setSecondaryContent({
          documentId: doc.documentId,
          content: doc.content,
          displayName: doc.displayName,
        });
        setSecondaryDraftExists(false);
      }
      setSecondaryRevision((r) => r + 1);
      setSplitOpen(true);
      saveEditorSplitOpen(true);
      saveEditorSplitSecondaryId(docId);
      setFocusedPane("secondary");
      setFocus({ kind: "document", documentId: docId });
      setView("docs");
      setRecentTabsByPane(
        touchRecentDocTab("secondary", {
          documentId: doc.documentId,
          displayName:
            (draft && !draft.published && draft.displayName) ||
            doc.displayName ||
            doc.relativePath ||
            "",
          domainId: doc.domainId,
          fileType:
            doc.fileType === FILE_TYPE.HTML || doc.fileType === FILE_TYPE.SHEET
              ? doc.fileType
              : FILE_TYPE.DOCUMENT,
        }),
      );
      // URL 仍指向上栏文档，避免 /doc/:id effect 把下栏文加载进 primary
    } catch (err) {
      setAlertMessage(translateError(t, err));
    }
  }

  /** 在下方打开（PC 分屏下栏）；禁止与上栏同 id */
  async function openDocumentBelow(docId: string): Promise<void> {
    if (isNarrow) {
      void openDocument(docId);
      return;
    }
    if (activeDocMeta?.documentId === docId) {
      setMessage(t("editorSplitSameDoc"));
      window.setTimeout(() => setMessage(null), 2000);
      return;
    }
    if (secondaryMeta?.documentId === docId && splitOpen) {
      setFocusedPane("secondary");
      return;
    }
    if (!activeDocMeta) {
      // 尚无上栏：先当普通打开
      void openDocument(docId);
      return;
    }
    await loadDocIntoSecondary(docId);
  }

  async function openDocument(docId: string): Promise<void> {
    expectedDocIdRef.current = docId;
    setView("docs");
    // 切到文档焦点：清图谱焦点
    setFocus({ kind: "document", documentId: docId });
    setFocusedPane("primary");
    try {
      const draft = await getDraft(docId);
      if (expectedDocIdRef.current !== docId) return;

      const doc = await getDocumentApi(docId);
      if (expectedDocIdRef.current !== docId) return;

      if (doc.domainId !== currentDomainId) {
        localStorage.setItem("mdocs.currentDomainId", doc.domainId);
        setCurrentDomainId(doc.domainId);
        void refreshTree(doc.domainId);
      }
      setSelectedCreateParentPath(parentDirForCreates(doc.relativePath));

      if (doc.headCommitId && draft && !draft.published) {
        if (draft.publishError === DRAFT_PUBLISH_ERROR.SYNC_HEAD_MISSING) {
          await clearDraftPublishError(docId);
        }
        if (!draft.localBaseCommitId) {
          await saveDraftRecord({ ...draft, localBaseCommitId: doc.headCommitId });
        }
      }

      // 禁止与下栏同 id
      if (splitOpen && secondaryMeta?.documentId === docId) {
        setSecondaryMeta(null);
        setSecondaryContent(null);
        setSplitOpen(false);
        saveEditorSplitOpen(false);
        saveEditorSplitSecondaryId(null);
      }

      setActiveDocMeta(documentDetailToMeta(doc));
      if (expectedDocIdRef.current !== docId) return;

      setRecentTabsByPane(
        touchRecentDocTab("primary", {
          documentId: doc.documentId,
          displayName:
            (draft && !draft.published && draft.displayName) ||
            doc.displayName ||
            doc.relativePath ||
            "",
          domainId: doc.domainId,
          fileType:
            doc.fileType === FILE_TYPE.HTML || doc.fileType === FILE_TYPE.SHEET
              ? doc.fileType
              : FILE_TYPE.DOCUMENT,
        }),
      );

      if (draft && !draft.published) {
        loadEditorFromDraft(docId, draft);
      } else {
        loadEditorFromServer(doc);
      }
    } catch (err) {
      if (expectedDocIdRef.current !== docId) return;
      setAlertMessage(translateError(t, err));
    }
  }

  function handleRecentTabSelect(pane: RecentTabsPane, tab: RecentDocTab): void {
    if (pane === "secondary") {
      void openDocumentBelow(tab.documentId);
      return;
    }
    void guardNavigate(() => navigate(`/doc/${tab.documentId}`));
  }

  function handleRecentTabClose(pane: RecentTabsPane, documentId: string): void {
    const next = removeRecentDocTab(pane, documentId);
    setRecentTabsByPane(next);

    if (pane === "secondary") {
      if (next.secondary.length === 0) {
        closeSecondaryPane();
        return;
      }
      if (secondaryMeta?.documentId === documentId) {
        void loadDocIntoSecondary(next.secondary[0]!.documentId);
      }
      return;
    }

    if (activeDocMeta?.documentId !== documentId) return;
    if (next.primary.length > 0) {
      void guardNavigate(() => navigate(`/doc/${next.primary[0]!.documentId}`));
      return;
    }
    // 上栏标签清空：若有下栏则升格
    if (splitOpen && secondaryMeta) {
      const secId = secondaryMeta.documentId;
      setRecentTabsByPane(promoteSecondaryTabsToPrimary());
      clearEditorSplit();
      void guardNavigate(() => navigate(`/doc/${secId}`));
      return;
    }
    void guardNavigate(() => {
      expectedDocIdRef.current = null;
      setFocus(null);
      setActiveDocMeta(null);
      setEditorContent(null);
      setEditBaseCommitId(null);
      clearEditorSplit();
      navigate("/");
    });
  }

  function handleTabsPinnedChange(pinned: boolean): void {
    saveTabsPinned(pinned);
    setTabsPinned(pinned);
  }

  function handleLobeToolbarVisibleChange(visible: boolean): void {
    saveLobeToolbarVisible(visible);
    setLobeToolbarVisible(visible);
  }

  function buildRecentTabsProps(pane: RecentTabsPane): RecentDocTabsProps | null {
    if (isNarrow) return null;
    const tabs = recentTabsByPane[pane];
    if (tabs.length === 0) return null;
    const activeId =
      pane === "primary"
        ? (activeDocMeta?.documentId ?? null)
        : (secondaryMeta?.documentId ?? null);
    const fileType = pane === "primary" ? activeDocMeta?.fileType : secondaryMeta?.fileType;
    const isMdPane = fileType !== FILE_TYPE.HTML && fileType !== FILE_TYPE.SHEET;
    return {
      tabs,
      activeDocumentId: activeId,
      pinned: tabsPinned,
      onPinnedChange: handleTabsPinnedChange,
      onSelect: (tab) => handleRecentTabSelect(pane, tab),
      onClose: (id) => handleRecentTabClose(pane, id),
      ...(isMdPane
        ? {
            lobeToolbarVisible,
            onLobeToolbarVisibleChange: handleLobeToolbarVisibleChange,
          }
        : {}),
    };
  }


  /**
   * URL 中的 documentId 变化或应用就绪后，自动打开对应文档。
   * 无 documentId 时清空编辑器展示欢迎页。
   */
  useEffect(() => {
    // 只有在应用完全初始化后才处理文档打开
    if (phase !== "ready") return;
    if (documentId) {
      // URL 中有文档 ID，尝试打开该文档（上栏）
      void openDocument(documentId).then(() => {
        if (isNarrow) return;
        const wantSplit = loadEditorSplitOpen();
        const secId = loadEditorSplitSecondaryId();
        if (wantSplit && secId && secId !== documentId) {
          void loadDocIntoSecondary(secId);
        }
      });
    } else {
      // 无文档 ID → 无焦点（欢迎页）
      setFocus(null);
      setActiveDocMeta(null);
      setEditorContent(null);
      setEditBaseCommitId(null);
      clearEditorSplit();
    }
    // 注意：openDocument 在 effect 内部定义，eslint 会提示缺少依赖
    // 但将 openDocument 加入依赖会导致无限循环，因此忽略该规则
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, documentId]);

  /**
   * 冷启动且地址里没有文档时：
   * - 上次开着文章 → 打开那篇
   * - 上次没开文章 → 只恢复上次的域（欢迎页）
   * 地址已带 /doc/:id（刷新或分享链接）则尊重地址。
   */
  useEffect(() => {
    if (phase !== "ready" || sessionBootRef.current) return;
    sessionBootRef.current = true;
    const urlDocId = documentId;
    void (async () => {
      try {
        if (!urlDocId) {
          const session = await loadLastSession();
          if (session?.domainId) {
            localStorage.setItem("mdocs.currentDomainId", session.domainId);
            setCurrentDomainId(session.domainId);
            await refreshTree(session.domainId);
          }
          if (session?.view === "settings") {
            setView("settings");
          } else if (session?.graph) {
            openGraph(session.graph.resourceId, session.graph.name, session.graph.scope);
          } else if (session?.documentId) {
            navigate(`/doc/${session.documentId}`);
          }
          // 否则停在欢迎页，域已在上面恢复
        }
      } finally {
        setSessionReady(true);
      }
    })();
    // 只在进入 ready 时读一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "ready" || !sessionReady) return;
    // 只认地址上的文档 id，不用 focus 兜底：退回欢迎页时 focus 可能晚一拍清空，会把旧文章又写回去
    const session = {
      domainId: currentDomainId,
      view,
      documentId: view === "docs" ? (documentId ?? null) : null,
      graph:
        view === "docs" && focus?.kind === "graph"
          ? { scope: focus.scope, resourceId: focus.resourceId, name: focus.name }
          : null,
    };
    if (session.domainId) {
      localStorage.setItem("mdocs.currentDomainId", session.domainId);
    }
    const timer = window.setTimeout(() => {
      void saveLastSession(session);
    }, 300);
    const flush = () => {
      void saveLastSession(session);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [phase, sessionReady, currentDomainId, view, documentId, focus]);

  // ---- 新建文档/文件夹模态框的相关状态和操作 ----
  const {
    createModal,
    setCreateModal,
    createModalError,
    createModalBusy,
    createModalInputRef,
    openNewDocumentModal,
    openNewFolderModal,
    submitCreateModal,
  } = useCreateModal({
    tree,
    currentDomainId,
    selectedCreateParentPath,
    t,
    // 文档创建成功后的回调：设置为当前文档并跳转路由
    onDocCreated: (doc: DocumentDetail) => {
      setActiveDocMeta(documentDetailToMeta(doc));
      loadEditorFromServer(doc);
      setRevealFolderId(null);
      setSelectedCreateParentPath(parentDirForCreates(doc.relativePath));
      navigate(`/doc/${doc.documentId}`);
    },
    onFolderCreated: ({ folderId, path }) => {
      setSelectedCreateParentPath(path);
      setRevealFolderId(folderId);
    },
    refreshTree,
  });

  // ---- 退出确认弹窗 ----
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ---- 文档搜索浮层 ----
  const [docSearchOpen, setDocSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() !== "k") return;
      // 输入框内仍允许唤起（覆盖浏览器默认）
      ev.preventDefault();
      setDocSearchOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- 收藏列表弹窗 ----
  const [showBookmarksDialog, setShowBookmarksDialog] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  /**
   * 加载收藏列表。
   */
  async function loadBookmarks(): Promise<void> {
    try {
      const list = await fetchBookmarksApi();
      setBookmarks(list);
    } catch (err) {
      setAlertMessage(translateError(t, err));
    }
  }

  /** 域 ID → 域名称 的查找表 */
  const domainNameLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    for (const d of domains) {
      lookup[d.domainId] = d.domainName;
    }
    return lookup;
  }, [domains]);

  /** 筛选后的收藏列表 */
  const filteredBookmarks = useMemo(() => {
    let list = bookmarks;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((bm) => bm.displayName?.toLowerCase().includes(q));
    }
    if (selectedDomainId) {
      list = list.filter((bm) => bm.domainId === selectedDomainId);
    }
    return list;
  }, [bookmarks, searchQuery, selectedDomainId]);

  /** 收藏中出现的域列表（用于筛选下拉） */
  const uniqueDomains = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const bm of bookmarks) {
      const did = bm.domainId;
      if (did && !seen.has(did)) {
        seen.add(did);
        result.push({ id: did, name: domainNameLookup[did] ?? did });
      }
    }
    return result;
  }, [bookmarks, domainNameLookup]);

  async function persistPublishConflict(
    documentId: string,
    localContent: string,
    displayName: string,
    localBaseCommitId: string,
    details: VersionConflictDetails,
  ): Promise<void> {
    let draft = await getDraft(documentId);
    if (!draft && activeDocMeta?.documentId === documentId) {
      draft = {
        documentId,
        content: localContent,
        displayName,
        updatedAt: Date.now(),
        published: false,
        localBaseCommitId,
        permission: activeDocMeta.permission,
        ownerVisitorId: activeDocMeta.ownerVisitorId,
        domainId: activeDocMeta.domainId,
      };
      await saveDraftRecord(draft);
    }
    if (draft) {
      await saveDraftConflict(documentId, {
        localBaseCommitId,
        conflictStatus: "publish_conflict",
        conflict: {
          localBaseCommitId,
          remoteCommitId: details.headCommitId,
          localSnapshotContent: localContent,
        },
      });
    }
    setConflictModalOpen(true);
  }

  async function handleForceOverwrite(): Promise<void> {
    if (!activeDocMeta || forceOverwriteBusy) return;
    if (visitor?.visitorId !== activeDocMeta.ownerVisitorId) return;
    const ok = window.confirm(t("conflictForceConfirm"));
    if (!ok) return;

    const documentId = activeDocMeta.documentId;
    setForceOverwriteBusy(true);
    try {
      await getDocumentTaskQueue(documentId).execute(async () => {
        const draft = await getDraft(documentId);
        const localBaseCommitId =
          draft?.conflict?.localBaseCommitId ??
          draft?.localBaseCommitId ??
          editBaseCommitId ??
          activeDocMeta.headCommitId;
        const localContent =
          draft?.conflict?.localSnapshotContent ??
          draft?.content ??
          editorContentRef.current?.content;
        const displayName =
          draft?.displayName ??
          editorContentRef.current?.displayName ??
          activeDocMeta.displayName;

        // 与整表 merge 一致：强制覆盖前刷新 tip，避免缓存 remoteCommitId 过期
        const tip = await getDocumentApi(documentId);
        const remoteCommitId = tip.headCommitId;

        if (!localBaseCommitId || !remoteCommitId || localContent == null) {
          setAlertMessage(t("syncHeadMissing"));
          throw new Error("missing force overwrite payload");
        }

        const message = await requestPublishMessage(localContent, documentId);
        if (message === null) {
          setMessage(t("publishMessageCancelled"));
          window.setTimeout(() => setMessage(null), 1200);
          return;
        }
        await updateDocumentApi(documentId, {
          content: localContent,
          displayName,
          version: {
            localBaseCommitId,
            merge: {
              remoteCommitId,
              localSnapshotContent: localContent,
              forceLocal: true,
            },
          },
          message,
          source: "manual",
        });
        const updated = await getDocumentApi(documentId);
        await handleMergeSuccess(updated);
      });
    } catch (err) {
      if (!(err instanceof Error && err.message === "missing force overwrite payload")) {
        setAlertMessage(translateError(t, err));
      }
    } finally {
      setForceOverwriteBusy(false);
    }
  }

  /**
   * 发布文档：带 version.localBaseCommitId 乐观锁；手动入口先弹发布说明。
   */
  async function publishDocument(content: string, displayName: string, documentId: string, permission?: number): Promise<void> {
    const message = await requestPublishMessage(content, documentId);
    if (message === null) {
      setMessage(t("publishMessageCancelled"));
      window.setTimeout(() => setMessage(null), 1200);
      return;
    }
    return getDocumentTaskQueue(documentId).execute(async () => {
      const draftForPublish = await getDraft(documentId);
      const localBaseCommitId =
        draftForPublish?.localBaseCommitId ??
        (activeDocMeta?.documentId === documentId ? activeDocMeta.headCommitId : undefined) ??
        (secondaryMeta?.documentId === documentId ? secondaryMeta.headCommitId : undefined);
      if (!localBaseCommitId) {
        setAlertMessage(t("syncHeadMissing"));
        throw new Error("missing localBaseCommitId");
      }
      try {
        await updateDocumentApi(documentId, {
          content,
          displayName,
          permission,
          version: { localBaseCommitId },
          message,
          source: "manual",
        });
        await clearDraftConflict(documentId);
        await finalizeAfterPublish(documentId, content);
        await refreshTree();
        setConflictModalOpen(false);
        setMessage(t("published"));
        window.setTimeout(() => setMessage(null), 1200);
      } catch (err) {
        if (
          err instanceof ApiRequestError &&
          err.status === 409 &&
          err.code === "VERSION_CONFLICT" &&
          err.details &&
          typeof err.details === "object"
        ) {
          await persistPublishConflict(
            documentId,
            content,
            displayName,
            localBaseCommitId,
            err.details as VersionConflictDetails,
          );
        }
        throw err;
      }
    });
  }

  /** 无本地未发布草稿时：只读拉远端正文与 meta，不写服务端、不删草稿。 */
  async function executePullRemote(): Promise<void> {
    if (!activeDocMeta) return;
    const doc = await getDocumentApi(activeDocMeta.documentId);
    if (doc.domainId !== currentDomainId) {
      localStorage.setItem("mdocs.currentDomainId", doc.domainId);
      setCurrentDomainId(doc.domainId);
      void refreshTree(doc.domainId);
    }
    setSelectedCreateParentPath(parentDirForCreates(doc.relativePath));
    setActiveDocMeta(documentDetailToMeta(doc));
    loadEditorFromServer(doc);
    setMessage(t("syncPullDone"));
    window.setTimeout(() => setMessage(null), 1200);
  }

  async function handleSyncClick(): Promise<void> {
    if (!activeDocMeta) return;
    const draft = await getDraft(activeDocMeta.documentId);
    const hasUnpublishedDraft = Boolean(draft && !draft.published);
    const conflictPending =
      draft?.conflictStatus === "publish_conflict" ||
      draft?.conflictStatus === "diverged" ||
      Boolean(draft?.conflict);

    // 已有冲突 / 分叉标记 → 进合并（须在「有草稿就 return」之前，否则点击无反馈）
    if (conflictPending) {
      setMergeViewOpen(true);
      return;
    }

    // 有未发布草稿：禁止覆盖式拉取；若已落后远端则打开三路合并
    if (hasUnpublishedDraft && draft) {
      if (syncBehind && remoteCommitId) {
        const editBase = draft.localBaseCommitId ?? editBaseCommitId;
        if (editBase) {
          const built: DraftConflictRecord = {
            localBaseCommitId: editBase,
            remoteCommitId,
            localSnapshotContent: draft.content,
          };
          await saveDraftConflict(activeDocMeta.documentId, {
            localBaseCommitId: editBase,
            conflictStatus: "diverged",
            conflict: built,
          });
          setMergeConflict(built);
        }
        setMergeViewOpen(true);
        return;
      }
      setMessage(t("pullBlockedDraft"));
      window.setTimeout(() => setMessage(null), 3000);
      return;
    }

    await executePullRemote();
  }

  async function handleMergeSuccess(updated: DocumentDetail): Promise<void> {
    // 先关 merge，避免后续 await 期间仍停在合并页（merge PUT 曾返回 204 时尤其易踩）
    setMergeViewOpen(false);
    setConflictModalOpen(false);
    setMergeConflict(null);
    setEditorDraftExists(false);
    await clearDraftConflict(updated.documentId);
    await deleteDraft(updated.documentId);
    await openDocument(updated.documentId);
    void refreshTree(updated.domainId);
    setMessage(t("published"));
    window.setTimeout(() => setMessage(null), 1200);
  }

  /**
   * 草稿发布失败：IndexedDB 打标 + 提示，并抛出以阻止调用方误判成功。
   */
  async function reportDraftPublishFailure(
    docId: string,
    err: unknown,
    draft?: DraftRecord | null,
  ): Promise<never> {
    try {
      await failDraftPublish(docId, err, draft);
    } catch (aborted) {
      if (!(aborted instanceof DraftPublishAborted)) throw aborted;
      const record = draft ?? (await getDraft(docId));
      setMessage(
        formatDraftPublishFailureMessage(t, record, aborted.code, aborted.cause ?? err),
      );
      window.setTimeout(() => setMessage(null), 4000);
      throw aborted;
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  /**
   * 从草稿列表发布单篇草稿（供自动发布或批量/手动发布调用）。
   * 使用乐观锁：仅当草稿在 API 调用期间未被修改时才删除本地草稿。
   * `source: 'auto'` 跳过说明弹框并写入自动发布标记。
   */
  async function publishDraftFromList(
    docId: string,
    opts?: { source?: "auto" | "manual" },
  ): Promise<void> {
    const source = opts?.source ?? "manual";
    let draft: DraftRecord | undefined;
    try {
      const currentPeek = await getDraft(docId);
      if (!currentPeek) return;
      let publishMessage = "";
      if (source === "manual") {
        const picked = await requestPublishMessage(currentPeek.content, docId);
        if (picked === null) {
          setMessage(t("publishMessageCancelled"));
          window.setTimeout(() => setMessage(null), 1200);
          return;
        }
        publishMessage = picked;
      }
      await getDocumentTaskQueue(docId).execute(async () => {
        const current = await getDraft(docId);
        if (!current) return;
        draft = current;
        let localBaseCommitId = current.localBaseCommitId;
        if (!localBaseCommitId) {
          const doc = await getDocumentApi(docId);
          localBaseCommitId = doc.headCommitId ?? undefined;
          if (localBaseCommitId) {
            await saveDraftRecord({ ...current, localBaseCommitId });
            if (current.publishError === DRAFT_PUBLISH_ERROR.SYNC_HEAD_MISSING) {
              await clearDraftPublishError(docId);
            }
          }
        }
        if (!localBaseCommitId) {
          throw new DraftPublishAborted(DRAFT_PUBLISH_ERROR.SYNC_HEAD_MISSING);
        }
        const latest = await getDraft(docId);
        if (!latest) return;
        await updateDocumentApi(docId, {
          content: latest.content,
          displayName: latest.displayName,
          version: { localBaseCommitId },
          ...(source === "auto"
            ? { source: "auto" as const }
            : { source: "manual" as const, message: publishMessage }),
        });
        await clearDraftConflict(docId);
        await clearDraftPublishError(docId);
        if (activeDocMeta?.documentId === docId) {
          await finalizeAfterPublish(docId, latest.content);
        } else {
          await deleteDraft(docId);
        }
        await refreshTree();
        setMessage(t("published"));
        window.setTimeout(() => setMessage(null), 1200);
      });
    } catch (err) {
      await reportDraftPublishFailure(docId, err, draft);
    }
  }

  /** 合并/强制覆盖路径：先弹说明再 PUT。 */
  async function updateDocumentWithPublishMessage(
    documentId: string,
    input: Parameters<typeof updateDocumentApi>[1],
  ): Promise<DocumentDetail | void> {
    const message = await requestPublishMessage(input.content, documentId, input.contentFormat);
    if (message === null) {
      throw new Error(t("publishMessageCancelled"));
    }
    return updateDocumentApi(documentId, {
      ...input,
      message,
      source: "manual",
    });
  }

  /**
   * 触发文档删除：打开确认弹窗（不直接删除）。
   */
  function requestDeleteDocument(documentId: string, label: string): void {
    setDeleteConfirm({ type: "document", id: documentId, name: label });
  }

  /**
   * 触发文件夹删除：打开确认弹窗。
   */
  function requestDeleteFolder(folderDocumentId: string, label: string): void {
    setDeleteConfirm({ type: "folder", id: folderDocumentId, name: label });
  }

  /**
   * 拖拽移动文档：仅 API 成功后刷新树；打开中则更新 meta。非 owner 等错误走全局弹窗（409 需本地提示）。
   */
  async function handleMoveDocument(
    documentId: string,
    parentId: string | null,
  ): Promise<void> {
    try {
      const doc = await moveDocumentApi(documentId, parentId);
      await refreshTree(doc.domainId);
      if (activeDocMeta?.documentId === documentId) {
        setActiveDocMeta(documentDetailToMeta(doc));
        setSelectedCreateParentPath(parentDirForCreates(doc.relativePath));
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        // 409 被全局 API 错误监听跳过；其它错误全局已弹，这里补 409
        if (err.status === 409) setAlertMessage(err.message);
      } else {
        setAlertMessage(translateError(t, err));
      }
    }
  }

  /**
   * 执行删除（用户在确认弹窗中点击「确定」时调用）。
   */
  async function executeDelete(): Promise<void> {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "document") {
        await deleteDocumentApi(deleteConfirm.id);
        // 如果当前正在编辑的就是这篇文档，需要清理编辑器状态
        if (activeDocMeta?.documentId === deleteConfirm.id) {
          setActiveDocMeta(null);
          setEditorContent(null);
          setSelectedCreateParentPath("");
          navigate("/");
        }
      } else if (deleteConfirm.type === "folder") {
        await deleteFolderApi(deleteConfirm.id);
        // 如果删除的文件夹包含当前文档，需要清空编辑器
        // 这里简单处理：先全部刷新，之后让树重新加载
        if (activeDocMeta) {
          setActiveDocMeta(null);
          setEditorContent(null);
          setSelectedCreateParentPath("");
          navigate("/");
        }
      }
      // 刷新文档树
      await refreshTree();
      setMessage(
        deleteConfirm.type === "folder"
          ? `已删除「${deleteConfirm.name}」及其下所有内容`
          : `已删除「${deleteConfirm.name}」`,
      );
      window.setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setAlertMessage(translateError(t, err));
    } finally {
      setDeleteConfirm(null);
    }
  }

  /**
   * 新建文章 / 新建目录（侧栏与贴左助手时的右侧目录共用）。
   * `showExtras`：搜索 + 图谱（仅左侧完整侧栏）。
   */
  function renderSidebarCreateActions(opts: { showExtras: boolean }) {
    return (
      <div className="mdocs-sidebar-actions" ref={createDropdownRef}>
        <button
          type="button"
          className="mdocs-sidebar-create-btn"
          onClick={() => setCreateDropdownOpen((v) => !v)}
        >
          <FileText size={15} strokeWidth={1.75} />
          {t("newArticle")}
        </button>
        {createDropdownOpen ? (
          <div className="mdocs-create-dropdown">
            <button
              type="button"
              className="mdocs-create-dropdown-item"
              onClick={() => {
                setCreateDropdownOpen(false);
                openNewDocumentModal();
              }}
            >
              <FileText size={14} strokeWidth={1.5} />
              Markdown
            </button>
            <button
              type="button"
              className="mdocs-create-dropdown-item"
              onClick={() => {
                setCreateDropdownOpen(false);
                openNewDocumentModal(undefined, "html");
              }}
            >
              <Code size={14} strokeWidth={1.5} />
              HTML
            </button>
            <button
              type="button"
              className="mdocs-create-dropdown-item"
              onClick={() => {
                setCreateDropdownOpen(false);
                openNewDocumentModal(undefined, "sheet");
              }}
            >
              <Table size={14} strokeWidth={1.5} />
              {t("sheetDocument")}
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="mdocs-sidebar-create-btn"
          onClick={() => {
            setCreateDropdownOpen(false);
            openNewFolderModal();
          }}
        >
          <FolderPlus size={15} strokeWidth={1.75} />
          {t("newDirectory")}
        </button>
        {opts.showExtras ? (
          <>
            <span
              className="mdocs-sidebar-icon mdocs-tooltip"
              data-tooltip={t("docSearch")}
              onClick={() => setDocSearchOpen(true)}
            >
              <Search size={18} strokeWidth={1.75} />
            </span>
            <span
              className="mdocs-sidebar-icon mdocs-tooltip"
              data-tooltip="知识图谱"
              onClick={() => openGraph(currentDomainId, "知识图谱", "domain")}
            >
              <Network size={18} strokeWidth={1.75} />
            </span>
          </>
        ) : null}
      </div>
    );
  }

  /** 侧栏 / 贴左右侧轨共用的纯文档树（无 chrome）。 */
  function renderSidebarDocumentTree() {
    return (
      <DocumentTree
        nodes={tree}
        activeDocumentId={activeDocumentId}
        graphFocusAnchorId={focus?.kind === "graph" ? focus.resourceId : null}
        selectedParentPath={selectedCreateParentPath}
        revealNodeId={revealFolderId}
        onOpen={(node, opts) => {
          setRevealFolderId(null);
          if (isNarrow) setMobileNavOpen(false);
          if (opts?.openBelow && !isNarrow) {
            void openDocumentBelow(node.documentId);
            return;
          }
          guardNavigate(() => navigate(`/doc/${node.documentId}`));
        }}
        onOpenFolder={(folderPath, descDocumentId) => {
          guardNavigate(() => {
            setRevealFolderId(null);
            setSelectedCreateParentPath(folderPath);
            if (descDocumentId) {
              closeGraph();
              if (isNarrow) setMobileNavOpen(false);
              navigate(`/doc/${descDocumentId}`);
            }
          });
        }}
        onContextMenu={setMenu}
        onMoveDocument={handleMoveDocument}
        onDeselect={() => {
          // 仅清树「新建目标」选中高亮，不卸载当前正文 / 图谱
          setSelectedCreateParentPath("");
        }}
        onOpenGraph={(node, parentFolderId) => {
          if (node.type === "folder") {
            openGraph(node.documentId, node.name);
          } else if (parentFolderId) {
            const parent = tree.find((n) => n.documentId === parentFolderId) as
              | Extract<TreeNode, { type: "folder" }>
              | undefined;
            openGraph(parentFolderId, parent?.name ?? "图谱");
          }
        }}
        onGenerateGraph={async (node, parentFolderId) => {
          const folderId = node.type === "folder" ? node.documentId : parentFolderId;
          if (!folderId) return;
          const folderName =
            node.type === "folder"
              ? node.name
              : ((tree.find((n) => n.documentId === parentFolderId) as { name?: string } | undefined)
                  ?.name ?? "图谱");
          openGraph(folderId, folderName);
        }}
      />
    );
  }

  // ========== 渲染阶段判断 ==========

  // 如果还在加载中，显示「加载中...」
  if (phase === "loading") {
    return <div className="mdocs-loading muted">{t("loading")}</div>;
  }

  // 如果需要注册，显示注册弹窗
  if (phase === "needsRegister") {
    return (
      <VisitorRegisterDialog
        onSubmit={handleRegister}
        onRecover={handleRecover}
        error={message}
      />
    );
  }

  // ========== 主界面渲染 ==========
  return (
    <div className="mdocs-app-root">
      {/* Demo Mode 提示横幅 — 在 grid 外面 */}
      {isDemoMode() && (
        <div className="mdocs-demo-banner">
          <span>Demo 模式，部分功能被禁用，请勿长期存储重要数据</span>
          <span>·</span>
          <a
            href="https://github.com/xuhuafeifei/mdocs"
            target="_blank"
            rel="noopener noreferrer"
          >
            部署自己的实例 →
          </a>
        </div>
      )}

      <div className="mdocs-shell" ref={shellRef}>
      {/* 根据当前视图渲染设置页或文档页 */}
      {view === "settings" ? (
        <Suspense fallback={<div className="mdocs-main muted" style={{ padding: 24 }}>加载设置…</div>}>
          <SettingsPage
            onBack={() => setView("docs")}
            onPublishDraft={publishDraftFromList}
            onOpenDocument={openDocument}
            onRecoverDraft={() => void refreshTree()}
          />
        </Suspense>
      ) : (
        <div
          ref={mobileNavLayoutRef}
          className={
            "mdocs-layout" +
            (isNarrow ? " mdocs-layout--reader" : "") +
            (isNarrow && mobileNavOpen ? " mdocs-layout--nav-open" : "") +
            (isNarrow && mobileNavSwipe.dragging ? " is-nav-dragging" : "")
          }
          style={
            isNarrow
              ? ({ ["--mdocs-nav-reveal" as string]: `${mobileNavSwipe.revealPx}px` } as CSSProperties)
              : undefined
          }
        >
          {/* ========== 左侧：文档树，或 PC 贴左助手 ========== */}
          <aside
            className={
              agentDockLayout
                ? "mdocs-agent-dock"
                : "mdocs-sidebar" +
                  (isNarrow
                    ? mobileNavOpen
                      ? " mdocs-sidebar--drawer-open"
                      : " mdocs-sidebar--drawer"
                    : sidebarCollapsed
                      ? " mdocs-sidebar-collapsed"
                      : "")
            }
            style={
              agentDockLayout
                ? ({
                    ["--mdocs-agent-dock-width" as string]: `${agentDockWidth}px`,
                  } as CSSProperties)
                : undefined
            }
          >
            {agentDockLayout ? (
              <Suspense fallback={null}>
                <AgentChatPanel
                  ref={agentPanelRef}
                  open={agentPanelOpen}
                  onClose={() => {
                    setAgentPanelOpen(false);
                    setAgentPanelFullscreen(false);
                  }}
                  visitorName={visitor?.visitorName}
                  embedded
                  docked
                  dockWidth={agentDockWidth}
                  onDockWidthChange={setAgentDockWidthPersist}
                  onToggleDock={() => setAgentDockedPersist(false)}
                  domainId={currentDomainId || null}
                  domains={domains}
                  localizeDomainName={(name) => localizeDomainName(name, lang, t)}
                  documentId={focusedDocMeta?.documentId ?? null}
                  documentTitle={focusedDocMeta?.displayName ?? null}
                  documentPath={focusedDocMeta?.relativePath ?? null}
                  graphFileId={focus?.kind === "graph" ? `${focus.resourceId}.graph-file` : null}
                  graphLabel={focus?.kind === "graph" ? focus.name : null}
                  onOpenDocument={(docId) => {
                    setView("docs");
                    void guardNavigate(() => navigate(`/doc/${docId}`));
                  }}
                  onTreeChanged={() => void refreshTree()}
                  onDocumentOverwritten={(payload) => void handleDocumentOverwritten(payload)}
                  onOpenCoding={
                    isNarrow ? undefined : (payload) => void openAiWriteForDocument(payload)
                  }
                  onProvideEditorDraft={provideEditorDraft}
                />
              </Suspense>
            ) : (
              <>
            {/* 品牌 Logo 区域 */}
            <header className="mdocs-sidebar-header">
              <div className="mdocs-brand">
                <img src={mdocsLogo} alt={t("brand")} className="mdocs-brand-logo" />
                <span>{t("brand")}</span>
              </div>
              <button
                type="button"
                className="mdocs-sidebar-toggle"
                onClick={toggleSidebar}
                aria-label={
                  isNarrow
                    ? mobileNavOpen
                      ? t("collapseSidebar")
                      : t("expandSidebar")
                    : sidebarCollapsed
                      ? t("expandSidebar")
                      : t("collapseSidebar")
                }
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
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--mdocs-hover-bg, #f0f0f0)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                {isNarrow ? (
                  <PanelLeftClose size={18} />
                ) : sidebarCollapsed ? (
                  <PanelLeftOpen size={18} />
                ) : (
                  <PanelLeftClose size={18} />
                )}
              </button>
            </header>

            {renderSidebarCreateActions({ showExtras: true })}

            {/* 文档树：递归渲染文件夹和文档 */}
            {renderSidebarDocumentTree()}

            {/* 底部访客信息：点击进入设置页 */}
            <footer className="mdocs-sidebar-footer">
              <div
                style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: "pointer" }}
                onClick={() => guardNavigate(() => setView("settings"))}
              >
                <span className="mdocs-visitor-avatar">
                  {/* 显示访客名称首字母作为头像 */}
                  {visitor ? visitor.visitorName.charAt(0).toUpperCase() : "?"}
                </span>
                <span className="mdocs-visitor-footer-name">{visitor ? visitor.visitorName : ""}</span>
              </div>
              <button
                type="button"
                className="mdocs-sidebar-bookmark mdocs-tooltip"
                data-tooltip={t("bookmark")}
                onClick={() => {
                  setShowBookmarksDialog(true);
                  setSearchQuery("");
                  setSelectedDomainId("");
                  void loadBookmarks();
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                  color: "var(--mdocs-text-muted, #999)",
                  fontSize: "1rem",
                  lineHeight: 1,
                  borderRadius: 4,
                }}
              >
                <Star size={16} strokeWidth={1.5} />
              </button>
              {!isDemoMode() && (
              <button
                type="button"
                className="mdocs-sidebar-logout mdocs-tooltip"
                data-tooltip={t("logout")}
                onClick={() => setShowLogoutConfirm(true)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                  color: "var(--mdocs-text-muted, #999)",
                  lineHeight: 1,
                  borderRadius: 4,
                }}
              >
                <LogOut size={16} strokeWidth={1.5} />
              </button>
              )}
            </footer>
              </>
            )}
          </aside>

          {/* ========== 主内容区 ========== */}
          <main className="mdocs-main">
            {focus?.kind === "graph" ? (
              <GraphPage
                key={`${focus.scope}-${focus.resourceId}`}
                scope={focus.scope}
                resourceId={focus.resourceId}
                name={focus.name}
                onClose={closeGraph}
                onOpenDocument={(docId) => {
                  void guardNavigate(() => navigate(`/doc/${docId}`));
                }}
              />
            ) : activeDocMeta && editorContent && editorContent.documentId === activeDocMeta.documentId ? (
              <div
                className={"mdocs-main-editor-stack" + (pcSplitActive ? " is-split" : "")}
                ref={mainSplitRef}
                style={
                  pcSplitActive
                    ? ({ ["--mdocs-split-ratio" as string]: String(splitRatio) } as CSSProperties)
                    : undefined
                }
              >
                <div
                  className={
                    "mdocs-editor-split-pane mdocs-editor-split-pane--primary" +
                    (focusedPane === "primary" ? " is-focused" : "")
                  }
                  style={pcSplitActive ? { flex: `${splitRatio} 1 0` } : undefined}
                >
                  <EditorPaneHost
                    meta={activeDocMeta}
                    editorContent={editorContent}
                    contentRevision={contentRevision}
                    visitorId={visitor?.visitorId}
                    domains={domains}
                    currentDomainId={currentDomainId}
                    onDomainChange={(domainId) => {
                      guardNavigate(() => {
                        localStorage.setItem("mdocs.currentDomainId", domainId);
                        setCurrentDomainId(domainId);
                        setActiveDocMeta(null);
                        setEditorContent(null);
                        clearEditorSplit();
                        setSelectedCreateParentPath("");
                        navigate("/");
                        void refreshTree(domainId);
                      });
                    }}
                    onDomainsChange={setDomains}
                    onContentChange={(c) => {
                      setEditorContent((prev) => (prev ? { ...prev, content: c } : prev));
                    }}
                    onDraftExistsChange={setEditorDraftExists}
                    hasLocalDraft={editorDraftExists}
                    onPublish={publishDocument}
                    syncBehind={syncBehind}
                    onSyncClick={() => void handleSyncClick()}
                    onConflictModalRequest={() => setConflictModalOpen(true)}
                    onMergeRequest={() => setMergeViewOpen(true)}
                    onDeleteDocument={(id, p) => requestDeleteDocument(id, p)}
                    onDeleteFolder={(id, p) => requestDeleteFolder(id, p)}
                    saveBeforeNavRef={saveBeforeNavRef}
                    exportMarkdownRef={exportMarkdownRef}
                    onShowToast={setMessage}
                    onShowError={setAlertMessage}
                    onVersionRestored={(doc) => void handleVersionRestored(doc)}
                    onToggleComments={() => setCommentPanelOpen(!commentPanelOpen)}
                    commentPanelOpen={commentPanelOpen && focusedPane === "primary"}
                    commentCount={commentCount}
                    onAiWrite={isNarrow ? undefined : () => void openAiWriteForCurrentDoc()}
                    readerChrome={isNarrow}
                    onOpenMobileNav={() => setMobileNavOpen(true)}
                    onFocusPane={() => {
                      setFocusedPane("primary");
                      if (activeDocMeta) setFocus({ kind: "document", documentId: activeDocMeta.documentId });
                    }}
                    recentTabsProps={buildRecentTabsProps("primary")}
                  />
                  {commentPanelOpen && focusedPane === "primary" ? (
                    <CommentsPanel
                      documentId={activeDocMeta.documentId}
                      visitorId={visitor?.visitorId}
                      visitorName={visitor?.visitorName}
                      documentOwnerId={activeDocMeta.ownerVisitorId}
                      onClose={() => setCommentPanelOpen(false)}
                    />
                  ) : null}
                </div>
                {pcSplitActive && secondaryMeta && secondaryContent ? (
                  <>
                    <div
                      className="mdocs-editor-split-handle"
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label={t("editorSplitResize")}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!mainSplitRef.current) return;
                        splitDragRef.current = { startY: e.clientY, startRatio: splitRatio };
                        let last = splitRatio;
                        const onMove = (ev: MouseEvent) => {
                          const drag = splitDragRef.current;
                          if (!drag || !mainSplitRef.current) return;
                          const h = mainSplitRef.current.getBoundingClientRect().height;
                          if (h <= 0) return;
                          const next = drag.startRatio + (ev.clientY - drag.startY) / h;
                          last = Math.min(0.75, Math.max(0.25, next));
                          setSplitRatio(last);
                        };
                        const onUp = () => {
                          splitDragRef.current = null;
                          window.removeEventListener("mousemove", onMove);
                          window.removeEventListener("mouseup", onUp);
                          saveEditorSplitRatio(last);
                        };
                        window.addEventListener("mousemove", onMove);
                        window.addEventListener("mouseup", onUp);
                      }}
                      onDoubleClick={() => {
                        setSplitRatio(0.5);
                        saveEditorSplitRatio(0.5);
                      }}
                    />
                    <div
                      className={
                        "mdocs-editor-split-pane mdocs-editor-split-pane--secondary" +
                        (focusedPane === "secondary" ? " is-focused" : "")
                      }
                      style={{ flex: `${1 - splitRatio} 1 0` }}
                    >
                      <EditorPaneHost
                        meta={secondaryMeta}
                        editorContent={secondaryContent}
                        contentRevision={secondaryRevision}
                        visitorId={visitor?.visitorId}
                        domains={domains}
                        currentDomainId={currentDomainId}
                        onDomainChange={(domainId) => {
                          guardNavigate(() => {
                            localStorage.setItem("mdocs.currentDomainId", domainId);
                            setCurrentDomainId(domainId);
                            setActiveDocMeta(null);
                            setEditorContent(null);
                            clearEditorSplit();
                            setSelectedCreateParentPath("");
                            navigate("/");
                            void refreshTree(domainId);
                          });
                        }}
                        onDomainsChange={setDomains}
                        onContentChange={(c) => {
                          setSecondaryContent((prev) => (prev ? { ...prev, content: c } : prev));
                        }}
                        onDraftExistsChange={setSecondaryDraftExists}
                        hasLocalDraft={secondaryDraftExists}
                        onPublish={publishDocument}
                        syncBehind={false}
                        onSyncClick={() => undefined}
                        onDeleteDocument={(id, p) => requestDeleteDocument(id, p)}
                        onDeleteFolder={(id, p) => requestDeleteFolder(id, p)}
                        onShowToast={setMessage}
                        onShowError={setAlertMessage}
                        onVersionRestored={(doc) => void handleVersionRestored(doc)}
                        onToggleComments={() => {
                          setFocusedPane("secondary");
                          setCommentPanelOpen(!commentPanelOpen);
                        }}
                        commentPanelOpen={commentPanelOpen && focusedPane === "secondary"}
                        commentCount={commentCount}
                        onAiWrite={
                          isNarrow
                            ? undefined
                            : () => {
                                setFocusedPane("secondary");
                                void openAiWriteForDocument({
                                  documentId: secondaryMeta.documentId,
                                  displayName: secondaryContent.displayName,
                                });
                              }
                        }
                        readerChrome={false}
                        onFocusPane={() => {
                          setFocusedPane("secondary");
                          setFocus({ kind: "document", documentId: secondaryMeta.documentId });
                        }}
                        recentTabsProps={buildRecentTabsProps("secondary")}
                        splitChrome={
                          <button
                            type="button"
                            className="mdocs-editor-split-close-line mdocs-tooltip"
                            aria-label={t("editorSplitClose")}
                            data-tooltip={t("editorSplitClose")}
                            onClick={() => {
                              setRecentTabsByPane(clearSecondaryRecentDocTabs());
                              closeSecondaryPane();
                            }}
                          />
                        }
                      />
                      {commentPanelOpen && focusedPane === "secondary" ? (
                        <CommentsPanel
                          documentId={secondaryMeta.documentId}
                          visitorId={visitor?.visitorId}
                          visitorName={visitor?.visitorName}
                          documentOwnerId={secondaryMeta.ownerVisitorId}
                          onClose={() => setCommentPanelOpen(false)}
                        />
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="mdocs-welcome">
                {isNarrow ? (
                  <button
                    type="button"
                    className="mdocs-reader-float-pill"
                    onClick={() => setMobileNavOpen(true)}
                    aria-label={t("expandSidebar")}
                  >
                    <PanelLeftOpen size={18} strokeWidth={1.75} />
                    <span>{t("brand")}</span>
                  </button>
                ) : null}
                <div className="mdocs-welcome-icon">
                  <Code2 size={64} strokeWidth={1} opacity={0.15} />
                </div>
                <h1>{t("brand")}</h1>
                <p className="mdocs-welcome-lead">{t("createDocToStart")}</p>
                <div className="mdocs-welcome-actions">
                  <button type="button" className="primary" onClick={() => openNewDocumentModal()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <File size={16} strokeWidth={1.5} />
                    {t("startWriting")}
                  </button>
                  {!isDemoMode() && !isNarrow ? (
                    <button type="button" className="secondary" onClick={() => openAiWriteBlank()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <img src={deepseekLogoUrl} alt="" width={16} height={16} style={{ display: "block" }} />
                      AI 帮写
                    </button>
                  ) : null}
                </div>
                <div className="mdocs-welcome-domain">
                  <label className="muted mdocs-welcome-domain-label">
                    {t("domainLabel")}
                  </label>
                  <DomainSelect
                    domains={domains.length ? domains : [{ domainId: "default", domainName: t("defaultDomain"), permission: "", creatorVisitorId: "", docCount: 0 }]}
                    value={currentDomainId}
                    onChange={(domainId) => {
                      guardNavigate(() => {
                        localStorage.setItem("mdocs.currentDomainId", domainId);
                        setCurrentDomainId(domainId);
                        setActiveDocMeta(null);
                        setEditorContent(null);
                        setSelectedCreateParentPath("");
                        navigate("/");
                        void refreshTree(domainId);
                      });
                    }}
                    onDomainsChange={setDomains}
                    ariaLabel={t("domainLabel")}
                    localizeName={(name: string) => localizeDomainName(name, lang, t)}
                  />
                </div>
              </div>
            )}

            {/* 发布冲突提示条 */}
            <ConflictModal
              open={conflictModalOpen}
              onClose={() => setConflictModalOpen(false)}
              onResolve={() => {
                setConflictModalOpen(false);
                setMergeViewOpen(true);
              }}
              onForceOverwrite={
                visitor && activeDocMeta && visitor.visitorId === activeDocMeta.ownerVisitorId
                  ? () => void handleForceOverwrite()
                  : undefined
              }
              forceBusy={forceOverwriteBusy}
            />
            {mergeViewOpen && activeDocMeta && mergeConflict && (
              <Suspense fallback={<div className="merge-view-loading">{t("mergeLoadingRemote")}</div>}>
                <MergeView
                  documentId={activeDocMeta.documentId}
                  displayName={activeDocMeta.displayName}
                  conflict={mergeConflict}
                  fileType={activeDocMeta.fileType}
                  onClose={() => setMergeViewOpen(false)}
                  onSuccess={handleMergeSuccess}
                  onError={(msg) => setAlertMessage(msg)}
                  updateDocument={updateDocumentWithPublishMessage}
                  requestMergePublishMessage={requestMergePublishMessage}
                  onForceOverwrite={
                    visitor && activeDocMeta && visitor.visitorId === activeDocMeta.ownerVisitorId
                      ? () => void handleForceOverwrite()
                      : undefined
                  }
                  forceBusy={forceOverwriteBusy}
                />
              </Suspense>
            )}

            {publishMsgPrompt ? (
              <PublishMessageDialog
                open
                mode={publishMsgPrompt.mode ?? "publish"}
                documentId={publishMsgPrompt.documentId}
                content={publishMsgPrompt.content}
                contentFormat={publishMsgPrompt.contentFormat}
                mergeSuggest={publishMsgPrompt.mergeSuggest}
                onCancel={() => {
                  const resolve = publishMsgPrompt.resolve;
                  setPublishMsgPrompt(null);
                  resolve(null);
                }}
                onConfirm={(msg) => {
                  const resolve = publishMsgPrompt.resolve;
                  setPublishMsgPrompt(null);
                  resolve(msg);
                }}
              />
            ) : null}

            {/* 全局 Toast 消息 */}
            {message && (
              <div className="mdocs-toast" role="status">
                {message}
              </div>
            )}

          </main>

          {/* 贴左助手时：右侧挤占式目录（可收起；仅新建文章/目录，无搜索/图谱） */}
          {agentDockLayout ? (
            <aside
              className={
                "mdocs-tree-rail" + (agentTreeRailOpen ? " is-open" : " is-closed")
              }
              aria-label="文档目录"
              aria-hidden={!agentTreeRailOpen}
            >
              <div className="mdocs-tree-rail-header">
                {renderSidebarCreateActions({ showExtras: false })}
                <button
                  type="button"
                  className="mdocs-tree-rail-hide"
                  title="隐藏目录"
                  aria-label="隐藏目录"
                  tabIndex={agentTreeRailOpen ? 0 : -1}
                  onClick={() => setAgentTreeRailOpenPersist(false)}
                >
                  <PanelRightClose size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
              <div className="mdocs-tree-rail-body">{renderSidebarDocumentTree()}</div>
              <button
                type="button"
                className="mdocs-tree-rail-peek"
                title="显示目录"
                aria-label="显示目录"
                tabIndex={agentTreeRailOpen ? -1 : 0}
                onClick={() => setAgentTreeRailOpenPersist(true)}
              >
                目录
              </button>
            </aside>
          ) : null}

          {/* ========== 右键菜单浮层 ========== */}
          {menu && (
            <TreeContextMenu
              x={menu.x}
              y={menu.y}
              node={menu.node}
              parentPath={menu.parentPath}
              onClose={() => setMenu(null)}
              onCreateChild={(parent, fileType) => openNewDocumentModal(parent, fileType)}
              onCreateFolder={(parent) => openNewFolderModal(parent)}
              onDeleteDocument={(doc) => requestDeleteDocument(doc.documentId, doc.path)}
              onDeleteFolder={(folder) => requestDeleteFolder(folder.documentId, folder.folderDisplayName || folder.name)}
              onOpenBelow={
                isNarrow
                  ? undefined
                  : (docId) => {
                      void openDocumentBelow(docId);
                    }
              }
            />
          )}

        </div>
      )}
      </div>

      {/* 弹层放在 shell 外：窄屏侧栏用 transform 滑动，fixed 若留在里面会相对整条轨道定位 */}
      {alertMessage && (
        <MessageDialog
          title={t("error")}
          message={alertMessage}
          onClose={() => setAlertMessage(null)}
        />
      )}

      {showLogoutConfirm && (
        <div
          className="mdocs-dialog-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLogoutConfirm(false); }}
        >
          <div className="mdocs-dialog card" style={{ maxWidth: 440 }}>
            <h1 style={{ fontSize: "1.125rem", marginBottom: 8 }}>退出当前登录身份？</h1>
            <p style={{ lineHeight: 1.6, color: "var(--mdocs-text-secondary, #666)", marginBottom: 20 }}>
              这将会导致您无法修改以前的文章。如果想找回账号，需要恢复码或联系管理员执行合并用户脚本。
            </p>
            <div className="mdocs-dialog-actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowLogoutConfirm(false)}>
                取消
              </button>
              <button
                type="button"
                className="primary"
                style={{ background: "#d32f2f" }}
                onClick={() => {
                  clearVisitorId();
                  setActiveDocMeta(null);
                  setEditorContent(null);
                  setVisitor(null);
                  setTree([]);
                  setShowLogoutConfirm(false);
                  setPhase("needsRegister");
                }}
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}

      {showBookmarksDialog && (
        <div
          className="mdocs-dialog-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setShowBookmarksDialog(false); }}
        >
          <div className="mdocs-dialog card" style={{ maxWidth: 640, width: "min(640px, 100%)", maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
            <h1 style={{ fontSize: "1.125rem", marginBottom: 16 }}>
              {t("bookmarkTitle")}（{bookmarks.length}）
            </h1>

            {bookmarks.length > 0 && (
              <div className="mdocs-bookmark-filterbar">
                <input
                  type="text"
                  placeholder={t("bookmarkSearch")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  value={selectedDomainId}
                  onChange={(e) => setSelectedDomainId(e.target.value)}
                >
                  <option value="">{t("bookmarkFilterAll")}</option>
                  {uniqueDomains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {bookmarks.length === 0 ? (
              <p style={{ color: "var(--mdocs-text-muted, #999)", textAlign: "center", padding: "2rem 0" }}>
                {t("bookmarkEmpty")}
              </p>
            ) : filteredBookmarks.length === 0 ? (
              <p style={{ color: "var(--mdocs-text-muted, #999)", textAlign: "center", padding: "2rem 0" }}>
                {t("bookmarkNoMatch")}
              </p>
            ) : (
              <div style={{ overflowY: "auto", flex: 1, margin: "0 -1rem", padding: "0 1rem" }}>
                <table className="mdocs-bookmark-table">
                  <thead>
                    <tr>
                      <th>{t("bookmarkColTitle")}</th>
                      <th>{t("bookmarkColDomain")}</th>
                      <th>{t("bookmarkColAuthor")}</th>
                      <th>{t("bookmarkColTime")}</th>
                      <th className="mdocs-bookmark-col-action" />
                    </tr>
                  </thead>
                  <tbody>
                {filteredBookmarks.map((bm) => {
                  const isRemoving = removingIds.has(bm.documentId);
                  return (
                  <tr
                    key={bm.documentId}
                    className={`${isRemoving ? "mdocs-bookmark-removing" : ""}`}
                    style={{ opacity: bm.isDeleted ? 0.6 : 1 }}
                  >
                    <td className="mdocs-bookmark-col-title">
                      <div
                        style={{ cursor: bm.isDeleted ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}
                        onClick={() => {
                          if (bm.isDeleted) return;
                          guardNavigate(() => {
                            setShowBookmarksDialog(false);
                            navigate(`/doc/${bm.documentId}`);
                          });
                        }}
                      >
                        <span
                          ref={(el) => {
                            if (el) {
                              const overflow = el.scrollWidth > el.clientWidth;
                              el.title = overflow ? (bm.displayName ?? "") : "";
                            }
                          }}
                          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
                        >{bm.displayName ?? "(无标题)"}</span>
                        {bm.isDeleted && <span style={{ fontSize: "0.7rem", color: "#d32f2f", background: "#ffebee", padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>已删除</span>}
                      </div>
                    </td>
                    <td>{bm.isDeleted ? "" : (domainNameLookup[bm.domainId ?? ""] ?? bm.domainId ?? "")}</td>
                    <td>{bm.isDeleted ? "" : (bm.ownerVisitorName ?? "-")}</td>
                    <td>{bm.isDeleted ? "" : formatRelativeTime(bm.bookmarkedAt, lang)}</td>
                    <td className="mdocs-bookmark-col-action">
                      <div style={{ display: "flex", gap: 2, alignItems: "center", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="mdocs-tooltip"
                          data-tooltip={t("bookmarkOpen")}
                          onClick={() => {
                            if (bm.isDeleted) return;
                            guardNavigate(() => {
                              setShowBookmarksDialog(false);
                              navigate(`/doc/${bm.documentId}`);
                            });
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: bm.isDeleted ? "default" : "pointer",
                            padding: "4px",
                            color: "var(--mdocs-text-muted, #999)",
                            lineHeight: 1,
                            borderRadius: 4,
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <BookOpen size={14} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          className="mdocs-tooltip"
                          data-tooltip={t("bookmarkRemove")}
                          onClick={async () => {
                            try {
                              await removeBookmarkApi(bm.documentId);
                              setRemovingIds((prev) => new Set(prev).add(bm.documentId));
                              setTimeout(() => {
                                setBookmarks((prev) => prev.filter((x) => x.documentId !== bm.documentId));
                                setRemovingIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(bm.documentId);
                                  return next;
                                });
                              }, 300);
                            } catch (err) {
                              setAlertMessage(translateError(t, err));
                            }
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                            color: "var(--mdocs-text-muted, #999)",
                            fontSize: "1rem",
                            lineHeight: 1,
                            borderRadius: 4,
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#d32f2f"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--mdocs-text-muted, #999)"; }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mdocs-dialog-actions" style={{ justifyContent: "flex-end", marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--mdocs-border, #eee)" }}>
              <button type="button" onClick={() => setShowBookmarksDialog(false)}>
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title={deleteConfirm.type === "folder" ? "删除文件夹" : "删除文档"}
          message={
            deleteConfirm.type === "folder"
              ? `确定要删除「${deleteConfirm.name}」及其下的所有文档和子文件夹吗？此操作不可撤销。`
              : `确定要删除「${deleteConfirm.name}」吗？`
          }
          confirmLabel="删除"
          cancelLabel="取消"
          onConfirm={executeDelete}
          onCancel={() => setDeleteConfirm(null)}
          danger
        />
      )}

      {createModal && (
        <div
          className="mdocs-dialog-backdrop"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget && !createModalBusy) setCreateModal(null);
          }}
        >
          <div className="mdocs-dialog card" role="dialog" aria-modal="true">
            <h1>{createModal.kind === "document" ? t("newDocumentTitle") : t("newFolderTitle")}</h1>
            <p className="muted mdocs-dialog-hint">
              {createModal.kind === "document"
                ? t("fileNameHint")
                : t("folderNameHint")}
            </p>
            <form onSubmit={submitCreateModal} className="mdocs-dialog-form">
              <label className="mdocs-dialog-label">
                {createModal.kind === "document" ? t("fileNameLabel") : t("folderNameLabel")}
                <input
                  ref={createModalInputRef}
                  value={createModal.draft}
                  onChange={(ev) =>
                    setCreateModal((prev) =>
                      prev ? { ...prev, draft: ev.target.value } : prev,
                    )
                  }
                  placeholder={createModal.kind === "document" ? t("untitledPlaceholder") : t("folderExamplePlaceholder")}
                  maxLength={200}
                  disabled={createModalBusy}
                />
              </label>
              {createModalError && <div className="mdocs-dialog-error">{createModalError}</div>}
              <div className="mdocs-dialog-actions">
                <button
                  type="button"
                  onClick={() => !createModalBusy && setCreateModal(null)}
                  disabled={createModalBusy}
                >
                  {t("cancel")}
                </button>
                <button type="submit" className="primary" disabled={createModalBusy}>
                  {createModalBusy ? t("creating") : t("create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 悬浮层放在 shell 外，避免参与主布局高度计算 */}
      {pendingVisitorId && visitor && (
        <VisitorIdNotice
          visitorId={pendingVisitorId}
          onDismiss={() => setPendingVisitorId(null)}
        />
      )}

      {recoveryCode && (
        <div
          className="mdocs-dialog-backdrop"
          style={{ position: "fixed", zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setRecoveryCode(null); }}
        >
          <div className="mdocs-dialog card" style={{ maxWidth: 480, textAlign: "center" }}>
            <h1 style={{ fontSize: "1.25rem", marginBottom: 8 }}>🔑 保存你的恢复码</h1>
            <p className="muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
              恢复码是你的唯一凭证，当 Token 丢失时可用它找回身份。
              <br />
              <strong>请立即复制保存，此弹窗关闭后不可再查看。</strong>
            </p>
            <div
              style={{
                background: "#f5f5f5",
                borderRadius: 8,
                padding: "12px 16px",
                fontFamily: "monospace",
                fontSize: "1.25rem",
                letterSpacing: "0.1em",
                marginBottom: 20,
                userSelect: "all",
              }}
            >
              {recoveryCode}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  void copyTextToClipboard(recoveryCode);
                }}
              >
                复制恢复码
              </button>
              <button
                type="button"
                onClick={() => setRecoveryCode(null)}
              >
                已保存，关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {!isDemoMode() && (
        <>
          {/* 贴左时左侧已是助手面板，不再叠浮动球 */}
          {!agentDockLayout ? (
            <AgentFab
              open={agentPanelOpen}
              onToggle={() => {
                if (agentPanelOpen) {
                  agentPanelRef.current?.requestClose();
                } else {
                  setAgentPanelOpen(true);
                }
              }}
              position={agentFabPos}
              onPositionChange={setAgentFabPos}
            />
          ) : null}
          {agentPanelOpen && !agentDockLayout ? (
            <Suspense fallback={null}>
              <AgentChatPanel
                ref={agentPanelRef}
                open={agentPanelOpen}
                onClose={() => {
                  setAgentPanelOpen(false);
                  setAgentPanelFullscreen(false);
                }}
                visitorName={visitor?.visitorName}
                fullscreen={isNarrow || agentPanelFullscreen}
                onToggleFullscreen={
                  isNarrow ? undefined : () => setAgentPanelFullscreen((v) => !v)
                }
                onToggleDock={
                  isNarrow
                    ? undefined
                    : () => {
                        setAgentDockedPersist(true);
                        setAgentPanelFullscreen(false);
                      }
                }
                domainId={currentDomainId || null}
                domains={domains}
                localizeDomainName={(name) => localizeDomainName(name, lang, t)}
                documentId={focusedDocMeta?.documentId ?? null}
                documentTitle={focusedDocMeta?.displayName ?? null}
                documentPath={focusedDocMeta?.relativePath ?? null}
                graphFileId={focus?.kind === "graph" ? `${focus.resourceId}.graph-file` : null}
                graphLabel={focus?.kind === "graph" ? focus.name : null}
                anchorStyle={
                  isNarrow || agentPanelFullscreen
                    ? undefined
                    : agentPanelAnchorStyle(agentFabPos)
                }
                onOpenDocument={(docId) => {
                  setView("docs");
                  void guardNavigate(() => navigate(`/doc/${docId}`));
                  setAgentPanelOpen(false);
                  setAgentPanelFullscreen(false);
                }}
                onTreeChanged={() => void refreshTree()}
                onDocumentOverwritten={(payload) => void handleDocumentOverwritten(payload)}
                onOpenCoding={
                  isNarrow ? undefined : (payload) => void openAiWriteForDocument(payload)
                }
                onProvideEditorDraft={provideEditorDraft}
              />
            </Suspense>
          ) : null}
        </>
      )}

      {!isDemoMode() && aiWriteBoot ? (
        <Suspense fallback={null}>
          <AiWriteWorkbench
            open={aiWriteOpen}
            initialMarkdown={aiWriteBoot.markdown}
            documentId={aiWriteBoot.documentId}
            displayName={aiWriteBoot.displayName}
            onClose={() => {
              setAiWriteOpen(false);
              setAiWriteBoot(null);
            }}
            onComplete={completeAiWrite}
          />
        </Suspense>
      ) : null}

      <DocSearchOverlay
        open={docSearchOpen}
        domains={domains}
        onDomainsChange={setDomains}
        onClose={() => setDocSearchOpen(false)}
        onOpenDocument={(docId) => {
          if (isNarrow) setMobileNavOpen(false);
          setView("docs");
          void guardNavigate(() => navigate(`/doc/${docId}`));
        }}
      />
    </div>
  );
}
