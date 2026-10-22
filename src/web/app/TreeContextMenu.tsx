/**
 * 文档树右键上下文菜单
 * 在侧边栏树节点上右键时弹出，支持：
 * 1. 在当前位置新建文档（Markdown / HTML / 表格）— 二级子菜单
 * 2. 在当前位置新建目录
 * 3. 删除文档 / 文件夹
 * 4. 复制 documentId
 * 5. 复制页面 URL
 * 点击外部或按 Escape 自动关闭。
 * 贴视口边缘时自动翻转，避免被裁切。
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n";
import type { TreeNode } from "../../shared/types/tree";
import { copyTextToClipboard } from "./copyText";

export type CreateDocFileType = "md" | "html" | "sheet";

const VIEW_MARGIN = 8;

export function TreeContextMenu(props: {
  x: number;
  y: number;
  node: TreeNode;
  parentPath: string;
  onClose: () => void;
  onCreateChild: (parentPath: string, fileType: CreateDocFileType) => void;
  onCreateFolder: (parentPath: string) => void;
  onDeleteDocument: (node: Extract<TreeNode, { type: "document" }>) => void;
  onDeleteFolder: (node: Extract<TreeNode, { type: "folder" }>) => void;
  /** PC：在中间下栏打开该文档 */
  onOpenBelow?: (documentId: string) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const subRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: props.x, top: props.y });
  const [subOpen, setSubOpen] = useState(false);
  /** 子菜单相对主菜单：右/左、上/下 */
  const [subPlacement, setSubPlacement] = useState<{
    side: "right" | "left";
    align: "top" | "bottom";
  }>({ side: "right", align: "top" });

  /**
   * 点击菜单外部或按 Escape 时关闭上下文菜单。
   */
  useEffect(() => {
    function handle(e: MouseEvent): void {
      const t = e.target as Node;
      if (ref.current?.contains(t) || subRef.current?.contains(t)) return;
      props.onClose();
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("mousedown", handle);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handle);
      window.removeEventListener("keydown", handleKey);
    };
  }, [props.onClose]);

  /** 主菜单贴边翻转，避免被视口裁切 */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = props.x;
    let top = props.y;
    if (left + rect.width > vw - VIEW_MARGIN) {
      left = Math.max(VIEW_MARGIN, props.x - rect.width);
    }
    if (top + rect.height > vh - VIEW_MARGIN) {
      top = Math.max(VIEW_MARGIN, props.y - rect.height);
    }
    if (left < VIEW_MARGIN) left = VIEW_MARGIN;
    if (top < VIEW_MARGIN) top = VIEW_MARGIN;
    setPos({ left, top });
  }, [props.x, props.y]);

  /** 子菜单打开后再测一次，决定左右/上下 */
  useLayoutEffect(() => {
    if (!subOpen) return;
    const main = ref.current;
    const sub = subRef.current;
    if (!main || !sub) return;
    const mainRect = main.getBoundingClientRect();
    const subRect = sub.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const side: "right" | "left" =
      mainRect.right + subRect.width + VIEW_MARGIN <= vw ? "right" : "left";
    const align: "top" | "bottom" =
      mainRect.top + subRect.height + VIEW_MARGIN <= vh ? "top" : "bottom";
    setSubPlacement({ side, align });
  }, [subOpen]);

  const isFolder = props.node.type === "folder";
  const parent = isFolder ? props.node.path : props.parentPath;

  let folderHuman = "";
  if (props.node.type === "folder") {
    const f = props.node;
    folderHuman = f.folderDisplayName?.trim() || f.path || "";
  }

  const createLabel = isFolder
    ? folderHuman
      ? t("newDocIn", { name: folderHuman })
      : t("newDocAtRoot")
    : t("newDocBeside");

  const createFolderLabel = isFolder
    ? folderHuman
      ? t("newFolderIn", { name: folderHuman })
      : t("newFolderAtRoot")
    : t("newFolderBeside");

  /** 节点自身的 documentId（文档与文件夹都有） */
  const nodeId = props.node.documentId;
  /**
   * 打开这个节点该用的 id：
   * - 文档 → 自身 id
   * - 文件夹 → 其目录描述文档 `___desc___.md` 的 id（与 App.onOpenFolder 一致）
   */
  const urlDocId =
    props.node.type === "folder"
      ? (props.node.descDocumentId || props.node.documentId)
      : props.node.documentId;

  function createDoc(fileType: CreateDocFileType): void {
    props.onCreateChild(parent, fileType);
    props.onClose();
  }

  const menu = (
    <div
      ref={ref}
      className="mdocs-context-menu card"
      style={{ left: pos.left, top: pos.top }}
      role="menu"
    >
      <div
        className="mdocs-context-submenu-anchor"
        onMouseEnter={() => setSubOpen(true)}
        onMouseLeave={() => setSubOpen(false)}
      >
        <button
          type="button"
          className="mdocs-context-item mdocs-context-item-has-sub"
          aria-haspopup="menu"
          aria-expanded={subOpen}
          onClick={() => setSubOpen((v) => !v)}
        >
          <span className="mdocs-context-item-label">{createLabel}</span>
          <span className="mdocs-context-item-chevron" aria-hidden>
            ›
          </span>
        </button>
        {subOpen ? (
          <div
            ref={subRef}
            className={
              "mdocs-context-submenu card" +
              (subPlacement.side === "left" ? " is-left" : " is-right") +
              (subPlacement.align === "bottom" ? " is-align-bottom" : "")
            }
            role="menu"
          >
            <button
              type="button"
              className="mdocs-context-item"
              role="menuitem"
              onClick={() => createDoc("md")}
            >
              {t("myDocumentsFileTypeMd")}
            </button>
            <button
              type="button"
              className="mdocs-context-item"
              role="menuitem"
              onClick={() => createDoc("html")}
            >
              {t("myDocumentsFileTypeHtml")}
            </button>
            <button
              type="button"
              className="mdocs-context-item"
              role="menuitem"
              onClick={() => createDoc("sheet")}
            >
              {t("myDocumentsFileTypeSheet")}
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="mdocs-context-item"
        onClick={() => {
          props.onCreateFolder(parent);
          props.onClose();
        }}
      >
        {createFolderLabel}
      </button>
      {props.onOpenBelow && props.node.type === "document" ? (
        <button
          type="button"
          className="mdocs-context-item"
          onClick={() => {
            props.onOpenBelow?.(props.node.documentId);
            props.onClose();
          }}
        >
          {t("editorSplitOpenBelow")}
        </button>
      ) : null}
      <div className="mdocs-context-divider" />
      <button
        type="button"
        className="mdocs-context-item"
        onClick={() => {
          void copyTextToClipboard(nodeId).finally(props.onClose);
        }}
      >
        {t("copyDocumentId")}
      </button>
      <button
        type="button"
        className="mdocs-context-item"
        onClick={() => {
          // 与 main.tsx 的规范地址一致：origin + BASE_URL + #/doc/<id>
          const base = import.meta.env.BASE_URL || "/";
          const prefix = base.endsWith("/") ? base : `${base}/`;
          void copyTextToClipboard(
            `${window.location.origin}${prefix}#/doc/${urlDocId}`,
          ).finally(props.onClose);
        }}
      >
        {t("copyDocumentUrl")}
      </button>
      <div className="mdocs-context-divider" />
      <button
        type="button"
        className="mdocs-context-item danger"
        onClick={() => {
          if (props.node.type === "document") {
            props.onDeleteDocument(props.node);
          } else {
            props.onDeleteFolder(props.node);
          }
          props.onClose();
        }}
      >
        {props.node.type === "folder"
          ? t("deleteFolder", { name: folderHuman || props.node.name })
          : t("deleteItem", { name: props.node.name })}
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}
