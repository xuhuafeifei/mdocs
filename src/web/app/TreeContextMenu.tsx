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
  onDelete: (node: Extract<TreeNode, { type: "document" }>) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);

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
  }, [props]);

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
  const folderLabel = isFolder
    ? folderHuman
      ? t("newFolderIn", { name: folderHuman })
      : t("newFolderAtRoot")
    : t("newFolderBeside");

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
      {props.node.type === "document" && (
        <button
          type="button"
          className="mdocs-context-item danger"
          onClick={() => {
            const doc = props.node as Extract<TreeNode, { type: "document" }>;
            props.onDelete(doc);
            props.onClose();
          }}
        >
          {t("deleteItem", { name: props.node.name })}
        </button>
      )}
    </div>
  );
}
