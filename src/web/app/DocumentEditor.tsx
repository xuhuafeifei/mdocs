/**
 * 文档编辑器组件
 * 基于 @lobehub/editor 的 Lexical 富文本编辑器封装。
 * 职责：
 * 1. 渲染编辑器界面（标题输入、域选择、工具栏）
 * 2. 管理编辑状态（编辑/只读、发布中、草稿状态）
 * 3. 自动保存草稿到 IndexedDB（通过 useAutoSave）
 * 4. 发布文档到服务器
 * 5. 处理内容类型检测（Lexical JSON vs Markdown）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Block } from "@lobehub/ui";
import { saveDraft as saveDraftToIdb } from "../storage/drafts";

import {
  INSERT_CODEINLINE_COMMAND,
  INSERT_CODEMIRROR_COMMAND,
  INSERT_FILE_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_LINK_COMMAND,
  INSERT_MATH_COMMAND,
  INSERT_TABLE_COMMAND,
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactFilePlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactMathPlugin,
  ReactMeta2dPlugin,
  ReactTablePlugin,
  ReactToolbarPlugin,
  ReactMarkdownPlugin,
  OutlinePanel,
  OutlineProvider,
  enUS,
  zhCN,
  useOutlineVisibility,
} from "@lobehub/editor";
import type { IEditor } from "@lobehub/editor";
import { Editor, withProps } from "@lobehub/editor/react";
import { Heading1Icon, Heading2Icon, Heading3Icon, MinusIcon, SigmaIcon, Table2Icon, TextAlignJustify } from "lucide-react";

import type { DocumentDetail } from "../../shared/types/document";
import type { DomainSummary } from "../../shared/types/domain";
import {
  DocumentPermission,
  allowedPermissionsForDomain,
  type DocumentPermissionValue,
} from "../../shared/permissions.js";
import { useI18n } from "../i18n";
import { openFileSelector } from "./actions";
import Toolbar from "./Toolbar";
import { DomainSelect } from "./DomainSelect";
import { uploadAssetApi, checkBookmarkApi, addBookmarkApi, removeBookmarkApi, fetchVisitorsDirectoryApi, addDocumentInviteApi, getDocumentInvitesApi, removeDocumentInviteApi } from "../services/endpoints";
import { useAutoSave } from "./hooks/useAutoSave";
import { usePublishGuard } from "./hooks/usePublishGuard";
import { localizeDomainName } from "./utils";
import { FALLBACK_DOMAIN_SUMMARY } from "../services/domainsBootstrap";
import type { VisitorDirectoryEntry } from "../../shared/types/visitor";
import { VisitorPickerModal } from "./VisitorPickerModal";

/**
 * 大纲侧边栏：根据大纲可见性动态控制宽度，带动画过渡效果。
 */
function OutlineSideRail({ editor }: { editor: IEditor }) {
  // 从 OutlineProvider 获取大纲当前是否可见
  const { visible } = useOutlineVisibility();

  return (
    <div
      style={{
        // 不允许被压缩
        flexShrink: 0,
        // 隐藏时裁剪内容，配合 width 实现动画
        overflow: "hidden",
        // 宽度变化动画
        transition: "width 0.2s ease",
        // 可见时宽 200px，不可见时宽 0
        width: visible ? 200 : 0,
      }}
    >
      {/* 内部固定宽度，确保内容不被挤压 */}
      <div style={{ width: 200 }}>
        <OutlinePanel editor={editor} />
      </div>
    </div>
  );
}

interface DocumentEditorProps {
  document: DocumentDetail;
  canEdit: boolean;
  domains: DomainSummary[];
  currentDomainId: string;
  onDomainChange: (domainId: string) => void;
  onPublish: (content: string, displayName: string, documentId: string, permission?: number) => Promise<void>;
  onDelete: () => Promise<void>;
  /** Called by App.tsx before navigation to flush pending changes */
  saveBeforeNavRef?: React.MutableRefObject<(() => Promise<void>) | undefined>;
  /** Toast message callback */
  onShowToast?: (message: string) => void;
}

export function DocumentEditor(props: DocumentEditorProps) {
  // ---- 国际化 ----
  const { t, lang } = useI18n();

  // ---- 文档信息菜单显示状态 ----
  const [showDocInfoMenu, setShowDocInfoMenu] = useState(false);
  const docInfoMenuRef = useRef<HTMLDivElement>(null);
  const [visitors, setVisitors] = useState<VisitorDirectoryEntry[]>([]);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionDraft, setPermissionDraft] = useState<DocumentPermissionValue>(props.document.permission as DocumentPermissionValue);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [existingInvites, setExistingInvites] = useState<Map<string, string>>(new Map());
  const [inviteBusy, setInviteBusy] = useState(false);

  // ---- 点击菜单外部自动关闭 ----
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (docInfoMenuRef.current && !docInfoMenuRef.current.contains(event.target as Node)) {
        setShowDocInfoMenu(false);
      }
    };

    if (showDocInfoMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDocInfoMenu]);

  // ---- 加载访客目录（用于显示创建者昵称）----
  useEffect(() => {
    fetchVisitorsDirectoryApi().then(setVisitors).catch(() => {});
  }, []);

  /**
   * 根据 visitorId 查找访客昵称
   */
  function getVisitorName(visitorId: string): string {
    const v = visitors.find((x) => x.visitorId === visitorId);
    return v?.visitorName ?? visitorId.slice(0, 8);
  }

  // ---- 文档标题（显示名称）----
  // 用户可以在输入框中修改，失焦时自动保存
  const [displayName, setDisplayName] = useState(props.document.displayName);

  // ---- 发布中状态 ----
  // true 时禁用发布按钮，防止重复提交
  const [busy, setBusy] = useState(false);

  // ---- 书签/收藏状态 ----
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // ---- 是否处于编辑模式 ----
  // 从 localStorage 读取用户偏好，默认自动进入编辑模式
  const [isEditing, setIsEditing] = useState(() => localStorage.getItem("mdocs.autoEdit") !== "false");

  // 最终编辑权限 = 用户有编辑权限 && 用户选择了编辑模式
  const editing = props.canEdit && isEditing;

  // ---- 编辑器实例引用 ----
  // @lobehub/editor 的 IEditor 实例，初始化后通过 onInit 回调设置
  const [editor, setEditor] = useState<IEditor | null>(null);

  // ---- 最新内容引用 ----
  // 用于 handleInit 中读取最新内容（useCallback 的闭包不会自动更新）
  const contentRef = useRef(props.document.content);
  // 每次 props.document.content 变化时同步更新 ref
  contentRef.current = props.document.content;

  /**
   * 检测传入内容是 Lexical JSON 还是原始 Markdown。
   * 草稿现在存储 JSON；从 API 获取的文档包含 Markdown。
   */
  const contentType = useMemo<"json" | "markdown">(() => {
    // 如果内容为空，按 JSON 处理（编辑器会创建空文档）
    if (!props.document.content) return "json";
    try {
      // 尝试解析为 JSON，检查是否有 Lexical 的根节点结构
      const p = JSON.parse(props.document.content);
      // 如果有 root.children，说明是 Lexical JSON 格式
      return p?.root?.children ? "json" : "markdown";
    } catch {
      // 解析失败说明是原始 Markdown 字符串
      return "markdown";
    }
  }, [props.document.content]);

  /**
   * 构建文档元数据对象，随草稿一起保存到 IndexedDB。
   * 这样下次离线打开时可以跳过网络请求。
   */
  const documentMeta = useMemo(() => ({
    relativePath: props.document.relativePath,
    permission: props.document.permission,
    ownerVisitorId: props.document.ownerVisitorId,
    domainId: props.document.domainId,
  }), [props.document.relativePath, props.document.permission, props.document.ownerVisitorId, props.document.domainId]);

  // ---- 自动保存 Hook ----
  // isDirty: 内容是否有未保存的变更
  // draftExists: IndexedDB 中是否已有该文档的草稿
  // clearDraft: 发布成功后清除草稿
  // loadDraftContent: 加载本地草稿内容（作为 fallback）
  // markDraftSaved: 标记草稿已保存（用于手动保存时同步状态）
  const {
    isDirty: _isDirty,
    draftExists,
    clearDraft,
    loadDraftContent,
    markDraftSaved,
  } = useAutoSave({
    editor,
    documentId: props.document.documentId,
    displayName,
    enabled: props.canEdit,
    documentMeta,
  });

  // ---- 发布保护：拦截浏览器关闭事件，防止未保存内容丢失 ----
  usePublishGuard({ isDirty: _isDirty, draftExists });

  /**
   * 切换文档时尝试加载本地草稿内容。
   * 注意：App.tsx openDocument 已经优先提供了草稿内容，
   * 这里的异步加载是 fallback，处理草稿没有缓存元数据的情况。
   */
  useEffect(() => {
    loadDraftContent().then((draft) => {
      if (draft) {
        // App.tsx 正常情况下已经处理了草稿加载，这里很少会命中
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.document.documentId]);

  /**
   * 同步编辑器语言与 mdocs 全局语言设置。
   * 当用户切换语言或编辑器初始化后，更新编辑器内部 UI 语言。
   */
  useEffect(() => {
    // editor 可能还未初始化（onInit 尚未调用）
    editor?.setLocale(lang === "zh" ? zhCN : enUS);
  }, [editor, lang]);

  /**
   * 切换文档时同步标题输入框的显示名称。
   * 确保打开不同文档时，标题栏显示正确的文档名称。
   */
  useEffect(() => {
    setDisplayName(props.document.displayName);
  }, [props.document.displayName, props.document.documentId]);

  useEffect(() => {
    setPermissionDraft(props.document.permission as DocumentPermissionValue);
  }, [props.document.permission, props.document.documentId]);

  /**
   * 切换文档时检查当前文档的收藏状态。
   */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await checkBookmarkApi(props.document.documentId);
        if (mounted) {
          setIsBookmarked(result.bookmarked);
        }
      } catch {
        // 忽略检查书签的错误
      }
    })();
    return () => {
      mounted = false;
    };
  }, [props.document.documentId]);

  /**
   * 切换收藏状态。
   */
  async function toggleBookmark(): Promise<void> {
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      if (isBookmarked) {
        await removeBookmarkApi(props.document.documentId);
        setIsBookmarked(false);
        props.onShowToast?.(t("bookmarkRemoved"));
      } else {
        await addBookmarkApi(props.document.documentId);
        setIsBookmarked(true);
        props.onShowToast?.(t("bookmarkAdded"));
      }
    } finally {
      setBookmarkBusy(false);
    }
  }

  /**
   * 将 saveDraft 方法暴露给 App.tsx，以便导航前刷新待保存的变更。
   * 不需要依赖项，每次渲染都更新 ref，确保 App.tsx 拿到最新方法。
   */
  useEffect(() => {
    if (props.saveBeforeNavRef) {
      props.saveBeforeNavRef.current = saveDraft;
    }
  });

  /**
   * 格式化文件大小显示
   */
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * 编辑器初始化回调。
   * 绕过 content prop 的 bug，通过 editor API 在微任务中重新设置内容，确保编辑器已完全挂载。
   */
  const handleInit = useCallback((e: IEditor) => {
    // 保存编辑器实例到状态，供工具栏等子组件使用
    setEditor(e);
    // Bypass buggy content prop — re-set content programmatically via editor API
    // queueMicrotask ensures the editor has fully initialized first.
    const initContent = contentRef.current;
    if (initContent) {
      // 先默认按 markdown 处理
      let ct: "json" | "markdown" = "markdown";
      try {
        // 尝试解析为 JSON，判断是否是 Lexical 格式
        const p = JSON.parse(initContent);
        ct = p?.root?.children ? "json" : "markdown";
      } catch {
        // 解析失败就是 markdown
        ct = "markdown";
      }
      // 在微任务中设置内容，确保编辑器内部已完全初始化
      queueMicrotask(() => {
        e.setDocument(ct, initContent);
      });
    }
    // 调试用：打印编辑器初始化后的内容结构前两个节点
    queueMicrotask(() => {
      const afterInit = e.getDocument("json");
      console.log("[handleInit] editor content after setDocument:", JSON.stringify(afterInit?.root?.children?.slice(0, 2)));
    });

  }, []);

  /**
   * 发布文档：将当前编辑器内容序列化为 JSON 并推送到服务器，成功后清除本地草稿。
   */
  async function publish(): Promise<void> {
    // 如果没有编辑器实例或没有编辑权限，直接返回
    if (!editor || !props.canEdit) return;
    // 标记发布中，禁用发布按钮
    setBusy(true);
    try {
      // 将编辑器内容序列化为 Lexical JSON 字符串
      const content = JSON.stringify(editor.getDocument("json"));
      // 调用 App.tsx 传入的 onPublish，执行实际的 API 请求
      await props.onPublish(content, displayName, props.document.documentId);
      // 发布成功后清除本地草稿（草稿已不需要）
      await clearDraft();
    } catch (err) {
      // 发布失败时抛出错误，让上层处理（如显示冲突提示）
      throw err;
    } finally {
      // 无论成功失败，都要关闭发布中状态
      setBusy(false);
    }
  }

  /**
   * 标题失焦时：若显示名称有变更则自动发布。
   * 这样用户修改标题后不需要手动点击发布按钮。
   */
  async function saveDisplayNameIfChanged(): Promise<void> {
    // 如果没有编辑权限，不处理
    if (!props.canEdit) return;
    // 获取原始标题（去除首尾空格）
    const prev = props.document.displayName.trim();
    // 获取当前输入框中的标题（去除首尾空格）
    const next = displayName.trim();
    // 如果没有变化，跳过发布
    if (next === prev) return;
    // 标题有变更，执行发布
    await publish();
  }

  const currentDomain = useMemo(
    () => props.domains.find((d) => d.domainId === props.document.domainId),
    [props.domains, props.document.domainId],
  );

  const allowedPermissions = useMemo<DocumentPermissionValue[]>(() => {
    const domainPermission = currentDomain?.permission ?? "public";
    return allowedPermissionsForDomain(domainPermission);
  }, [currentDomain?.permission]);

  function permissionLabel(permission: DocumentPermissionValue): string {
    if (permission === DocumentPermission.PRIVATE) return t("permissionPrivate");
    if (permission === DocumentPermission.DOMAIN_READ) return t("permissionInvite");
    if (permission === DocumentPermission.DOMAIN_WRITE) return t("permissionDomainWrite");
    if (permission === DocumentPermission.PUBLIC_READ) return t("permissionPublicRead");
    return t("permissionPublicEdit");
  }

  async function savePermission(): Promise<void> {
    if (permissionBusy || permissionDraft === props.document.permission) {
      setShowPermissionDialog(false);
      return;
    }
    setPermissionBusy(true);
    try {
      const content = editor ? JSON.stringify(editor.getDocument("json")) : props.document.content;
      await props.onPublish(content, displayName, props.document.documentId, permissionDraft);
      setShowPermissionDialog(false);
      props.onShowToast?.(t("docInfoPermissionUpdated"));
    } finally {
      setPermissionBusy(false);
    }
  }

  /**
   * 保存邀请成员：对比新旧邀请列表，处理新增、删除、权限变更
   */
  async function saveInvite(result: Array<{ visitorId: string; permission: string }>): Promise<void> {
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      const newIds = new Set(result.map((r) => r.visitorId));
      const newPermMap = new Map(result.map((r) => [r.visitorId, r.permission]));

      for (const [visitorId] of existingInvites) {
        if (!newIds.has(visitorId)) {
          await removeDocumentInviteApi(props.document.documentId, visitorId);
        }
      }

      for (const { visitorId, permission } of result) {
        const oldPerm = existingInvites.get(visitorId);
        if (!oldPerm || oldPerm !== permission) {
          await addDocumentInviteApi(props.document.documentId, visitorId, permission);
        }
      }

      setShowInvitePicker(false);
      props.onShowToast?.(t("docInfoInviteSuccess", { count: result.length }));
    } finally {
      setInviteBusy(false);
    }
  }

  /**
   * 保存草稿到 IndexedDB。
   * 若内容无变更则跳过，避免切文章时 guardNavigate 无条件触发保存。
   * 先同步标记已保存状态，再执行异步写入，确保导航守卫立即看到干净状态。
   */
  async function saveDraft(): Promise<void> {
    // 没有编辑器实例或没有编辑权限时不保存
    if (!editor || !props.canEdit) return;
    // 内容没有变更则跳过，防止切文章时 guardNavigate 无条件触发保存
    if (!_isDirty) {
      console.log("[DocumentEditor.saveDraft] skipped: not dirty, documentId:", props.document.documentId);
      return;
    }
    // 将当前编辑器内容序列化为 JSON
    const jsonContent = JSON.stringify(editor.getDocument("json"));
    console.log("[DocumentEditor.saveDraft] saving draft, documentId:", props.document.documentId, "content preview:", jsonContent.slice(0, 80));
    // Mark as saved synchronously BEFORE async IndexedDB write,
    // so the navigation guard sees clean state immediately.
    markDraftSaved();
    // 异步写入 IndexedDB
    await saveDraftToIdb({
      documentId: props.document.documentId,
      content: jsonContent,
      displayName,
      updatedAt: Date.now(),
      published: false,
      relativePath: props.document.relativePath,
      permission: props.document.permission,
      ownerVisitorId: props.document.ownerVisitorId,
      domainId: props.document.domainId,
    });
  }

  /**
   * Slash 命令菜单项：输入 / 时展示的快捷插入命令（标题、分割线、表格、公式、文件、链接、代码等）。
   */
  const slashItems = useMemo(
    () => [
      {
        icon: Heading1Icon,
        key: "h1",
        label: "Heading 1",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: "h1" });
        },
      },
      {
        icon: Heading2Icon,
        key: "h2",
        label: "Heading 2",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: "h2" });
        },
      },
      {
        icon: Heading3Icon,
        key: "h3",
        label: "Heading 3",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: "h3" });
        },
      },
      // 分隔线
      { type: "divider" },
      {
        icon: MinusIcon,
        key: "hr",
        label: "Hr",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {});
        },
      },
      {
        icon: Table2Icon,
        key: "table",
        label: "Table",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: "3", rows: "3" });
        },
      },
      {
        icon: SigmaIcon,
        key: "tex",
        label: "TeX",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_MATH_COMMAND, { code: "x^2 + y^2 = z^2" });
          queueMicrotask(() => editor.focus());
        },
      },
      // 分隔线
      { type: "divider" },
      {
        key: "file",
        label: "File",
        onSelect: (editor: IEditor) => {
          openFileSelector((files) => {
            // 遍历选中的文件，逐个插入到编辑器中
            for (const file of files) {
              editor.dispatchCommand(INSERT_FILE_COMMAND, { file });
            }
          });
        },
      },
      {
        key: "insert-link",
        label: "Insert Link",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_LINK_COMMAND, { url: "https://example.com" });
          queueMicrotask(() => editor.focus());
        },
      },
      {
        key: "insert-codeInline",
        label: "Inline Code",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined);
          queueMicrotask(() => editor.focus());
        },
      },
      {
        key: "insert-codeBlock",
        label: "Code Block",
        onSelect: (editor: IEditor) => {
          editor.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined);
          queueMicrotask(() => editor.focus());
        },
      },
    ].map((item) => {
      // 分隔线项不做处理，直接返回
      if ("type" in item && item.type === "divider") return item;
      // 普通项添加右侧快捷键提示
      return {
        ...item,
        extra: (
          <span style={{ color: "var(--mdocs-text-muted)", fontFamily: "monospace", fontSize: 12 }}>
            {item.key}
          </span>
        ),
      };
    }),
    [],
  );

  /**
   * 编辑器插件列表：Markdown、列表、链接、图片、代码块、表格、数学公式、图表、文件、工具栏、图片转存等。
   */
  const plugins = useMemo(
    () => [
      ReactMarkdownPlugin,
      ReactListPlugin,
      ReactLinkPlugin,
      ReactImagePlugin,
      ReactCodemirrorPlugin,
      ReactHRPlugin,
      ReactTablePlugin,
      ReactMathPlugin,
      ReactMeta2dPlugin,
      ReactCodePlugin,
      // 工具栏插件：传入浮动工具栏组件
      withProps(ReactToolbarPlugin, {
        children: editor ? (
          <Toolbar
            editor={editor}
            floating
            outlineCollapseTitle={t("outlineHide")}
            outlineExpandTitle={t("outlineShow")}
            outlineToggle
          />
        ) : null,
      }),
      // 文件上传插件：将文件上传到服务器资源存储
      withProps(ReactFilePlugin, {
        handleUpload: async (file: File) => {
          const url = await uploadAssetApi(file, props.document.documentId);
          return { url };
        },
      }),
      // 图片插件：支持 blob URL 转存到服务器
      withProps(ReactImagePlugin, {
        defaultBlockImage: true,
        // 判断图片是否需要转存：blob URL 是本地临时地址，需要上传到服务器
        needRehost: (url: string) => url.startsWith("blob:"),
        // 转存逻辑：下载 blob → 转为 File → 上传 → 返回服务器 URL
        handleRehost: async (url: string) => {
          const res = await fetch(url);
          const blob = await res.blob();
          const file = new File([blob], "image.png", { type: blob.type });
          const serverUrl = await uploadAssetApi(file, props.document.documentId);
          return { url: serverUrl };
        },
      }),
    ],
    [editor, t],
  );

  return (
    <div className="mdocs-editor">
      {/* ========== 编辑器顶部工具栏 ========== */}
      <div className="mdocs-editor-toolbar">
        {/* 文档标题输入框 */}
        <input
          className="mdocs-editor-title-input"
          value={displayName}
          // 用户输入时实时更新标题状态
          onChange={(e) => setDisplayName(e.target.value)}
          // 失焦时检查标题是否有变更，有则自动发布
          onBlur={() => void saveDisplayNameIfChanged()}
          placeholder={t("displayNamePlaceholder")}
          // 非编辑模式时禁用标题输入
          disabled={!editing}
        />
        {/* 域选择下拉 */}
        <DomainSelect
          // 如果没有域数据，使用 fallback 默认域避免空白
          domains={props.domains.length ? props.domains : [FALLBACK_DOMAIN_SUMMARY]}
          value={props.currentDomainId}
          onChange={props.onDomainChange}
          ariaLabel={t("currentDomainAria")}
          localizeName={(name: string) => localizeDomainName(name, lang, t)}
        />
        {/* 弹性占位，将右侧按钮推到最右边 */}
        <span className="mdocs-editor-toolbar-spacer" aria-hidden />
        <div className="mdocs-editor-toolbar-actions">
          {editing ? (
            <>
              {/* 未开启自动同步时，显示保存状态指示器 */}
              {localStorage.getItem("mdocs.autoPublish") !== "true" && (
                <span className="mdocs-save-indicator">
                  {/* 根据状态显示不同颜色的圆点 */}
                  <span className={"mdocs-save-dot " + (busy ? "saving" : draftExists ? "unsaved" : "saved")} />
                  <span>
                    {/* busy: 发布中 / draftExists: 有未保存草稿 / 否则: 已发布 */}
                    {busy ? t("publishing") : draftExists ? t("unsaved") : t("published")}
                  </span>
                </span>
              )}
              {/* 发布按钮 */}
              <button type="button" className="primary" disabled={busy} onClick={() => void publish()}>
                {busy ? t("publishing") : t("publish")}
              </button>
              {/* 删除按钮 */}
              <button type="button" className="danger" disabled={busy} onClick={props.onDelete}>
                {t("delete")}
              </button>
            </>
          ) : (
            // 有编辑权限但当前是只读模式时，显示「编辑」按钮
            props.canEdit && (
              <button type="button" className="primary" onClick={() => setIsEditing(true)}>
                {t("edit")}
              </button>
            )
          )}
          {/* 文档信息菜单按钮（所有模式都显示） */}
          <div ref={docInfoMenuRef} className="mdocs-tooltip mdocs-tooltip-bottom" data-tooltip={t("docInfo")} style={{ position: "relative" }}>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowDocInfoMenu(!showDocInfoMenu)}
              style={{ padding: "4px 8px", minWidth: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <TextAlignJustify size={18} strokeWidth={1.5} style={{ color: "var(--mdocs-text-secondary, #6b7280)" }} />
            </button>
            {/* 下拉菜单 */}
            {showDocInfoMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: "4px",
                  background: "var(--mdocs-surface, #fff)",
                  border: "1px solid var(--mdocs-border, #e5e5e5)",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  minWidth: "220px",
                  zIndex: 100,
                  padding: "8px 0",
                }}
              >
                {/* 元信息区域 */}
                <div style={{ padding: "4px 16px", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoCreator")}</span>
                    <span>{getVisitorName(props.document.ownerVisitorId)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoCreatedAt")}</span>
                    <span>{new Date(props.document.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoSize")}</span>
                    <span>{formatFileSize(new Blob([props.document.content]).size)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--mdocs-text-muted, #888)" }}>{t("docInfoUpdatedAt")}</span>
                    <span>{new Date(props.document.updatedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</span>
                  </div>
                </div>
                {/* 分隔线 */}
                <div style={{ height: "1px", background: "var(--mdocs-border, #e5e5e5)", margin: "8px 0" }} />
                {/* 可点击操作按钮区域 */}
                <button
                  type="button"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--mdocs-hover-bg, #f5f5f5)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  onClick={() => {
                    void toggleBookmark();
                  }}
                >
                  <span>{isBookmarked ? "⭐" : "☆"}</span>
                  <span>{isBookmarked ? t("bookmarkRemove") : t("bookmarkAdd")}</span>
                </button>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--mdocs-hover-bg, #f5f5f5)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  onClick={() => {
                    setShowDocInfoMenu(false);
                    void (async () => {
                      setInviteLoading(true);
                      try {
                        const invites = await getDocumentInvitesApi(props.document.documentId);
                        const inviteMap = new Map(invites.map((i) => [i.visitorId, i.permission]));
                        setExistingInvites(inviteMap);
                        setShowInvitePicker(true);
                      } finally {
                        setInviteLoading(false);
                      }
                    })();
                  }}
                >
                  <span>👥</span>
                  <span>{t("docInfoInviteMember")}</span>
                </button>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--mdocs-hover-bg, #f5f5f5)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  onClick={() => {
                    setShowDocInfoMenu(false);
                    setPermissionDraft(props.document.permission as DocumentPermissionValue);
                    setShowPermissionDialog(true);
                  }}
                >
                  {t("docInfoChangePermission")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showPermissionDialog && (
        <div
          className="mdocs-dialog-backdrop"
          style={{ position: "fixed", zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPermissionDialog(false); }}
        >
          <div className="mdocs-dialog card" style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: "1.1rem", marginBottom: 12 }}>{t("docInfoChangePermission")}</h1>
            <div className="muted" style={{ marginBottom: 12 }}>
              {t("domainPermission")}：{currentDomain ? localizeDomainName(currentDomain.domainName, lang, t) : props.document.domainId}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {allowedPermissions.map((permission) => (
                <label key={permission} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="doc-permission"
                    value={permission}
                    checked={permissionDraft === permission}
                    onChange={() => setPermissionDraft(permission)}
                  />
                  <span>{permissionLabel(permission)}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowPermissionDialog(false)}>{t("cancel")}</button>
              <button type="button" className="primary" disabled={permissionBusy} onClick={() => void savePermission()}>
                {permissionBusy ? t("publishing") : t("saveAndPublish")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 邀请成员访客选择器弹窗 */}
      <VisitorPickerModal
        open={showInvitePicker}
        title={t("docInfoInviteMember")}
        initialSelectedIds={[...existingInvites.keys()]}
        initialPermissions={existingInvites}
        templates={[]}
        showPermissionSelect={true}
        permissionOptions={[
          { value: "read", label: t("invitePermissionRead") },
          { value: "edit", label: t("invitePermissionEdit") },
        ]}
        onClose={() => setShowInvitePicker(false)}
        onConfirm={(result) => {
          void saveInvite(result as Array<{ visitorId: string; permission: string }>);
        }}
      />
      <OutlineProvider>
        <Block flex={1} style={{ minHeight: 0 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              minHeight: 0,
            }}
          >
            {/* 编辑模式下显示顶部固定工具栏 */}
            {editing && editor && (
              <Toolbar
                editor={editor}
                outlineCollapseTitle={t("outlineHide")}
                outlineExpandTitle={t("outlineShow")}
                outlineToggle
              />
            )}
            <div className="mdocs-editor-content-area" style={{ flex: 1, display: "flex", minHeight: 0 }}>
              <Block
                variant="outlined"
                horizontal
                padding={16}
                style={{ background: "var(--mdocs-surface)", flex: 1, minHeight: 0, overflow: "auto", outline: "none" }}
              >
                <div style={{ flex: 1 }}>
                  <Editor
                    content={props.document.content}
                    type={contentType}
                    // key 使用 documentId，切换文档时强制重新挂载，避免内容混淆
                    key={props.document.documentId}
                    confirmPasteMarkdown
                    // 编辑模式下可编辑，只读模式下不可编辑
                    editable={editing}
                    onInit={handleInit}
                    plugins={plugins}
                    lineEmptyPlaceholder={t("displayNamePlaceholder")}
                    placeholder={t("displayNamePlaceholder")}
                    slashOption={{ items: slashItems }}
                    className="mdocs-document-editor-root"
                  />
                </div>
                {/* 大纲侧边栏：根据可见性动态显示/隐藏 */}
                {editor && <OutlineSideRail editor={editor} />}
              </Block>
            </div>
        </div>
      </Block>
      </OutlineProvider>
    </div>
  );
}
