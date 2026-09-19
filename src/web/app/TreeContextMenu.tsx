/**
 * 文档树右键上下文菜单
 * 在侧边栏树节点上右键时弹出，支持：
 * 1. 在当前位置新建文档
 * 2. 删除文档（文件夹不可删除）
 * 4. 复制 documentId
 * 5. 复制页面 URL
 * 点击外部或按 Escape 自动关闭。
 */
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import type { TreeNode } from "../../shared/types/tree";
import { copyTextToClipboard } from "./copyText";

export function TreeContextMenu(props: {
  x: number;
  y: number;
  node: TreeNode;
  parentPath: string;
  onClose: () => void;
  onCreateChild: (parentPath: string) => void;
  onDeleteDocument: (node: Extract<TreeNode, { type: "document" }>) => void;
  onDeleteFolder: (node: Extract<TreeNode, { type: "folder" }>) => void;
}) {
  const { t } = useI18n();

  // ---- 菜单 DOM 引用 ----
  const ref = useRef<HTMLDivElement | null>(null);

  /**
   * 点击菜单外部或按 Escape 时关闭上下文菜单。
   */
  useEffect(() => {
    function handle(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        props.onClose();
      }
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

  const isFolder = props.node.type === "folder";

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

  return (
    <div
      ref={ref}
      className="mdocs-context-menu card"
      style={{ left: props.x, top: props.y }}
    >
      <button
        type="button"
        className="mdocs-context-item"
        onClick={() => {
          const parent = isFolder ? props.node.path : props.parentPath;
          props.onCreateChild(parent);
          props.onClose();
        }}
      >
        {createLabel}
      </button>
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
}
