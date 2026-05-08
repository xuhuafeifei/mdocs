/**
 * 文档树组件（侧边栏目录）
 * 以递归方式渲染文件夹和文档节点，支持：
 * 1. 点击打开文档/文件夹
 * 2. 右键唤起上下文菜单
 * 3. 文件夹展开/收起
 * 4. 当前激活文档高亮
 */
import { useState } from "react";
import { useI18n } from "../i18n";
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
  /** Folder path used as default parent for "New document" / "New folder" from the sidebar. */
  selectedParentPath: string;
  onOpen: (node: Extract<TreeNode, { type: "document" }>) => void;
  onOpenFolder: (folderPath: string, descDocumentId: string | null | undefined) => void;
  onContextMenu: (payload: TreeContextMenu) => void;
  onDeselect?: () => void;
}) {
  const { t } = useI18n();
  // 如果文档树为空，显示「暂无文档」提示
  if (props.nodes.length === 0) {
    return (
      <div className="mdocs-sidebar-list">
        <div className="muted" style={{ padding: "8px 10px", fontSize: 12 }}>
          {t("noDocumentsYet")}
        </div>
      </div>
    );
  }
  return (
    <div
      className="mdocs-sidebar-list"
      // 点击空白处（非树节点）时取消选中
      onClick={(e) => {
        const target = e.target as HTMLElement;
        // 如果点击的不是树行元素，触发取消选中
        if (!target.closest(".mdocs-tree-row")) {
          props.onDeselect?.();
        }
      }}
      // 在空白处右键时，展示根目录的上下文菜单
      onContextMenu={(e) => {
        // 阻止浏览器默认右键菜单
        e.preventDefault();
        props.onContextMenu({
          x: e.clientX,
          y: e.clientY,
          // 根目录作为一个虚拟的文件夹节点
          node: { type: "folder", name: "", path: "", children: props.nodes },
          parentPath: "",
        });
      }}
    >
      {/* 递归渲染每个顶层节点 */}
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

/**
 * 单个树节点渲染：根据类型分发到文件夹行或文档按钮。
 * 文档节点支持点击打开、右键唤起菜单、激活高亮。
 */
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
  // 根据深度计算左侧缩进像素值（每深一级缩进 16px）
  const indent = { paddingLeft: 8 + props.depth * 16 };
  if (props.node.type === "folder") {
    // 文件夹节点：渲染 FolderRow
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
  // 文档节点：渲染为可点击按钮
  const doc = props.node;
  // 判断是否当前正在编辑的文档（用于高亮显示）
  const isActive = doc.documentId === props.activeDocumentId;
  return (
    <button
      type="button"
      className={"mdocs-tree-row mdocs-tree-doc" + (isActive ? " active" : "")}
      style={indent}
      // 点击打开文档
      onClick={() => props.onOpen(doc)}
      // 右键唤起上下文菜单
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
      {/* 占位符，与文件夹的展开箭头对齐 */}
      <span className="mdocs-tree-caret-spacer" aria-hidden />
      {/* 文档图标 */}
      <span className="mdocs-tree-icon">md</span>
      {/* 显示名称优先，没有则使用文件名 */}
      <span className="mdocs-tree-label">{doc.displayName || doc.name}</span>
    </button>
  );
}

/**
 * 文件夹 SVG 图标组件。
 */
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

/**
 * 文件夹行组件：展示文件夹名称、展开/收起按钮、激活/选中状态。
 * 点击文件夹本身会激活该文件夹并打开其描述文档（如有）。
 */
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
  const { t } = useI18n();
  // 默认展开第一层文件夹（depth < 1），更深层的默认收起
  const [open, setOpen] = useState(props.depth < 1);
  // 判断该文件夹的描述文档是否正在编辑（用于高亮）
  const isActive =
    Boolean(props.folder.descDocumentId) && props.folder.descDocumentId === props.activeDocumentId;
  // 判断当前新建操作是否以此文件夹为父路径（用于选中样式）
  const isSelectTarget = props.selectedParentPath === props.folder.path;

  /**
   * 激活文件夹：通知父组件打开该文件夹及其描述文档。
   */
  function activateFolder(): void {
    props.onOpenFolder(props.folder.path, props.folder.descDocumentId);
  }

  return (
    <div>
      {/* 文件夹行：可点击、可右键 */}
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
        {/* 展开/收起箭头按钮 */}
        <span
          className="mdocs-tree-caret"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={open ? t("collapseFolder") : t("expandFolder")}
          // 点击箭头时切换展开状态，同时激活文件夹
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
            activateFolder();
          }}
          onKeyDown={(e) => {
            // 支持键盘操作（Enter/Space 切换展开）
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((v) => !v);
              activateFolder();
            }
          }}
        >
          {open ? "▾" : "▸"}
        </span>
        {/* 文件夹图标 */}
        <FolderDirIcon />
        {/* 文件夹名称：优先显示 folderDisplayName，没有则使用 path */}
        <span className="mdocs-tree-folder-select">
          <span className="mdocs-tree-label">
            {props.folder.folderDisplayName?.trim() || props.folder.name}
          </span>
        </span>
      </div>
      {/* 展开状态下递归渲染子节点 */}
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
