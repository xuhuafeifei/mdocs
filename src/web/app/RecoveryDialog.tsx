/**
 * 草稿恢复弹窗
 * 当草稿发布失败（服务端文档已不存在）时，用户可将其另存为一篇全新文档。
 * 复用 DomainSelect + DocumentTree 组件，避免重复实现。
 */
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { DomainSelect } from "./DomainSelect";
import { DocumentTree } from "./DocumentTree";
import type { TreeNode } from "../../shared/types/tree";
import type { DomainSummary } from "../../shared/types/domain";
import { fetchDomainsSafe } from "../services/domainsBootstrap";
import { fetchTreeApi, createDocumentApi } from "../services/endpoints";
import { localizeDomainName, translateError, parentDirForCreates } from "./utils";

interface RecoveryDialogProps {
  draft: { documentId: string; displayName: string; content: string; domainId?: string };
  onClose: () => void;
  onSuccess: () => void;
}

export function RecoveryDialog({ draft, onClose, onSuccess }: RecoveryDialogProps) {
  const { t, lang } = useI18n();

  // ---- 域列表 ----
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  // ---- 当前选中的域 ----
  const [selectedDomainId, setSelectedDomainId] = useState(draft.domainId ?? "");
  // ---- 当前域的树 ----
  const [tree, setTree] = useState<TreeNode[]>([]);
  // ---- 用户选中的父路径（空 = 根目录） ----
  const [selectedParentPath, setSelectedParentPath] = useState("");
  // ---- 文件名输入 ----
  const [fileName, setFileName] = useState(`${draft.displayName || "untitled"}_recovered.md`);
  // ---- 提交中 / 错误 ----
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- 输入框引用 ----
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 组件挂载状态跟踪，防止卸载后 async setState
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    void fetchDomainsSafe().then((data) => {
      if (mountedRef.current) setDomains(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedDomainId) return;
    // 切换域时清空选中路径和树
    setTree([]);
    setSelectedParentPath("");
    void fetchTreeApi(selectedDomainId).then((data) => {
      if (mountedRef.current) setTree(data);
    }).catch(() => {
      if (mountedRef.current) setTree([]);
    });
  }, [selectedDomainId]);

  // 弹窗打开后自动聚焦文件名输入
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  // 按 Escape 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /**
   * 根据路径递归查找父文件夹节点，返回其 documentId（供创建时传 parentId）。
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    // 规范化文件名（空格 → 下划线）
    const normalisedName = fileName
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_\-.]/g, "");

    // 确保 .md 后缀
    const displayName = normalisedName.endsWith(".md") ? normalisedName : normalisedName + ".md";
    const displayTitle = displayName.replace(/\.md$/i, "");

    try {
      // 拼接完整相对路径
      const relativePath = selectedParentPath
        ? `${selectedParentPath}/${displayName}`
        : displayName;

      const parentId = selectedParentPath
        ? (findFolderIdByPath(tree, selectedParentPath) ?? undefined)
        : undefined;

      await createDocumentApi({
        fileName: displayName,
        displayName: displayTitle,
        content: draft.content,
        domainId: selectedDomainId,
        parentId,
      });

      // 成功后通知父组件（父组件负责清除草稿、刷新树）
      onSuccess();
    } catch (err) {
      setError(translateError(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mdocs-dialog-backdrop" role="presentation" onMouseDown={(ev) => { if (ev.target === ev.currentTarget && !busy) onClose(); }}>
      <div className="mdocs-dialog card mdocs-recovery-dialog" role="dialog" aria-modal="true">
        <h1>{t("recoverDraft")}</h1>
        <p className="muted">{t("recoverDraftDesc", { name: draft.displayName || t("unknownTitle") })}</p>

        <form onSubmit={handleCreate} className="mdocs-dialog-form">
          {/* 域选择 */}
          <label className="mdocs-dialog-label">
            {t("domainLabel")}
            {domains.length > 0 && (
              <DomainSelect
                domains={domains}
                value={selectedDomainId}
                onChange={setSelectedDomainId}
                ariaLabel={t("domainLabel")}
                localizeName={(name: string) => localizeDomainName(name, lang, t)}
              />
            )}
          </label>

          {/* 目录树 */}
          <label className="mdocs-dialog-label mdocs-recovery-tree-label">
            {t("recoverTargetFolder")}
            <div className="mdocs-recovery-tree">
              <DocumentTree
                nodes={tree}
                activeDocumentId={null}
                selectedParentPath={selectedParentPath}
                onOpen={() => {}}
                onOpenFolder={(folderPath) => setSelectedParentPath(folderPath)}
                onContextMenu={() => {}}
                onDeselect={() => setSelectedParentPath("")}
              />
            </div>
          </label>

          {/* 文件名输入 */}
          <label className="mdocs-dialog-label">
            {t("fileNameLabel")}
            <input
              ref={inputRef}
              value={fileName}
              onChange={(ev) => setFileName(ev.target.value)}
              placeholder="recovered.md"
              maxLength={200}
              disabled={busy}
            />
          </label>

          {error && <div className="mdocs-dialog-error">{error}</div>}

          <div className="mdocs-dialog-actions">
            <button type="button" onClick={() => !busy && onClose()} disabled={busy}>
              {t("cancel")}
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? t("creating") : t("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
