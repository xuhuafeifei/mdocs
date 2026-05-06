/**
 * 新建文档/文件夹模态框 Hook
 * 封装新建文档和文件夹的表单状态、验证逻辑与 API 调用。
 * 路径规范化：用户输入的显示名称会映射为存储路径（空格转下划线等）。
 * 新建文件夹时调用独立的 /api/folders 接口。
 */
import { useEffect, useRef, useState } from "react";
import type { DocumentDetail } from "../../../shared/types/document";
import type { TreeNode } from "../../../shared/types/tree";
import type { TranslationKey } from "../../i18n/types";
import { normaliseDocRelativePath } from "../../../shared/docPath";
import {
  normalisePathSegmentForStorage,
  normaliseRelativePathForStorage,
  parseDisplayNameFolder,
  parseDisplayNameMarkdownFile,
} from "../../../shared/storagePath";
import { FOLDER_DESC_FILENAME, folderDescPathForFolder } from "../../../shared/folderDesc";
import { stripDomainPathPrefix } from "../../../shared/personalDomain";
import { getStoredVisitorId } from "../../services/client";
import { createDocumentApi, createFolderApi } from "../../services/endpoints";
import { STORAGE_ERROR_MESSAGE_MAP } from "../../i18n/errors";
import { translateError, parentDirForCreates } from "../utils";

/**
 * 构建一个最简的 Lexical JSON 文档，只包含一个 h1 标题节点。
 * 用于新建文档/文件夹时生成默认内容。
 */
function buildLexicalJsonHeading(title: string): string {
  return JSON.stringify({
    root: {
      children: [
        {
          children: [
            { detail: 0, format: 0, mode: "normal", text: title, type: "text", version: 1 },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "heading",
          tag: "h1",
          version: 1,
        },
      ],
      direction: "ltr",
      type: "root",
      version: 1,
    },
  });
}

export type CreateModalState =
  | { kind: "document"; parentMode: "selection" | "fixed"; parentPath: string; draft: string }
  | { kind: "folder"; parentMode: "selection" | "fixed"; parentPath: string; draft: string };

/**
 * 将父路径与文件名拼接为相对路径。
 */
function joinDocPath(parentPath: string, fileName: string): string {
  const p = parentPath.trim();
  const f = fileName.trim();
  // 如果文件名为空，直接返回父路径
  if (!f) return p;
  // 如果父路径为空，直接返回文件名；否则用 / 拼接
  return p ? `${p}/${f}` : f;
}

/**
 * 计算文档在界面中的展示路径（同 App.tsx，去掉个人域前缀）。
 */
function docPathForSelection(doc: DocumentDetail): string {
  const vid = getStoredVisitorId();
  if (!vid || doc.domainId !== vid) return doc.relativePath;
  return stripDomainPathPrefix(vid, doc.relativePath);
}

/**
 * 递归收集树中所有已存在的文档路径（含文件夹描述文档），用于新建时查重。
 */
function collectDocumentPaths(nodes: TreeNode[], out = new Set<string>()): Set<string> {
  for (const n of nodes) {
    if (n.type === "document") {
      // 文档节点：直接收集其路径
      out.add(n.path);
    } else {
      // 文件夹节点：如果有描述文档，也收集描述文档的路径
      if (n.descDocumentId) out.add(folderDescPathForFolder(n.path));
      // 递归收集子节点
      collectDocumentPaths(n.children, out);
    }
  }
  return out;
}

/**
 * 根据父路径在树中查找父文件夹节点，返回其 documentId。
 */
function findFolderIdByPath(nodes: TreeNode[], path: string): string | null {
  for (const n of nodes) {
    if (n.type === "folder" && n.path === path) return n.documentId;
    if (n.type === "folder") {
      const found = findFolderIdByPath(n.children, path);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 将存储层校验错误信息转换为本地化提示。
 */
function translateStorageError(t: (k: TranslationKey, vars?: Record<string, string>) => string, message: string): string {
  const key = STORAGE_ERROR_MESSAGE_MAP[message];
  if (key) return t(key);
  return message;
}

interface UseCreateModalOpts {
  tree: TreeNode[];
  currentDomainId: string;
  selectedCreateParentPath: string;
  t: (k: TranslationKey, vars?: Record<string, string>) => string;
  onDocCreated: (doc: DocumentDetail) => void;
  refreshTree: () => Promise<void>;
}

export function useCreateModal(opts: UseCreateModalOpts) {
  const { tree, currentDomainId, selectedCreateParentPath, t, onDocCreated, refreshTree } = opts;

  // ---- 模态框状态：null 表示未打开 ----
  const [createModal, setCreateModal] = useState<CreateModalState | null>(null);

  // ---- 模态框错误提示 ----
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  // ---- 模态框提交中状态 ----
  const [createModalBusy, setCreateModalBusy] = useState(false);

  // ---- 输入框引用：用于打开模态框后自动聚焦 ----
  const createModalInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * 模态框打开后自动聚焦输入框，提升用户体验。
   */
  useEffect(() => {
    // 如果模态框未打开，不需要聚焦
    if (!createModal) return;
    // 延迟一帧聚焦，确保输入框已渲染到 DOM
    const id = window.setTimeout(() => createModalInputRef.current?.focus(), 0);
    // 清理函数：模态框关闭时取消定时器
    return () => window.clearTimeout(id);
  }, [createModal]);

  /**
   * 打开「新建文档」模态框。若传入 explicitParentPath，则固定父路径不可更改。
   */
  function openNewDocumentModal(explicitParentPath?: string): void {
    // 判断是否从上下文菜单传入的固定父路径
    const fixed = explicitParentPath !== undefined;
    // 清空之前的错误提示
    setCreateModalError(null);
    // 设置模态框状态
    setCreateModal({
      kind: "document",
      parentMode: fixed ? "fixed" : "selection",
      parentPath: fixed ? explicitParentPath! : "",
      // 默认文件名为 untitled.md
      draft: "untitled.md",
    });
  }

  /**
   * 打开「新建文件夹」模态框。若传入 explicitParentPath，则固定父路径不可更改。
   */
  function openNewFolderModal(explicitParentPath?: string): void {
    const fixed = explicitParentPath !== undefined;
    setCreateModalError(null);
    setCreateModal({
      kind: "folder",
      parentMode: fixed ? "fixed" : "selection",
      parentPath: fixed ? explicitParentPath! : "",
      // 文件夹默认名为空，让用户自己输入
      draft: "",
    });
  }

  /**
   * 提交新建表单：验证输入 → 查重 → 调用创建接口 → 刷新树 → 打开新文档。
   */
  async function submitCreateModal(e: React.FormEvent): Promise<void> {
    // 阻止表单默认提交行为（页面刷新）
    e.preventDefault();
    // 如果模态框已关闭，不处理
    if (!createModal) return;
    // 标记提交中，禁用按钮
    setCreateModalBusy(true);
    // 清空之前的错误
    setCreateModalError(null);
    // 收集树中所有已存在的路径，用于查重
    const paths = collectDocumentPaths(tree);
    // 确定实际父路径：
    // - "selection" 模式使用侧边栏当前选中的父路径
    // - "fixed" 模式使用模态框中固定的父路径（来自上下文菜单）
    const effectiveParent =
      createModal.parentMode === "selection" ? selectedCreateParentPath : createModal.parentPath;
    try {
      // ========== 新建文档逻辑 ==========
      if (createModal.kind === "document") {
        // 解析用户输入的文件名，验证格式并规范化
        const fileParsed = parseDisplayNameMarkdownFile(createModal.draft);
        if (!fileParsed.ok) {
          // 文件名不合法，显示错误
          setCreateModalError(translateStorageError(t, fileParsed.message));
          return;
        }
        // 获取规范化后的文件名（含 .md 后缀）
        const displayFile = fileParsed.displayFile;
        // 去掉 .md 后缀作为文档标题
        const displayTitle = displayFile.replace(/\.md$/i, "");
        let relativePath: string;
        try {
          // 拼接父路径和文件名，然后规范化为存储路径
          relativePath = normaliseRelativePathForStorage(joinDocPath(effectiveParent, displayFile));
        } catch (e) {
          setCreateModalError(translateError(t, e));
          return;
        }
        // 检查路径是否已存在
        if (paths.has(relativePath)) {
          setCreateModalError(t("pathExists"));
          return;
        }
        // 调用后端 API 创建文档
        const parentId = effectiveParent ? findFolderIdByPath(tree, effectiveParent) : undefined;
        const doc = await createDocumentApi({
          relativePath,
          displayName: displayTitle,
          // 默认内容为一个 h1 标题
          content: buildLexicalJsonHeading(displayTitle),
          domainId: currentDomainId,
          parentId,
        });
        // 刷新侧边栏文档树
        await refreshTree();
        // 通知父组件文档已创建，打开编辑器
        onDocCreated(doc);
        // 关闭模态框
        setCreateModal(null);
        return;
      }

      // ========== 新建文件夹逻辑 ==========
      // 解析用户输入的文件夹名，验证格式
      const parsed = parseDisplayNameFolder(createModal.draft);
      if (!parsed.ok) {
        setCreateModalError(translateStorageError(t, parsed.message));
        return;
      }
      // 规范化文件夹名称（空格转下划线等）
      const storageSeg = normalisePathSegmentForStorage(parsed.display);
      if (!storageSeg) {
        setCreateModalError(t("invalidFolderName"));
        return;
      }

      // 查重：检查树中是否已有同名路径
      const folderPath = joinDocPath(effectiveParent, storageSeg);
      if (paths.has(folderPath)) {
        setCreateModalError(t("folderExists"));
        return;
      }

      // 调用独立的创建目录接口
      await createFolderApi({
        name: storageSeg,
        parentId: effectiveParent || undefined,
        domainId: currentDomainId,
      });

      // 刷新文档树
      await refreshTree();
      // 关闭模态框（文件夹没有文档 ID，不需要打开编辑器）
      setCreateModal(null);
    } catch (err) {
      // 创建失败（如网络错误、权限不足），显示错误提示
      setCreateModalError(translateError(t, err));
    } finally {
      // 无论成功失败，都要关闭提交中状态
      setCreateModalBusy(false);
    }
  }

  // 返回模态框相关的状态和方法
  return {
    createModal,
    setCreateModal,
    createModalError,
    createModalBusy,
    createModalInputRef,
    openNewDocumentModal,
    openNewFolderModal,
    submitCreateModal,
  };
}
