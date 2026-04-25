import { useState } from "react";
import type {
  TreeFolderNode,
  TreeNode,
} from "../../shared/types/tree";

export interface TreeContextMenu {
  x: number;
  y: number;
  node: TreeNode;
  parentPath: string;
}

export function DocumentTree(props: {
  nodes: TreeNode[];
  activeDocumentId: string | null;
  /** Folder path used as default parent for “New document” / “New folder” from the sidebar. */
  selectedParentPath: string;
  onOpen: (node: Extract<TreeNode, { type: "document" }>) => void;
  onOpenFolder: (folderPath: string, descDocumentId: string | null | undefined) => void;
  onContextMenu: (payload: TreeContextMenu) => void;
}) {
  if (props.nodes.length === 0) {
    return (
      <div className="mdocs-sidebar-list">
        <div className="muted" style={{ padding: "8px 10px", fontSize: 12 }}>
          no documents yet
        </div>
      </div>
    );
  }
  return (
    <div
      className="mdocs-sidebar-list"
      onContextMenu={(e) => {
        e.preventDefault();
        props.onContextMenu({
          x: e.clientX,
          y: e.clientY,
          node: { type: "folder", name: "", path: "", children: props.nodes },
          parentPath: "",
        });
      }}
    >
      {props.nodes.map((n) => (
        <TreeNodeView
          key={n.path}
          node={n}
          depth={0}
          parentPath=""
          activeDocumentId={props.activeDocumentId}
          selectedParentPath={props.selectedParentPath}
          onOpen={props.onOpen}
          onOpenFolder={props.onOpenFolder}
          onContextMenu={props.onContextMenu}
        />
      ))}
    </div>
  );
}

function TreeNodeView(props: {
  node: TreeNode;
  depth: number;
  parentPath: string;
  activeDocumentId: string | null;
  selectedParentPath: string;
  onOpen: (node: Extract<TreeNode, { type: "document" }>) => void;
  onOpenFolder: (folderPath: string, descDocumentId: string | null | undefined) => void;
  onContextMenu: (payload: TreeContextMenu) => void;
}) {
  const indent = { paddingLeft: 8 + props.depth * 16 };
  if (props.node.type === "folder") {
    return (
      <FolderRow
        folder={props.node}
        depth={props.depth}
        activeDocumentId={props.activeDocumentId}
        selectedParentPath={props.selectedParentPath}
        onOpen={props.onOpen}
        onOpenFolder={props.onOpenFolder}
        onContextMenu={props.onContextMenu}
        indent={indent}
      />
    );
  }
  const doc = props.node;
  const isActive = doc.documentId === props.activeDocumentId;
  return (
    <button
      type="button"
      className={"mdocs-tree-row mdocs-tree-doc" + (isActive ? " active" : "")}
      style={indent}
      onClick={() => props.onOpen(doc)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onContextMenu({
          x: e.clientX,
          y: e.clientY,
          node: doc,
          parentPath: props.parentPath,
        });
      }}
    >
      <span className="mdocs-tree-caret-spacer" aria-hidden />
      <span className="mdocs-tree-icon">md</span>
      <span className="mdocs-tree-label">{doc.displayName || doc.name}</span>
    </button>
  );
}

function FolderDirIcon() {
  return (
    <span className="mdocs-tree-icon mdocs-tree-icon-dir" aria-hidden>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M2 4.5h4.2L7.3 6H14v8.5H2V4.5z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M2 4.5V3h4l1.1 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function FolderRow(props: {
  folder: TreeFolderNode;
  depth: number;
  activeDocumentId: string | null;
  selectedParentPath: string;
  onOpen: (node: Extract<TreeNode, { type: "document" }>) => void;
  onOpenFolder: (folderPath: string, descDocumentId: string | null | undefined) => void;
  onContextMenu: (payload: TreeContextMenu) => void;
  indent: React.CSSProperties;
}) {
  const [open, setOpen] = useState(props.depth < 1);
  const isActive =
    Boolean(props.folder.descDocumentId) && props.folder.descDocumentId === props.activeDocumentId;
  const isSelectTarget = props.selectedParentPath === props.folder.path;
  function activateFolder(): void {
    props.onOpenFolder(props.folder.path, props.folder.descDocumentId);
  }
  return (
    <div>
      <div
        className={
          "mdocs-tree-row mdocs-tree-folder mdocs-tree-folder-row" +
          (isActive ? " active" : isSelectTarget ? " mdocs-tree-select-target" : "")
        }
        style={props.indent}
        onClick={activateFolder}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onContextMenu({
            x: e.clientX,
            y: e.clientY,
            node: props.folder,
            parentPath: props.folder.path,
          });
        }}
      >
        <span
          className="mdocs-tree-caret"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={open ? "Collapse folder" : "Expand folder"}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
            activateFolder();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((v) => !v);
              activateFolder();
            }
          }}
        >
          {open ? "▾" : "▸"}
        </span>
        <FolderDirIcon />
        <span className="mdocs-tree-folder-select">
          <span className="mdocs-tree-label">
            {props.folder.folderDisplayName?.trim() || props.folder.name}
          </span>
        </span>
      </div>
      {open &&
        props.folder.children.map((child) => (
          <TreeNodeView
            key={child.path}
            node={child}
            depth={props.depth + 1}
            parentPath={props.folder.path}
            activeDocumentId={props.activeDocumentId}
            selectedParentPath={props.selectedParentPath}
            onOpen={props.onOpen}
            onOpenFolder={props.onOpenFolder}
            onContextMenu={props.onContextMenu}
          />
        ))}
    </div>
  );
}
