/**
 * 文档树右键上下文菜单
 * 在侧边栏树节点上右键时弹出，支持：
 * 1. 在当前位置新建文档
 * 2. 在当前位置新建文件夹
 * 3. 删除文档（文件夹不可删除）
 * 点击外部或按 Escape 自动关闭。
 */
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import type { TreeNode } from "../../shared/types/tree";

export function TreeContextMenu(props: {
  x: number;
  y: number;
  node: TreeNode;
  parentPath: string;
  onClose: () => void;
  onCreateChild: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
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
      // 如果点击位置不在菜单内，关闭菜单
      if (ref.current && !ref.current.contains(e.target as Node)) {
        props.onClose();
      }
    }
    function handleKey(e: KeyboardEvent): void {
      // 按 Escape 关闭菜单
      if (e.key === "Escape") props.onClose();
    }
    // 注册全局事件监听
    window.addEventListener("mousedown", handle);
    window.addEventListener("keydown", handleKey);
    // 清理函数：移除监听，防止内存泄漏
    return () => {
      window.removeEventListener("mousedown", handle);
      window.removeEventListener("keydown", handleKey);
    };
  }, [props.onClose]);

  // 判断当前节点类型（文件夹或文档）
  const isFolder = props.node.type === "folder";

  // 获取文件夹的人类可读名称（用于菜单标签）
  let folderHuman = "";
  if (props.node.type === "folder") {
    const f = props.node;
    // 优先使用 folderDisplayName，没有则使用 path
    folderHuman = f.folderDisplayName?.trim() || f.path || "";
  }

  // 根据节点类型和名称生成「新建文档」菜单标签
  const createLabel = isFolder
    ? folderHuman
      ? t("newDocIn", { name: folderHuman })
      : t("newDocAtRoot")
    : t("newDocBeside");

  // 根据节点类型和名称生成「新建文件夹」菜单标签
  const folderLabel = isFolder
    ? folderHuman
      ? t("newFolderIn", { name: folderHuman })
      : t("newFolderAtRoot")
    : t("newFolderBeside");

  return (
    <div
      ref={ref}
      className="mdocs-context-menu card"
      // 使用 fixed 定位，基于鼠标点击位置
      style={{ left: props.x, top: props.y }}
    >
      {/* 新建文档按钮 */}
      <button
        type="button"
        className="mdocs-context-item"
        onClick={() => {
          // 如果是文件夹，在该文件夹下新建；如果是文档，在同级位置新建
          const parent = isFolder ? props.node.path : props.parentPath;
          props.onCreateChild(parent);
          props.onClose();
        }}
      >
        {createLabel}
      </button>
      {/* 新建文件夹按钮 */}
      <button
        type="button"
        className="mdocs-context-item"
        onClick={() => {
          const parent = isFolder ? props.node.path : props.parentPath;
          props.onCreateFolder(parent);
          props.onClose();
        }}
      >
        {folderLabel}
      </button>
      {/* 删除按钮：文档和文件夹均可删除 */}
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
