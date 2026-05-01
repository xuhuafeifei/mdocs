import { useEffect, useRef, useState } from "react";
import type { IEditor } from "@lobehub/editor";
import { saveDraft, deleteDraft, getDraft } from "../../storage/drafts";

interface UseAutoSaveOptions {
  editor: IEditor | null;
  documentId: string;
  displayName: string;
  enabled: boolean;
  debounceMs?: number;
  /** Persisted alongside the draft so we can skip the network on re-open. */
  documentMeta?: {
    relativePath: string;
    permission: number;
    ownerVisitorId: string;
    domainId: string;
  };
}

export function useAutoSave({ editor, documentId, displayName, enabled, debounceMs = 2000, documentMeta }: UseAutoSaveOptions) {
  const [isDirty, setIsDirty] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Tracks whether the IndexedDB draft matches the current editor content.
  // Set to true when a save occurs (auto/manual), false when content changes.
  const draftCurrentRef = useRef(false);

  // Snapshot of editor content at last save/load — used to filter out
  // non-content updates (selection/cursor) from the Lexical update listener.
  const lastContentRef = useRef("");

  // Check for existing draft on document change
  useEffect(() => {
    let cancelled = false;
    getDraft(documentId).then((draft) => {
      if (cancelled) return;
      if (draft) {
        setDraftExists(true);
        setLastSavedAt(draft.updatedAt);
        draftCurrentRef.current = true; // draft matches loaded state
        // Normalize: if the stored content is already Lexical JSON, keep it for
        // comparison; if it's legacy markdown, start fresh so the first content
        // change triggers a re-save that upgrades the format.
        let normalized = "";
        try {
          const p = JSON.parse(draft.content);
          if (p?.root?.children) normalized = draft.content;
        } catch {
          // legacy markdown — leave empty, will be upgraded on next save
        }
        lastContentRef.current = normalized;
      } else {
        setDraftExists(false);
        setLastSavedAt(null);
        draftCurrentRef.current = false;
        lastContentRef.current = "";
      }
    });
    return () => { cancelled = true; };
  }, [documentId]);

  // Listen for editor changes
  useEffect(() => {
    if (!editor) return;
    const lexical = editor.getLexicalEditor();
    if (!lexical) return;

    cleanupRef.current?.();
    const unregister = lexical.registerUpdateListener(() => {
      const jsonContent = JSON.stringify(editor.getDocument("json"));
      // Only react when text content actually changed (ignore selection/cursor moves)
      if (jsonContent === lastContentRef.current) return;
      lastContentRef.current = jsonContent;

      setIsDirty(true);
      draftCurrentRef.current = false; // content changed, draft is now stale
      if (!enabled) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const jsonContent = JSON.stringify(editor.getDocument("json"));
          await saveDraft({
            documentId,
            content: jsonContent,
            displayName,
            updatedAt: Date.now(),
            published: false,
            ...documentMeta,
          });
          lastContentRef.current = jsonContent;
          setDraftExists(true);
          setIsDirty(false);
          setLastSavedAt(Date.now());
          draftCurrentRef.current = true; // draft now matches current content
        } catch (err) {
          console.error("mdocs auto-save failed", err);
        }
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
  }, [editor, documentId, displayName, enabled, debounceMs, documentMeta]);

  async function clearDraft(): Promise<void> {
    await deleteDraft(documentId);
    setDraftExists(false);
    setIsDirty(false);
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
    setLastSavedAt(Date.now());
    draftCurrentRef.current = true;
    if (editor) {
      lastContentRef.current = JSON.stringify(editor.getDocument("json"));
    }
  }

  return { isDirty, draftExists, lastSavedAt, clearDraft, loadDraftContent, markDraftSaved, draftCurrentRef };
}
