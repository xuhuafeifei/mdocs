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
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, File, Folder, LogOut, MessageSquare, PanelLeftClose, PanelLeftOpen, Star } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import type { VisitorPublic } from "../../shared/types/visitor";
import type { DocumentDetail, VersionConflictDetails } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import type { TreeNode } from "../../shared/types/tree";
import { isPublicWritePermission } from "../../shared/permissions.js";
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
  registerVisitorApi,
  updateDocumentApi,
  fetchBookmarksApi,
  removeBookmarkApi,
  type Bookmark,
} from "../services/endpoints";
import { VisitorRegisterDialog } from "./VisitorRegisterDialog";
import { VisitorIdNotice } from "./VisitorIdNotice";
import { DocumentTree, type TreeContextMenu as TreeContextMenuPayload } from "./DocumentTree";
import { TreeContextMenu } from "./TreeContextMenu";
import { DocumentEditor } from "./DocumentEditor";
import { DomainSelect } from "./DomainSelect";
import { SettingsPage } from "./SettingsPage";
import { MessageDialog } from "./MessageDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { useCreateModal } from "./hooks/useCreateModal";
import { ConflictModal } from "./ConflictModal";
import { MergeView } from "./MergeView";
import { CommentsPanel } from "./CommentsPanel";
import {
  getDraft,
  saveDraft as saveDraftRecord,
  deleteDraft,
  deleteDraftIfUnchanged,
  markDraftPublishError,
  saveDraftConflict,
  clearDraftConflict,
  rebuildDraftAfterMerge,
  type DraftConflictRecord,
} from "../storage/drafts";
import { translateError, localizeDomainName, parentDirForCreates } from "./utils";
import { useAutoPublish } from "./hooks/useAutoPublish";
import { useDocumentVersion } from "./hooks/useDocumentVersion";
import mdocsLogo from "../assets/mdocs-logo.svg";
import "./App.css";
import "./merge.css";
import "./domain.css";
import "./comments.css";

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
  refreshTree: (domainId?: string) => Promise<void>,
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

  const toggleSidebar = () => {
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    localStorage.setItem("mdocs.sidebarCollapsed", String(newValue));
  };

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

  // ---- 路由参数：URL 中的文档 ID ----
  const { documentId } = useParams();

  // ---- 路由导航函数 ----
  const navigate = useNavigate();

  // ---- 当前打开的文档详情 ----
  const [activeDoc, setActiveDoc] = useState<DocumentDetail | null>(null);

  /** 客户端认定的服务端 head（开编 / 拉取 / 发布成功后更新） */
  const [syncedHeadCommitId, setSyncedHeadCommitId] = useState<string | null>(null);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [mergeViewOpen, setMergeViewOpen] = useState(false);
  const [editorDraftExists, setEditorDraftExists] = useState(false);

  // 有未发布草稿时先不做后台 sync 轮询，避免副本分支与远端 head 混用带来的状态噪声
  const syncTargetDocumentId = activeDoc?.documentId && !editorDraftExists
    ? activeDoc.documentId
    : null;
  const { syncBehind, remoteHeadCommitId } = useDocumentVersion(
    syncTargetDocumentId,
    syncedHeadCommitId,
  );

  const [mergeConflict, setMergeConflict] = useState<DraftConflictRecord | null>(null);

  useEffect(() => {
    if (!mergeViewOpen || !activeDoc) {
      setMergeConflict(null);
      return;
    }
    void (async () => {
      const draft = await getDraft(activeDoc.documentId);
      if (draft?.conflict) {
        setMergeConflict(draft.conflict);
        return;
      }
      if (draft && syncedHeadCommitId && remoteHeadCommitId) {
        const editBase = draft.baseCommitId ?? syncedHeadCommitId;
        if (!editBase) return;
        const built: DraftConflictRecord = {
          baseCommitId: editBase,
          expectedHeadCommitId: remoteHeadCommitId,
          localSnapshotContent: draft.content,
        };
        await saveDraftConflict(activeDoc.documentId, {
          baseCommitId: built.baseCommitId,
          conflictStatus: "diverged",
          conflict: built,
        });
        setMergeConflict(built);
      }
    })();
  }, [mergeViewOpen, activeDoc, syncedHeadCommitId, remoteHeadCommitId]);

  useEffect(() => {
    if (!activeDoc || !syncBehind || !editorDraftExists) return;
    void getDraft(activeDoc.documentId).then(async (draft) => {
      if (!draft || draft.conflict || draft.conflictStatus === "publish_conflict") return;
      if (draft.conflictStatus === "diverged") return;
      await saveDraftRecord({ ...draft, conflictStatus: "diverged" });
    });
  }, [activeDoc?.documentId, syncBehind, editorDraftExists]);

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

  // ---- 当前视图：docs（文档）或 settings（设置） ----
  const [view, setView] = useState<"docs" | "settings">("docs");

  // ---- 导航前保存草稿的引用 ----
  // DocumentEditor 会通过这个 ref 暴露 saveDraft 方法
  const saveBeforeNavRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // ---- 自动发布：每 10 秒扫描一次本地草稿，闲置超过 30 秒的自动推送到服务器 ----
  // 仅在用户开启「自动同步至云端」时启用
  useAutoPublish(localStorage.getItem("mdocs.autoPublish") === "true", publishDraftFromList);

  /**
   * 导航守卫：在切换路由前先触发保存草稿，确保内容不丢失。
   */
  async function guardNavigate(onProceed: () => void): Promise<void> {
    // 先调用 DocumentEditor 暴露的 saveDraft，等待保存完成
    await saveBeforeNavRef.current?.();
    // 保存完成后再执行真正的导航操作
    onProceed();
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
  async function refreshTree(domainId?: string): Promise<void> {
    // 如果没有传入 domainId，则使用当前激活的域
    const did = domainId ?? currentDomainId;
    // 向后端请求该域的文档树结构
    const nodes = await fetchTreeApi(did);
    // 更新侧边栏树数据
    setTree(nodes);
  }

  /**
   * 打开文档：先拉服务端最新文档，再按本地草稿副本覆盖编辑视图。
   * 若存在未发布草稿，正文与展示信息以草稿副本为准（服务端仍负责写操作裁决）。
   */
  async function openDocument(docId: string): Promise<void> {
    expectedDocIdRef.current = docId;
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

      const head = doc.headCommitId ?? null;
      setSyncedHeadCommitId(head);

      if (expectedDocIdRef.current !== docId) return;
      setActiveDoc(
        draft && !draft.published
          ? {
            ...doc,
            content: draft.content,
            displayName: draft.displayName,
          }
          : doc,
      );
    } catch (err) {
      if (expectedDocIdRef.current !== docId) return;
      setAlertMessage(translateError(t, err));
    }
  }

  /**
   * URL 中的 documentId 变化或应用就绪后，自动打开对应文档。
   * 无 documentId 时清空编辑器展示欢迎页。
   */
  useEffect(() => {
    // 只有在应用完全初始化后才处理文档打开
    if (phase !== "ready") return;
    if (documentId) {
      // URL 中有文档 ID，尝试打开该文档
      void openDocument(documentId);
    } else {
      setActiveDoc(null);
      setSyncedHeadCommitId(null);
    }
    // 注意：openDocument 在 effect 内部定义，eslint 会提示缺少依赖
    // 但将 openDocument 加入依赖会导致无限循环，因此忽略该规则
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, documentId]);

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
      setActiveDoc(doc);
      setSelectedCreateParentPath(parentDirForCreates(doc.relativePath));
      navigate(`/doc/${doc.documentId}`);
    },
    refreshTree,
  });

  // ---- 退出确认弹窗 ----
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
    baseCommitId: string,
    details: VersionConflictDetails,
  ): Promise<void> {
    let draft = await getDraft(documentId);
    if (!draft && activeDoc?.documentId === documentId) {
      draft = {
        documentId,
        content: localContent,
        displayName,
        updatedAt: Date.now(),
        published: false,
        baseCommitId,
        relativePath: activeDoc.relativePath,
        permission: activeDoc.permission,
        ownerVisitorId: activeDoc.ownerVisitorId,
        domainId: activeDoc.domainId,
      };
      await saveDraftRecord(draft);
    }
    if (draft) {
      await saveDraftConflict(documentId, {
        baseCommitId,
        conflictStatus: "publish_conflict",
        conflict: {
          baseCommitId,
          expectedHeadCommitId: details.headCommitId,
          localSnapshotContent: localContent,
        },
      });
    }
    setConflictModalOpen(true);
  }

  /**
   * 发布文档：带 version.baseCommitId 乐观锁。
   */
  async function publishDocument(content: string, displayName: string, documentId: string, permission?: number): Promise<void> {
    const draftForPublish = await getDraft(documentId);
    const baseCommitId =
      draftForPublish?.baseCommitId ?? syncedHeadCommitId ?? activeDoc?.headCommitId;
    if (!baseCommitId) {
      setAlertMessage(t("syncHeadMissing"));
      throw new Error("missing baseCommitId");
    }
    try {
      const updated = await updateDocumentApi(documentId, {
        content,
        displayName,
        permission,
        version: { baseCommitId },
      });
      setActiveDoc((prev) => (prev && prev.documentId === documentId ? updated : prev));
      setSyncedHeadCommitId(updated.headCommitId ?? null);
      await clearDraftConflict(documentId);
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
          baseCommitId,
          err.details as VersionConflictDetails,
        );
      }
      throw err;
    }
  }

  /** 无本地未发布草稿时：只读拉远端正文与 meta，不写服务端、不删草稿。 */
  async function executePullRemote(): Promise<void> {
    if (!activeDoc) return;
    const doc = await getDocumentApi(activeDoc.documentId);
    if (doc.domainId !== currentDomainId) {
      localStorage.setItem("mdocs.currentDomainId", doc.domainId);
      setCurrentDomainId(doc.domainId);
      void refreshTree(doc.domainId);
    }
    setSelectedCreateParentPath(parentDirForCreates(doc.relativePath));
    setActiveDoc(doc);
    setSyncedHeadCommitId(doc.headCommitId ?? null);
    setMessage(t("syncPullDone"));
    window.setTimeout(() => setMessage(null), 1200);
  }

  async function handleSyncClick(): Promise<void> {
    if (!activeDoc) return;
    const draft = await getDraft(activeDoc.documentId);
    // 有未发布草稿时，当前版本不做覆盖式 sync / pull（本地副本优先）
    if (draft && !draft.published) return;
    const conflictPending =
      draft?.conflictStatus === "publish_conflict" ||
      draft?.conflictStatus === "diverged" ||
      Boolean(draft?.conflict);
    if (conflictPending) {
      setMergeViewOpen(true);
      return;
    }
    await executePullRemote();
  }

  async function handleMergeSuccess(updated: DocumentDetail): Promise<void> {
    setActiveDoc(updated);
    const head = updated.headCommitId ?? null;
    setSyncedHeadCommitId(head);
    setMergeViewOpen(false);
    setConflictModalOpen(false);
    if (head) {
      await rebuildDraftAfterMerge({
        documentId: updated.documentId,
        content: updated.content,
        displayName: updated.displayName,
        headCommitId: head,
        relativePath: updated.relativePath,
        permission: updated.permission,
        ownerVisitorId: updated.ownerVisitorId,
        domainId: updated.domainId,
      });
      setEditorDraftExists(true);
    } else {
      await clearDraftConflict(updated.documentId);
      await deleteDraft(updated.documentId);
    }
    if (updated.domainId !== currentDomainId) {
      localStorage.setItem("mdocs.currentDomainId", updated.domainId);
      setCurrentDomainId(updated.domainId);
    }
    void refreshTree(updated.domainId);
    setMessage(t("published"));
    window.setTimeout(() => setMessage(null), 1200);
  }

  /**
   * 从草稿列表发布单篇草稿（供自动发布或批量发布调用）。
   * 使用乐观锁：仅当草稿在 API 调用期间未被修改时才删除本地草稿。
   */
  async function publishDraftFromList(docId: string): Promise<void> {
    try {
      // 从 IndexedDB 读取该文档的本地草稿
      const draft = await getDraft(docId);
      // 如果草稿不存在，直接返回（可能已被其他逻辑删除）
      if (!draft) return;
      const baseCommitId = draft.baseCommitId;
      if (!baseCommitId) {
        const doc = await getDocumentApi(docId);
        if (doc.headCommitId) {
          await saveDraftRecord({ ...draft, baseCommitId: doc.headCommitId });
        }
      }
      const base = (await getDraft(docId))?.baseCommitId;
      if (!base) {
        setAlertMessage(t("syncHeadMissing"));
        return;
      }
      await updateDocumentApi(docId, {
        content: draft.content,
        displayName: draft.displayName,
        version: { baseCommitId: base },
      });
      // 乐观锁：只有草稿在 API 调用期间没被修改过，才删除本地草稿
      const deleted = await deleteDraftIfUnchanged(docId, draft.updatedAt);
      if (!deleted) {
        console.log("[publishDraftFromList] draft modified during publish, keeping:", docId);
        // 草稿在发布过程中被用户继续编辑了，保留草稿供下次扫描/发布
      }
      // 刷新文档树，更新文档状态
      await refreshTree();
      // 显示发布成功提示
      setMessage(t("published"));
      window.setTimeout(() => setMessage(null), 1200);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        // 服务端文档已不存在，标记草稿为发布失败（不再重复扫描）
        // 显示草稿名称，方便用户定位
        const draft = await getDraft(docId);
        const draftName = draft?.displayName || t("unknownTitle");
        setMessage(t("draftPublishFailedNotice", { name: draftName }));
        await markDraftPublishError(docId, "DOC_NOT_FOUND");
        return;
      }
      // 其他错误显示错误弹窗
      setAlertMessage(translateError(t, err));
    }
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
   * 执行删除（用户在确认弹窗中点击「确定」时调用）。
   */
  async function executeDelete(): Promise<void> {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "document") {
        await deleteDocumentApi(deleteConfirm.id);
        // 如果当前正在编辑的就是这篇文档，需要清理编辑器状态
        if (activeDoc?.documentId === deleteConfirm.id) {
          setActiveDoc(null);
          setSelectedCreateParentPath("");
          navigate("/");
        }
      } else if (deleteConfirm.type === "folder") {
        await deleteFolderApi(deleteConfirm.id);
        // 如果删除的文件夹包含当前文档，需要清空编辑器
        // 这里简单处理：先全部刷新，之后让树重新加载
        if (activeDoc) {
          setActiveDoc(null);
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

      <div className="mdocs-shell">
      {/* 注册成功后的访客 ID 提示条 */}
      {pendingVisitorId && visitor && (
        <VisitorIdNotice
          visitorId={pendingVisitorId}
          onDismiss={() => setPendingVisitorId(null)}
        />
      )}

      {/* 恢复码展示弹窗（注册后仅展示一次） */}
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
                  navigator.clipboard.writeText(recoveryCode);
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

      {/* 根据当前视图渲染设置页或文档页 */}
      {view === "settings" ? (
        <SettingsPage
          onBack={() => setView("docs")}
          onPublishDraft={publishDraftFromList}
          onOpenDocument={openDocument}
          onRecoverDraft={() => void refreshTree()}
        />
      ) : (
        <div className="mdocs-layout">
          {/* ========== 左侧边栏 ========== */}
          <aside className={`mdocs-sidebar ${sidebarCollapsed ? "mdocs-sidebar-collapsed" : ""}`}>
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
                aria-label={sidebarCollapsed ? t("expandSidebar") : t("collapseSidebar")}
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
                {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
            </header>

            {/* 新建文档/文件夹图标 */}
            <div className="mdocs-sidebar-actions">
              <span className="mdocs-sidebar-icon mdocs-tooltip" data-tooltip={t("newDocument")} onClick={() => openNewDocumentModal()} style={{ color: "var(--mdocs-accent)" }}>
                <File size={20} />
              </span>
              <span className="mdocs-sidebar-icon mdocs-tooltip" data-tooltip={t("newFolder")} onClick={() => openNewFolderModal()}>
                <Folder size={20} />
              </span>
            </div>

            {/* 文档树：递归渲染文件夹和文档 */}
            <DocumentTree
              nodes={tree}
              activeDocumentId={documentId ?? null}
              selectedParentPath={selectedCreateParentPath}
              // 点击文档节点：先保存草稿再导航到文档
              onOpen={(node) => {
                guardNavigate(() => navigate(`/doc/${node.documentId}`));
              }}
              // 点击文件夹：更新父路径，如果有描述文档则打开
              onOpenFolder={(folderPath, descDocumentId) => {
                guardNavigate(() => {
                  setSelectedCreateParentPath(folderPath);
                  if (descDocumentId) {
                    navigate(`/doc/${descDocumentId}`);
                  }
                });
              }}
              // 右键菜单回调
              onContextMenu={setMenu}
              // 点击空白处取消选中，返回首页
              onDeselect={() => {
                guardNavigate(() => {
                  setSelectedCreateParentPath("");
                  navigate("/");
                });
              }}
            />

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
          </aside>

          {/* ========== 主内容区 ========== */}
          <main className="mdocs-main">
            {activeDoc ? (
              <div className="mdocs-editor-with-comments">
                {/* 编辑器区域 */}
                <div className="mdocs-editor-container">
                  <DocumentEditor
                    // key 使用 documentId，切换文档时强制重新挂载编辑器，避免状态混淆
                    key={activeDoc.documentId}
                    document={activeDoc}
                    // 判断当前访客是否有编辑权限：
                    // - 文档所有者可编辑
                    // - permission === 4（public_write，公开可编辑）时所有人可编辑
                    // - 通过邀请获得编辑权限
                    canEdit={Boolean(visitor && (activeDoc.ownerVisitorId === visitor.visitorId || isPublicWritePermission(activeDoc.permission) || activeDoc.invitedEdit === true))}
                    domains={domains}
                    currentDomainId={currentDomainId}
                    // 切换域：清空当前文档，加载新域的树
                    onDomainChange={(domainId) => {
                      guardNavigate(() => {
                        localStorage.setItem("mdocs.currentDomainId", domainId);
                        setCurrentDomainId(domainId);
                        setActiveDoc(null);
                        setSelectedCreateParentPath("");
                        navigate("/");
                        void refreshTree(domainId);
                      });
                    }}
                    onPublish={publishDocument}
                    syncBehind={syncBehind}
                    onSyncClick={() => void handleSyncClick()}
                    onDraftExistsChange={setEditorDraftExists}
                    syncedHeadCommitId={syncedHeadCommitId}
                    canManageInvites={Boolean(visitor && visitor.visitorId === activeDoc.ownerVisitorId)}
                    onDelete={async () => {
                      if (activeDoc.relativePath.endsWith("/___desc___.md")) {
                        const folderPath = activeDoc.relativePath.replace(/\/___desc___\.md$/, "");
                        requestDeleteFolder(activeDoc.documentId, folderPath);
                      } else {
                        requestDeleteDocument(activeDoc.documentId, activeDoc.relativePath);
                      }
                    }}
                    saveBeforeNavRef={saveBeforeNavRef}
                    onShowToast={setMessage}
                    // 评论相关
                    onToggleComments={() => setCommentPanelOpen(!commentPanelOpen)}
                    commentPanelOpen={commentPanelOpen}
                    commentCount={commentCount}
                  />
                </div>

                {/* 评论抽屉面板 - 能读文档就能看评论 */}
                {commentPanelOpen && (
                  <CommentsPanel
                    documentId={activeDoc.documentId}
                    visitorId={visitor?.visitorId}
                    visitorName={visitor?.visitorName}
                    documentOwnerId={activeDoc.ownerVisitorId}
                    onClose={() => setCommentPanelOpen(false)}
                  />
                )}
              </div>
            ) : (
              // ---- 没有文档打开：渲染欢迎页 ----
              <div className="mdocs-welcome">
                <h1>{t("brand")}</h1>
                <p className="muted mdocs-welcome-lead">
                  {/* 根据文档树是否为空显示不同提示 */}
                  {tree.length === 0 ? t("noDocsInDomain") : t("createDocToStart")}
                </p>
                <div className="mdocs-welcome-domain">
                  <label className="muted mdocs-welcome-domain-label">
                    {t("domainLabel")}
                  </label>
                  <DomainSelect
                    // 如果域列表为空，使用 fallback 默认域，避免下拉显示空白
                    domains={domains.length ? domains : [{ domainId: "default", domainName: t("defaultDomain"), permission: "", creatorVisitorId: "", docCount: 0 }]}
                    value={currentDomainId}
                    onChange={(domainId) => {
                      guardNavigate(() => {
                        localStorage.setItem("mdocs.currentDomainId", domainId);
                        setCurrentDomainId(domainId);
                        setActiveDoc(null);
                        setSelectedCreateParentPath("");
                        navigate("/");
                        void refreshTree(domainId);
                      });
                    }}
                    ariaLabel={t("domainLabel")}
                    localizeName={(name: string) => localizeDomainName(name, lang, t)}
                  />
                </div>
                <div className="mdocs-welcome-actions">
                  <button type="button" className="primary" onClick={() => openNewDocumentModal()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <File size={16} strokeWidth={1.5} />
                    {t("newDocument")}
                  </button>
                  <button type="button" className="secondary" onClick={() => openNewFolderModal()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Folder size={16} strokeWidth={1.5} />
                    {t("newFolder")}
                  </button>
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
            />
            {mergeViewOpen && activeDoc && mergeConflict && (
              <MergeView
                documentId={activeDoc.documentId}
                displayName={activeDoc.displayName}
                conflict={mergeConflict}
                onClose={() => setMergeViewOpen(false)}
                onSuccess={handleMergeSuccess}
                onError={(msg) => setAlertMessage(msg)}
              />
            )}

            {/* 全局 Toast 消息 */}
            {message && (
              <div className="mdocs-toast" role="status">
                {message}
              </div>
            )}

            {/* 错误弹窗 */}
            {alertMessage && (
              <MessageDialog
                title={t("error")}
                message={alertMessage}
                onClose={() => setAlertMessage(null)}
              />
            )}
          </main>

          {/* ========== 退出确认弹窗 ========== */}
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
                      setActiveDoc(null);
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

          {/* ========== 收藏列表弹窗 ========== */}
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

          {/* ========== 右键菜单浮层 ========== */}
          {menu && (
            <TreeContextMenu
              x={menu.x}
              y={menu.y}
              node={menu.node}
              parentPath={menu.parentPath}
              onClose={() => setMenu(null)}
              onCreateChild={(parent) => openNewDocumentModal(parent)}
              onCreateFolder={(parent) => openNewFolderModal(parent)}
              onDeleteDocument={(doc) => requestDeleteDocument(doc.documentId, doc.path)}
              onDeleteFolder={(folder) => requestDeleteFolder(folder.documentId, folder.folderDisplayName || folder.name)}
            />
          )}

          {/* ========== 删除确认弹窗 ========== */}
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

          {/* ========== 新建文档/文件夹模态框 ========== */}
          {createModal && (
            <div
              className="mdocs-dialog-backdrop"
              role="presentation"
              // 点击遮罩层关闭模态框（但正在提交时不能关闭）
              onMouseDown={(ev) => {
                if (ev.target === ev.currentTarget && !createModalBusy) setCreateModal(null);
              }}
            >
              <div className="mdocs-dialog card" role="dialog" aria-modal="true">
                <h1>{createModal.kind === "document" ? t("newDocumentTitle") : t("newFolderTitle")}</h1>
                <p className="muted">
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
        </div>
      )}
    </div>
    </div>
  );
}
