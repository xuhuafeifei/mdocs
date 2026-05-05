import { useCallback, useEffect, useRef, useState } from "react";
import type { IEditor } from "@lobehub/editor";
import { saveDraft, deleteDraft, getDraft } from "../../storage/drafts";

interface UseAutoSaveOptions {
  editor: IEditor | null;
  documentId: string;
  displayName: string;
  debounceMs?: number;
  /** Persisted alongside the draft so we can skip the network on re-open. */
  documentMeta?: {
    relativePath: string;
    permission: number;
    ownerVisitorId: string;
    domainId: string;
  };
}

export function useAutoSave({ editor, documentId, displayName, debounceMs = 1000, documentMeta }: UseAutoSaveOptions) {
  const [isDirty, setIsDirty] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Tracks whether the IndexedDB draft matches the current editor content.
  // Set to true when a save occurs (auto/manual), false when content changes.
  const draftCurrentRef = useRef(false);

  // 上次保存/加载时的编辑器内容快照，用于过滤掉 Lexical 的非内容更新（选区、光标移动等）。
  // 存储 markdown 而非 JSON，因为 JSON 包含 Lexical 内部状态（node key 等），
  // 编辑器挂载/初始化时 node key 会重新生成导致 JSON 变化，但文章实际内容没变。
  const lastContentRef = useRef("");

  // Refs for use in event handlers (avoid stale closure)
  const dirtyRef = useRef(false);

  const performSave = useCallback(async () => {
    if (!editor) return;
    // 基线还没初始化（非空 markdown 字符串不会为 falsy），兜底跳过，防止挂载时误写草稿
    if (!lastContentRef.current) {
      console.log("[useAutoSave] performSave blocked: lastContentRef is empty");
      return;
    }
    const jsonContent = JSON.stringify(editor.getDocument("json"));
    console.log("[useAutoSave] performSave saving draft, documentId:", documentId, "content preview:", jsonContent.slice(0, 80));
    await saveDraft({
      documentId,
      content: jsonContent,
      displayName,
      updatedAt: Date.now(),
      published: false,
      ...documentMeta,
    });
    lastContentRef.current = (editor.getDocument("markdown") as string) ?? "";
    setDraftExists(true);
    setIsDirty(false);
    setLastSavedAt(Date.now());
    draftCurrentRef.current = true;
    dirtyRef.current = false;
  }, [editor, documentId, displayName, documentMeta]);

  // Check for existing draft on document change
  useEffect(() => {
    let cancelled = false;
    getDraft(documentId).then((draft) => {
      if (cancelled) return;
      if (draft) {
        setDraftExists(true);
        setLastSavedAt(draft.updatedAt);
        draftCurrentRef.current = true; // draft matches loaded state
      } else {
        setDraftExists(false);
        setLastSavedAt(null);
        draftCurrentRef.current = false;
        dirtyRef.current = false;
      }
    });
    return () => { cancelled = true; };
  }, [documentId]);

  // Listen for editor changes (afterDelay mode)
  useEffect(() => {
    if (!editor) return;
    const lexical = editor.getLexicalEditor();
    if (!lexical) return;

    cleanupRef.current?.();

    // 注册 listener 前立即同步基线为当前编辑器的 markdown 内容。
    // 用 markdown 而非 JSON，避免 Lexical 内部状态抖动（node key 重新生成等）误触发草稿保存。
    lastContentRef.current = editor.getDocument("markdown") ?? "";

    const unregister = lexical.registerUpdateListener(() => {
      const md = (editor.getDocument("markdown") as string) ?? "";
      // 仅在文档文本实际变化时才标记 dirty。忽略选区/光标移动，以及 Lexical 内部状态抖动（node key 重新生成等）
      if (md === lastContentRef.current) return;
      console.log("[useAutoSave] updateListener dirty, documentId:", documentId, "oldLen:", lastContentRef.current.length, "newLen:", md.length);
      lastContentRef.current = md;

      setIsDirty(true);
      dirtyRef.current = true;
      draftCurrentRef.current = false; // content changed, draft is now stale

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        performSave();
      }, debounceMs);
    });

    cleanupRef.current = () => {
      unregister();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    return () => cleanupRef.current?.();
  }, [editor, documentId, displayName, debounceMs, documentMeta, performSave]);

  // Blur save (onFocusChange mode)
  useEffect(() => {
    if (!editor) return;
    const rootElement = editor.getLexicalEditor()?.getRootElement();
    if (!rootElement) return;

    const handleBlur = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (dirtyRef.current) {
        performSave();
      }
    };

    rootElement.addEventListener("blur", handleBlur);
    return () => rootElement.removeEventListener("blur", handleBlur);
  }, [editor, performSave]);

  // Tab switch / refresh / close save
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (dirtyRef.current) {
          performSave();
        }
      }
    };

    const handleBeforeUnload = () => {
      if (dirtyRef.current) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        performSave();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [performSave]);

  async function clearDraft(): Promise<void> {
    await deleteDraft(documentId);
    setDraftExists(false);
    setIsDirty(false);
    dirtyRef.current = false;
    draftCurrentRef.current = false;
    lastContentRef.current = "";
  }

  /** Load draft content if newer than server version */
  async function loadDraftContent(): Promise<string | null> {
    const draft = await getDraft(documentId);
    if (!draft) return null;
    return draft.content;
  }

  /** Call after externally saving a draft (e.g. manual "Save Draft" button) */
  function markDraftSaved(): void {
    setDraftExists(true);
    setIsDirty(false);
    dirtyRef.current = false;
    setLastSavedAt(Date.now());
    draftCurrentRef.current = true;
    if (editor) {
      lastContentRef.current = (editor.getDocument("markdown") as string) ?? "";
    }
  }

  return { isDirty, draftExists, lastSavedAt, clearDraft, loadDraftContent, markDraftSaved };
}
