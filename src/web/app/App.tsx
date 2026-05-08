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
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import type { VisitorPublic } from "../../shared/types/visitor";
import type { DocumentDetail } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import type { TreeNode } from "../../shared/types/tree";
import { stripDomainPathPrefix } from "../../shared/personalDomain";
import {
  ApiRequestError,
  clearIdentity,
  getStoredToken,
  getStoredVisitorId,
  storeIdentity,
  isDemoMode,
} from "../services/client";
import { fetchDomainsSafe, pickInitialDomainId } from "../services/domainsBootstrap";
import {
  deleteDocumentApi,
  fetchMe,
  fetchTreeApi,
  getDocumentApi,
  registerVisitorApi,
  updateDocumentApi,
} from "../services/endpoints";
import { VisitorRegisterDialog } from "./VisitorRegisterDialog";
import { VisitorIdNotice } from "./VisitorIdNotice";
import { DocumentTree, type TreeContextMenu as TreeContextMenuPayload } from "./DocumentTree";
import { TreeContextMenu } from "./TreeContextMenu";
import { DocumentEditor } from "./DocumentEditor";
import { DomainSelect } from "./DomainSelect";
import { SettingsPage } from "./SettingsPage";
import { MessageDialog } from "./MessageDialog";
import { useCreateModal } from "./hooks/useCreateModal";
import { ConflictNotice } from "./ConflictNotice";
import { getDraft, saveDraft as saveDraftRecord, deleteDraftIfUnchanged } from "../storage/drafts";
import { translateError, localizeDomainName, parentDirForCreates } from "./utils";
import { useAutoPublish } from "./hooks/useAutoPublish";
import mdocsLogo from "../assets/mdocs-logo.svg";
import "./App.css";
import "./domain.css";

type Phase = "loading" | "needsRegister" | "ready";

/**
 * 计算文档在界面中应展示的相对路径。
 * 若当前访客的个人域与文档所在域一致，则去掉个人域前缀，使路径更简洁。
 */
function docPathForSelection(doc: DocumentDetail): string {
  // 从 localStorage 读取当前访客 ID
  const vid = getStoredVisitorId();
  // 如果当前访客没有个人域，或者文档不在个人域中，直接返回原始路径
  if (!vid || doc.domainId !== vid) return doc.relativePath;
  // 去掉个人域前缀，让路径显示更简洁
  return stripDomainPathPrefix(vid, doc.relativePath);
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

  // ---- 访客信息 ----
  const [visitor, setVisitor] = useState<VisitorPublic | null>(null);

  // ---- 注册成功后临时展示访客 ID 的提示条 ----
  const [pendingVisitorId, setPendingVisitorId] = useState<string | null>(null);

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

  // ---- 全局 Toast 消息（如「已发布」） ----
  const [message, setMessage] = useState<string | null>(null);

  // ---- 错误弹窗消息 ----
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

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

  /**
   * 应用启动引导：检查本地 Token → 获取访客信息 → 加载域与文档树。
   * 若 Token 无效（401）则清除身份并回到注册页。
   * Demo 模式由构建参数 VITE_DEMO_MODE 控制，编译后固定。
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

    // 从 localStorage 读取访客 Token，如果没有则直接进入注册页
    if (!getStoredToken()) {
      setPhase("needsRegister");
      return;
    }
    try {
      // 携带 Token 向后端请求当前访客信息
      const me = await fetchMe();
      // 保存访客信息到状态，供全局使用
      setVisitor(me);
      // 加载访客可见的域列表，并挑选默认域加载文档树
      await initDomainsAndTree(me.visitorId, setDomains, setCurrentDomainId, refreshTree);
      // 一切就绪，切换到 ready 阶段
      setPhase("ready");
    } catch (err) {
      // 如果后端返回 401，说明 Token 已过期或无效
      if (err instanceof ApiRequestError && err.status === 401) {
        // 清除本地保存的无效身份
        clearIdentity();
        setPhase("needsRegister");
        return;
      }
      // 其他错误（如网络错误）显示错误提示，但仍回到注册页
      setAlertMessage(translateError(t, err));
      setPhase("needsRegister");
    }
  }

  /**
   * 处理访客注册：调用注册接口 → 保存身份到 localStorage → 初始化域与树。
   */
  async function handleRegister(visitorName: string): Promise<void> {
    // 向后端提交访客名称，创建新身份
    const res = await registerVisitorApi(visitorName);
    // 将返回的 visitorId 和 Token 存入 localStorage，供后续请求自动携带
    storeIdentity(res.visitor.visitorId, res.visitorToken);
    // 更新 React 状态中的访客信息
    setVisitor(res.visitor);
    // 触发访客 ID 提示条，提醒用户保存 ID 以便恢复
    setPendingVisitorId(res.visitor.visitorId);
    // 加载域列表和文档树
    await initDomainsAndTree(res.visitor.visitorId, setDomains, setCurrentDomainId, refreshTree);
    // 切换到 ready 阶段，展示主界面
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
   * 打开文档：优先从本地草稿加载（减少网络请求），无草稿时再请求服务器。
   * 若本地有草稿，还会把服务器返回的元数据缓存到草稿中，方便下次离线打开。
   */
  async function openDocument(docId: string): Promise<void> {
    try {
      // ========== 步骤 1：优先从本地草稿加载 ==========
      // 先查 IndexedDB 看是否有该文档的本地草稿
      const draft = await getDraft(docId);
      // 草稿必须满足以下条件才算可用：
      // - 存在且未标记为已发布
      // - 包含相对路径、域 ID、所有者 ID（即之前打开过时缓存过元数据）
      if (draft && !draft.published && draft.relativePath && draft.domainId && draft.ownerVisitorId) {
        console.log("[openDocument] loaded from local draft, content preview:", draft.content.slice(0, 100));
        // 直接用草稿数据构建 DocumentDetail，跳过网络请求
        setActiveDoc({
          documentId: draft.documentId,
          relativePath: draft.relativePath,
          displayName: draft.displayName,
          content: draft.content,
          permission: draft.permission!,
          ownerVisitorId: draft.ownerVisitorId!,
          domainId: draft.domainId,
        } as DocumentDetail);
        // 设置新建文档的默认父路径为当前文档所在文件夹
        setSelectedCreateParentPath(parentDirForCreates(draft.relativePath));
        // 本地加载成功，直接返回
        return;
      }

      // ========== 步骤 2：本地没有可用草稿，从服务器获取完整文档 ==========
      const doc = await getDocumentApi(docId);
      // 设置新建文档的默认父路径（根据当前域是否个人域决定是否去掉前缀）
      setSelectedCreateParentPath(parentDirForCreates(docPathForSelection(doc)));

      // ========== 步骤 3：把服务器元数据缓存到草稿中 ==========
      // 这样下次打开同一文档时，步骤 1 就能命中本地草稿，跳过网络请求
      if (draft && !draft.published) {
        console.log("[App.openDocument] saveDraftRecord (cache metadata), documentId:", docId);
        await saveDraftRecord({
          ...draft,
          relativePath: doc.relativePath,
          permission: doc.permission,
          ownerVisitorId: doc.ownerVisitorId,
          domainId: doc.domainId,
        });
      }

      // ========== 步骤 4：决定最终展示的内容 ==========
      // 如果有本地草稿（但只有内容，没有元数据），用草稿内容覆盖服务器内容
      // 如果没有草稿，直接使用服务器返回的完整文档
      setActiveDoc(draft && !draft.published
        ? { ...doc, content: draft.content, displayName: draft.displayName }
        : doc);
    } catch (err) {
      // 打开文档失败（如文档不存在、无权限），显示错误提示
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
      // URL 中没有文档 ID，清空当前文档，展示欢迎页
      setActiveDoc(null);
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
      setSelectedCreateParentPath(parentDirForCreates(docPathForSelection(doc)));
      navigate(`/doc/${doc.documentId}`);
    },
    refreshTree,
  });

  // ---- 发布冲突标记 ----
  const [conflict, setConflict] = useState(false);

  /**
   * 发布文档：将内容推送到服务器，成功后清除冲突标记并刷新树。
   * 目前所有发布失败都视为潜在冲突（待细化）。
   */
  async function publishDocument(content: string, displayName: string, documentId: string): Promise<void> {
    try {
      // 向后端 PUT 更新文档内容和标题
      const updated = await updateDocumentApi(documentId, { content, displayName });
      // 如果当前正在编辑的就是这篇文档，更新本地状态以反映最新内容
      setActiveDoc((prev) => (prev && prev.documentId === documentId ? updated : prev));
      // 刷新侧边栏文档树（文档修改时间等可能变化）
      await refreshTree();
      // 清除冲突标记（发布成功说明没有冲突）
      setConflict(false);
      // 显示「已发布」Toast 提示
      setMessage(t("published"));
      // 1.2 秒后自动隐藏 Toast
      window.setTimeout(() => setMessage(null), 1200);
    } catch (err) {
      // TODO: 未来需要区分真正的 Git 冲突和其他错误
      // 目前将所有发布失败都标记为冲突，提醒用户注意
      setConflict(true);
      throw err;
    }
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
      // 将草稿内容发布到服务器
      await updateDocumentApi(docId, { content: draft.content, displayName: draft.displayName });
      // 乐观锁：只有草稿在 API 调用期间没被修改过，才删除本地草稿
      const deleted = await deleteDraftIfUnchanged(docId, draft.updatedAt);
      if (!deleted) {
        console.log("[publishDraftFromList] draft modified during publish, keeping:", docId);
        // 草稿在发布过程中被用户修改了，保留草稿供下次扫描/发布
      }
      // 刷新文档树，更新文档状态
      await refreshTree();
      // 显示发布成功提示
      setMessage(t("published"));
      window.setTimeout(() => setMessage(null), 1200);
    } catch (err) {
      // 发布失败，显示错误弹窗
      setAlertMessage(translateError(t, err));
    }
  }

  /**
   * 删除指定文档：先确认弹窗，成功后若当前正在编辑该文档则清空编辑器并返回首页。
   */
  async function deleteDocumentById(documentId: string, label: string): Promise<void> {
    // 弹出浏览器原生确认框，显示要删除的文档路径
    if (!window.confirm(t("deleteConfirm", { name: label }))) return;
    try {
      // 向后端发送删除请求
      await deleteDocumentApi(documentId);
      // 如果当前正在编辑的就是这篇文档，需要清理编辑器状态
      if (activeDoc?.documentId === documentId) {
        setActiveDoc(null);
        setSelectedCreateParentPath("");
        navigate("/");
      }
      // 刷新文档树，移除已删除的文档节点
      await refreshTree();
    } catch (err) {
      // 删除失败（如无权限、文档不存在），显示错误提示
      setAlertMessage(translateError(t, err));
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
        error={message}
      />
    );
  }

  // ========== 主界面渲染 ==========
  return (
    <>
      {/* Demo Mode 提示横幅 — 在 grid 外面 */}
      {isDemoMode() && (
        <div className="mdocs-demo-banner">
          <span>🎮 Demo 模式</span>
          <span>·</span>
          <span>数据保存在浏览器本地</span>
          <span>·</span>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
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

      {/* 根据当前视图渲染设置页或文档页 */}
      {view === "settings" ? (
        <SettingsPage
          onBack={() => setView("docs")}
          onPublishDraft={publishDraftFromList}
        />
      ) : (
        <>
          {/* ========== 左侧边栏 ========== */}
          <aside className="mdocs-sidebar">
            {/* 品牌 Logo 区域 */}
            <header className="mdocs-sidebar-header">
              <div className="mdocs-brand">
                <img src={mdocsLogo} alt={t("brand")} className="mdocs-brand-logo" />
                <span>{t("brand")}</span>
              </div>
            </header>

            {/* 新建文档/文件夹按钮 */}
            <div className="mdocs-sidebar-actions">
              <button type="button" onClick={() => openNewDocumentModal()} className="primary">
                {t("newDocument")}
              </button>
              <button type="button" className="secondary" onClick={() => openNewFolderModal()}>
                {t("newFolder")}
              </button>
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
            <footer className="mdocs-sidebar-footer" onClick={() => { guardNavigate(() => setView("settings")); }}>
              <span className="mdocs-visitor-avatar">
                {/* 显示访客名称首字母作为头像 */}
                {visitor ? visitor.visitorName.charAt(0).toUpperCase() : "?"}
              </span>
              <span className="mdocs-visitor-footer-name">{visitor ? visitor.visitorName : ""}</span>
            </footer>
          </aside>

          {/* ========== 主内容区 ========== */}
          <main className="mdocs-main">
            {activeDoc ? (
              // ---- 有文档打开：渲染编辑器 ----
              <DocumentEditor
                // key 使用 documentId，切换文档时强制重新挂载编辑器，避免状态混淆
                key={activeDoc.documentId}
                document={activeDoc}
                // 判断当前访客是否有编辑权限：
                // - 文档所有者可编辑
                // - permission === 2（公开可编辑）的文档所有人可编辑
                canEdit={Boolean(visitor && (activeDoc.ownerVisitorId === visitor.visitorId || activeDoc.permission === 2))}
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
                onDelete={() =>
                  deleteDocumentById(activeDoc.documentId, activeDoc.relativePath)
                }
                saveBeforeNavRef={saveBeforeNavRef}
              />
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
                  <button type="button" className="primary" onClick={() => openNewDocumentModal()}>
                    {t("newDocument")}
                  </button>
                  <button type="button" className="secondary" onClick={() => openNewFolderModal()}>
                    {t("newFolder")}
                  </button>
                </div>
              </div>
            )}

            {/* 发布冲突提示条 */}
            {conflict && (
              <ConflictNotice onDismiss={() => setConflict(false)} />
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
              onDelete={(doc) => deleteDocumentById(doc.documentId, doc.path)}
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
        </>
      )}
    </div>
    </>
  );
}
