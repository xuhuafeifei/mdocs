import { useEffect, useRef, useState } from "react";
import type { DocumentDetail } from "../../../shared/types/document";
import type { TreeNode } from "../../../shared/types/tree";
import type { TranslationKey } from "../../i18n/types";
import { DocPathError, normaliseDocRelativePath } from "../../../shared/docPath";
import {
  normalisePathSegmentForStorage,
  normaliseRelativePathForStorage,
  parseDisplayNameFolder,
  parseDisplayNameMarkdownFile,
} from "../../../shared/storagePath";
import { FOLDER_DESC_FILENAME, folderDescPathForFolder } from "../../../shared/folderDesc";
import { stripDomainPathPrefix } from "../../../shared/personalDomain";
import { getStoredVisitorId, ApiRequestError } from "../../services/client";
import { createDocumentApi } from "../../services/endpoints";
import { ERROR_CODE_MAP, PATH_ERROR_MESSAGE_MAP, STORAGE_ERROR_MESSAGE_MAP } from "../../i18n/errors";

export type CreateModalState =
  | { kind: "document"; parentMode: "selection" | "fixed"; parentPath: string; draft: string }
  | { kind: "folder"; parentMode: "selection" | "fixed"; parentPath: string; draft: string };

function joinDocPath(parentPath: string, fileName: string): string {
  const p = parentPath.trim();
  const f = fileName.trim();
  if (!f) return p;
  return p ? `${p}/${f}` : f;
}

function parentDirForCreates(relativePath: string): string {
  const i = relativePath.lastIndexOf("/");
  return i === -1 ? "" : relativePath.slice(0, i);
}

function docPathForSelection(doc: DocumentDetail): string {
  const vid = getStoredVisitorId();
  if (!vid || doc.domainId !== vid) return doc.relativePath;
  return stripDomainPathPrefix(vid, doc.relativePath);
}

function collectDocumentPaths(nodes: TreeNode[], out = new Set<string>()): Set<string> {
  for (const n of nodes) {
    if (n.type === "document") out.add(n.path);
    else {
      if (n.descDocumentId) out.add(folderDescPathForFolder(n.path));
      collectDocumentPaths(n.children, out);
    }
  }
  return out;
}

function translateError(t: (k: TranslationKey, vars?: Record<string, string>) => string, err: unknown): string {
  if (err instanceof ApiRequestError) {
    const key = ERROR_CODE_MAP[err.code];
    if (key) return t(key);
    return err.message;
  }
  if (err instanceof DocPathError) {
    const key = PATH_ERROR_MESSAGE_MAP[err.message];
    if (key) return t(key);
    return err.message;
  }
  if (err instanceof Error) {
    const key = PATH_ERROR_MESSAGE_MAP[err.message] ?? STORAGE_ERROR_MESSAGE_MAP[err.message];
    if (key) return t(key);
    return err.message;
  }
  return String(err);
}

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
  const [createModal, setCreateModal] = useState<CreateModalState | null>(null);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [createModalBusy, setCreateModalBusy] = useState(false);
  const createModalInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!createModal) return;
    const id = window.setTimeout(() => createModalInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [createModal]);

  function openNewDocumentModal(explicitParentPath?: string): void {
    const fixed = explicitParentPath !== undefined;
    setCreateModalError(null);
    setCreateModal({
      kind: "document",
      parentMode: fixed ? "fixed" : "selection",
      parentPath: fixed ? explicitParentPath! : "",
      draft: "untitled.md",
    });
  }

  function openNewFolderModal(explicitParentPath?: string): void {
    const fixed = explicitParentPath !== undefined;
    setCreateModalError(null);
    setCreateModal({
      kind: "folder",
      parentMode: fixed ? "fixed" : "selection",
      parentPath: fixed ? explicitParentPath! : "",
      draft: "",
    });
  }

  async function submitCreateModal(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!createModal) return;
    setCreateModalBusy(true);
    setCreateModalError(null);
    const paths = collectDocumentPaths(tree);
    const effectiveParent =
      createModal.parentMode === "selection" ? selectedCreateParentPath : createModal.parentPath;
    try {
      if (createModal.kind === "document") {
        const fileParsed = parseDisplayNameMarkdownFile(createModal.draft);
        if (!fileParsed.ok) {
          setCreateModalError(translateStorageError(t, fileParsed.message));
          return;
        }
        const displayFile = fileParsed.displayFile;
        const displayTitle = displayFile.replace(/\.md$/i, "");
        let relativePath: string;
        try {
          relativePath = normaliseRelativePathForStorage(joinDocPath(effectiveParent, displayFile));
        } catch (e) {
          setCreateModalError(translateError(t, e));
          return;
        }
        if (paths.has(relativePath)) {
          setCreateModalError(t("pathExists"));
          return;
        }
        const doc = await createDocumentApi({
          relativePath,
          displayName: displayTitle,
          content: `# ${displayTitle}\n\n`,
          domainId: currentDomainId,
        });
        await refreshTree();
        onDocCreated(doc);
        setCreateModal(null);
        return;
      }
      const parsed = parseDisplayNameFolder(createModal.draft);
      if (!parsed.ok) {
        setCreateModalError(translateStorageError(t, parsed.message));
        return;
      }
      const storageSeg = normalisePathSegmentForStorage(parsed.display);
      if (!storageSeg) {
        setCreateModalError(t("invalidFolderName"));
        return;
      }
      const folderPrefix = joinDocPath(effectiveParent, storageSeg);
      let relativePath: string;
      try {
        relativePath = normaliseRelativePathForStorage(joinDocPath(folderPrefix, FOLDER_DESC_FILENAME));
      } catch (e) {
        setCreateModalError(translateError(t, e));
        return;
      }
      if (paths.has(relativePath)) {
        setCreateModalError(t("folderExists"));
        return;
      }
      const folderTitle = parsed.display;
      const doc = await createDocumentApi({
        relativePath,
        displayName: folderTitle,
        content: `# ${folderTitle}\n\n`,
        domainId: currentDomainId,
      });
      await refreshTree();
      onDocCreated(doc);
      setCreateModal(null);
    } catch (err) {
      setCreateModalError(translateError(t, err));
    } finally {
      setCreateModalBusy(false);
    }
  }

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
