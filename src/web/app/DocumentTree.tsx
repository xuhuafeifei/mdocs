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
  onOpen: (node: Extract<TreeNode, { type: "document" }>) => void;
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
          onOpen={props.onOpen}
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
  onOpen: (node: Extract<TreeNode, { type: "document" }>) => void;
  onContextMenu: (payload: TreeContextMenu) => void;
}) {
  const indent = { paddingLeft: 8 + props.depth * 14 };
  if (props.node.type === "folder") {
    return (
      <FolderRow
        folder={props.node}
        depth={props.depth}
        parentPath={props.parentPath}
        activeDocumentId={props.activeDocumentId}
        onOpen={props.onOpen}
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
      <span className="mdocs-tree-icon">md</span>
      <span className="mdocs-tree-label">{doc.title || doc.name}</span>
    </button>
  );
}

function FolderRow(props: {
  folder: TreeFolderNode;
  depth: number;
  parentPath: string;
  activeDocumentId: string | null;
  onOpen: (node: Extract<TreeNode, { type: "document" }>) => void;
  onContextMenu: (payload: TreeContextMenu) => void;
  indent: React.CSSProperties;
}) {
  const [open, setOpen] = useState(props.depth < 1);
  return (
    <div>
      <button
        type="button"
        className="mdocs-tree-row mdocs-tree-folder"
        style={props.indent}
        onClick={() => setOpen(!open)}
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
        <span className="mdocs-tree-caret">{open ? "▾" : "▸"}</span>
        <span className="mdocs-tree-label">{props.folder.name}</span>
      </button>
      {open &&
        props.folder.children.map((child) => (
          <TreeNodeView
            key={child.path}
            node={child}
            depth={props.depth + 1}
            parentPath={props.folder.path}
            activeDocumentId={props.activeDocumentId}
            onOpen={props.onOpen}
            onContextMenu={props.onContextMenu}
          />
        ))}
    </div>
  );
}
