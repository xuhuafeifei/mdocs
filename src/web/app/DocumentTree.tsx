/**
 * 文档树组件（侧边栏目录）
 * 以递归方式渲染文件夹和文档节点，支持：
 * 1. 点击打开文档/文件夹
 * 2. 右键唤起上下文菜单
 * 3. 文件夹展开/收起
 * 4. 当前激活文档高亮
 * 5. 拖拽文档到文件夹 / 同目录文章 / 域根（成败由后端决定）
 *
 * DnD 注意：dragover 阶段多数浏览器不暴露自定义 MIME / getData，
 * 因此用模块级 dragSession，在 dragover 里仅凭「是否在拖本树文档」决定 preventDefault。
 * drop 高亮由树根统一 state 管理，dragEnd / drop 时一律清空，避免残留。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type {
  TreeFolderNode,
  TreeNode,
} from "../../shared/types/tree";

const DND_MIME = "application/x-mdocs-document-id";
const DND_TEXT_PREFIX = "mdocs-doc:";

/** 当前正在拖的文档；dragover 阶段无法可靠读 dataTransfer，靠这个放行 drop。 */
let dragSessionDocumentId: string | null = null;

type DropHighlight =
  | null
  | { kind: "root" }
  | { kind: "folder"; id: string }
  | { kind: "doc"; id: string };

/** 在树中定位激活文档：需展开的祖先文件夹 + 滚动锚点（documentId 或 folder.documentId） */
function findRevealTarget(
  nodes: TreeNode[],
  targetId: string,
  ancestors: string[] = [],
): { forceOpenFolderIds: string[]; scrollTreeId: string } | null {
  for (const n of nodes) {
    if (n.type === "document") {
      if (n.documentId === targetId) {
        return { forceOpenFolderIds: ancestors, scrollTreeId: n.documentId };
      }
      continue;
    }
    if (n.descDocumentId === targetId) {
      return { forceOpenFolderIds: ancestors, scrollTreeId: n.documentId };
    }
    const hit = findRevealTarget(n.children, targetId, [...ancestors, n.documentId]);
    if (hit) return hit;
  }
  return null;
}

function readDraggedDocumentId(dt: DataTransfer): string {
  if (dragSessionDocumentId) return dragSessionDocumentId;
  try {
    const typed = dt.getData(DND_MIME);
    if (typed) return typed;
    const plain = dt.getData("text/plain") || dt.getData("Text");
    if (plain.startsWith(DND_TEXT_PREFIX)) return plain.slice(DND_TEXT_PREFIX.length);
  } catch {
    // ignore
  }
  return "";
}

function isOurDocDrag(onMoveDocument: unknown): boolean {
  return Boolean(onMoveDocument && dragSessionDocumentId);
}

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
  /** 将文档移到目标文件夹；parentId=null 表示域根。 */
  onMoveDocument?: (documentId: string, parentId: string | null) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const [dropHighlight, setDropHighlight] = useState<DropHighlight>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const reveal = useMemo(() => {
    const id = props.activeDocumentId?.trim();
    if (!id) return null;
    return findRevealTarget(props.nodes, id);
  }, [props.nodes, props.activeDocumentId]);

  const forceOpenFolderIds = useMemo(
    () => new Set(reveal?.forceOpenFolderIds ?? []),
    [reveal],
  );

  useEffect(() => {
    if (!reveal?.scrollTreeId) return;
    const treeId = reveal.scrollTreeId;
    const scroll = () => {
      const el = listRef.current?.querySelector(
        `[data-tree-id="${CSS.escape(treeId)}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    // 等强制展开的文件夹先渲染子节点
    const t1 = requestAnimationFrame(() => {
      requestAnimationFrame(scroll);
    });
    return () => cancelAnimationFrame(t1);
  }, [reveal?.scrollTreeId, forceOpenFolderIds, props.nodes]);


  function clearDropHighlight(): void {
    setDropHighlight(null);
  }

  function endDragSession(): void {
    dragSessionDocumentId = null;
    setDraggingId(null);
    clearDropHighlight();
  }

  function beginDragSession(documentId: string): void {
    dragSessionDocumentId = documentId;
    setDraggingId(documentId);
    clearDropHighlight();
  }

  function handleRootDragOver(e: React.DragEvent): void {
    if (!isOurDocDrag(props.onMoveDocument)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const overRow = (e.target as HTMLElement).closest(".mdocs-tree-row");
    if (!overRow) setDropHighlight({ kind: "root" });
  }

  function handleRootDragLeave(e: React.DragEvent): void {
    // 只有真正离开整棵树时才清 root 高亮
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDropHighlight((h) => (h?.kind === "root" ? null : h));
  }

  function handleRootDrop(e: React.DragEvent): void {
    if (!props.onMoveDocument || !isOurDocDrag(props.onMoveDocument)) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const overRow = target.closest(".mdocs-tree-row");
    const documentId = readDraggedDocumentId(e.dataTransfer);
    endDragSession();
    if (overRow) return;
    if (documentId) void props.onMoveDocument(documentId, null);
  }

  const listClass =
    "mdocs-sidebar-list" + (dropHighlight?.kind === "root" ? " mdocs-tree-drop-root" : "");

  if (props.nodes.length === 0) {
    return (
      <div
        ref={listRef}
        className={listClass}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        <div className="muted" style={{ padding: "8px 10px", fontSize: 12 }}>
          {t("noDocumentsYet")}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={listClass}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".mdocs-tree-row")) {
          props.onDeselect?.();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        props.onContextMenu({
          x: e.clientX,
          y: e.clientY,
          node: {
            type: "folder",
            name: "",
            path: "",
            documentId: "",
            children: props.nodes,
          },
          parentPath: "",
        });
      }}
      onDragOver={handleRootDragOver}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
    >
      {props.nodes.map((n) => (
        <TreeNodeView
          key={n.path}
          node={n}
          depth={0}
          parentPath=""
          parentFolderId={null}
          activeDocumentId={props.activeDocumentId}
          selectedParentPath={props.selectedParentPath}
          forceOpenFolderIds={forceOpenFolderIds}
          dropHighlight={dropHighlight}
          setDropHighlight={setDropHighlight}
          clearDropHighlight={clearDropHighlight}
          beginDragSession={beginDragSession}
          endDragSession={endDragSession}
          draggingId={draggingId}
          onOpen={props.onOpen}
          onOpenFolder={props.onOpenFolder}
          onContextMenu={props.onContextMenu}
          onMoveDocument={props.onMoveDocument}
        />
      ))}
    </div>
  );
}

type TreeShared = {
  activeDocumentId: string | null;
  selectedParentPath: string;
  forceOpenFolderIds: Set<string>;
  dropHighlight: DropHighlight;
  setDropHighlight: (h: DropHighlight) => void;
  clearDropHighlight: () => void;
  beginDragSession: (documentId: string) => void;
  endDragSession: () => void;
  draggingId: string | null;
  onOpen: (node: Extract<TreeNode, { type: "document" }>) => void;
  onOpenFolder: (folderPath: string, descDocumentId: string | null | undefined) => void;
  onContextMenu: (payload: TreeContextMenu) => void;
  onMoveDocument?: (documentId: string, parentId: string | null) => void | Promise<void>;
};

function TreeNodeView(
  props: TreeShared & {
    node: TreeNode;
    depth: number;
    parentPath: string;
    parentFolderId: string | null;
  },
) {
  const indent = { paddingLeft: 8 + props.depth * 16 };
  if (props.node.type === "folder") {
    return (
      <FolderRow
        folder={props.node}
        depth={props.depth}
        indent={indent}
        activeDocumentId={props.activeDocumentId}
        selectedParentPath={props.selectedParentPath}
        forceOpenFolderIds={props.forceOpenFolderIds}
        dropHighlight={props.dropHighlight}
        setDropHighlight={props.setDropHighlight}
        clearDropHighlight={props.clearDropHighlight}
        beginDragSession={props.beginDragSession}
        endDragSession={props.endDragSession}
        draggingId={props.draggingId}
        onOpen={props.onOpen}
        onOpenFolder={props.onOpenFolder}
        onContextMenu={props.onContextMenu}
        onMoveDocument={props.onMoveDocument}
      />
    );
  }
  return (
    <DocRow
      doc={props.node}
      indent={indent}
      parentPath={props.parentPath}
      parentFolderId={props.parentFolderId}
      activeDocumentId={props.activeDocumentId}
      dropHighlight={props.dropHighlight}
      setDropHighlight={props.setDropHighlight}
      clearDropHighlight={props.clearDropHighlight}
      beginDragSession={props.beginDragSession}
      endDragSession={props.endDragSession}
      draggingId={props.draggingId}
      onOpen={props.onOpen}
      onContextMenu={props.onContextMenu}
      onMoveDocument={props.onMoveDocument}
    />
  );
}

function DocRow(props: {
  doc: Extract<TreeNode, { type: "document" }>;
  indent: React.CSSProperties;
  parentPath: string;
  parentFolderId: string | null;
  activeDocumentId: string | null;
  dropHighlight: DropHighlight;
  setDropHighlight: (h: DropHighlight) => void;
  clearDropHighlight: () => void;
  beginDragSession: (documentId: string) => void;
  endDragSession: () => void;
  draggingId: string | null;
  onOpen: (node: Extract<TreeNode, { type: "document" }>) => void;
  onContextMenu: (payload: TreeContextMenu) => void;
  onMoveDocument?: (documentId: string, parentId: string | null) => void | Promise<void>;
}) {
  const doc = props.doc;
  const isActive = doc.documentId === props.activeDocumentId;
  const canDrag = Boolean(props.onMoveDocument);
  const dragging = props.draggingId === doc.documentId;
  const dropActive =
    props.dropHighlight?.kind === "doc" && props.dropHighlight.id === doc.documentId;
  const [suppressClick, setSuppressClick] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      className={
        "mdocs-tree-row mdocs-tree-doc" +
        (isActive ? " active" : "") +
        (dragging ? " mdocs-tree-dragging" : "") +
        (dropActive ? " mdocs-tree-drop-target" : "")
      }
      data-tree-id={doc.documentId}
      style={{ ...props.indent, cursor: canDrag ? "grab" : undefined }}
      draggable={canDrag}
      onDragStart={(e) => {
        if (!props.onMoveDocument) return;
        setSuppressClick(true);
        props.beginDragSession(doc.documentId);
        e.dataTransfer.setData(DND_MIME, doc.documentId);
        e.dataTransfer.setData("text/plain", DND_TEXT_PREFIX + doc.documentId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        props.endDragSession();
        queueMicrotask(() => setSuppressClick(false));
      }}
      onDragEnter={(e) => {
        if (!isOurDocDrag(props.onMoveDocument) || dragSessionDocumentId === doc.documentId) return;
        e.preventDefault();
        e.stopPropagation();
        props.setDropHighlight({ kind: "doc", id: doc.documentId });
      }}
      onDragOver={(e) => {
        if (!isOurDocDrag(props.onMoveDocument) || dragSessionDocumentId === doc.documentId) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        props.setDropHighlight({ kind: "doc", id: doc.documentId });
      }}
      onDrop={(e) => {
        if (!props.onMoveDocument || !isOurDocDrag(props.onMoveDocument)) return;
        e.preventDefault();
        e.stopPropagation();
        const documentId = readDraggedDocumentId(e.dataTransfer);
        const parentId = props.parentFolderId;
        props.endDragSession();
        if (!documentId || documentId === doc.documentId) return;
        void props.onMoveDocument(documentId, parentId);
      }}
      onClick={() => {
        if (suppressClick) return;
        props.onOpen(doc);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onOpen(doc);
        }
      }}
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
    </div>
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
  indent: React.CSSProperties;
  activeDocumentId: string | null;
  selectedParentPath: string;
  forceOpenFolderIds: Set<string>;
  dropHighlight: DropHighlight;
  setDropHighlight: (h: DropHighlight) => void;
  clearDropHighlight: () => void;
  beginDragSession: (documentId: string) => void;
  endDragSession: () => void;
  draggingId: string | null;
  onOpen: (node: Extract<TreeNode, { type: "document" }>) => void;
  onOpenFolder: (folderPath: string, descDocumentId: string | null | undefined) => void;
  onContextMenu: (payload: TreeContextMenu) => void;
  onMoveDocument?: (documentId: string, parentId: string | null) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const forceOpen = props.forceOpenFolderIds.has(props.folder.documentId);
  const [userOpen, setUserOpen] = useState(props.depth < 1 || forceOpen);
  const open = userOpen;

  useEffect(() => {
    if (forceOpen) setUserOpen(true);
  }, [forceOpen, props.activeDocumentId]);

  const isActive =
    Boolean(props.folder.descDocumentId) && props.folder.descDocumentId === props.activeDocumentId;
  const isSelectTarget = props.selectedParentPath === props.folder.path;
  const dropActive =
    props.dropHighlight?.kind === "folder" && props.dropHighlight.id === props.folder.documentId;

  function activateFolder(): void {
    props.onOpenFolder(props.folder.path, props.folder.descDocumentId);
  }

  return (
    <div>
      <div
        className={
          "mdocs-tree-row mdocs-tree-folder mdocs-tree-folder-row" +
          (isActive ? " active" : isSelectTarget ? " mdocs-tree-select-target" : "") +
          (dropActive ? " mdocs-tree-drop-target" : "")
        }
        data-tree-id={props.folder.documentId}
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
        onDragEnter={(e) => {
          if (!isOurDocDrag(props.onMoveDocument)) return;
          e.preventDefault();
          e.stopPropagation();
          props.setDropHighlight({ kind: "folder", id: props.folder.documentId });
          setUserOpen(true);
        }}
        onDragOver={(e) => {
          if (!isOurDocDrag(props.onMoveDocument)) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          props.setDropHighlight({ kind: "folder", id: props.folder.documentId });
        }}
        onDrop={(e) => {
          if (!props.onMoveDocument || !isOurDocDrag(props.onMoveDocument)) return;
          e.preventDefault();
          e.stopPropagation();
          const documentId = readDraggedDocumentId(e.dataTransfer);
          const folderId = props.folder.documentId;
          props.endDragSession();
          if (documentId) void props.onMoveDocument(documentId, folderId);
        }}
      >
        <span
          className="mdocs-tree-caret"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={open ? t("collapseFolder") : t("expandFolder")}
          onClick={(e) => {
            e.stopPropagation();
            setUserOpen((v) => !v);
            activateFolder();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setUserOpen((v) => !v);
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
            parentFolderId={props.folder.documentId}
            activeDocumentId={props.activeDocumentId}
            selectedParentPath={props.selectedParentPath}
            forceOpenFolderIds={props.forceOpenFolderIds}
            dropHighlight={props.dropHighlight}
            setDropHighlight={props.setDropHighlight}
            clearDropHighlight={props.clearDropHighlight}
            beginDragSession={props.beginDragSession}
            endDragSession={props.endDragSession}
            draggingId={props.draggingId}
            onOpen={props.onOpen}
            onOpenFolder={props.onOpenFolder}
            onContextMenu={props.onContextMenu}
            onMoveDocument={props.onMoveDocument}
          />
        ))}
    </div>
  );
}
