import { useEffect, useRef, useState } from "react";
import type { IEditor } from "@lobehub/editor";
import { saveDraft, deleteDraft, getDraft } from "../../storage/drafts";

interface UseAutoSaveOptions {
  editor: IEditor | null;
  documentId: string;
  displayName: string;
  enabled: boolean;
  debounceMs?: number;
}

export function useAutoSave({ editor, documentId, displayName, enabled, debounceMs = 2000 }: UseAutoSaveOptions) {
  const [isDirty, setIsDirty] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Tracks whether the IndexedDB draft matches the current editor content.
  // Set to true when a save occurs (auto/manual), false when content changes.
  const draftCurrentRef = useRef(false);

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
      setIsDirty(true);
      draftCurrentRef.current = false; // content changed, draft is now stale
      // console.log("[autoSave] set isDirty=true, enabled=", enabled, "draftExists=", draftExists, "draftCurrent=false");
      if (!enabled) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const content = (editor.getDocument("markdown") as string).trimEnd();
          await saveDraft({
            documentId,
            content,
            displayName,
            updatedAt: Date.now(),
            published: false,
          });
          setDraftExists(true);
          setLastSavedAt(Date.now());
          draftCurrentRef.current = true; // draft now matches current content
          // console.log("[autoSave] draft saved, draftCurrent=true");
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
  }, [editor, documentId, displayName, enabled, debounceMs]);

  async function clearDraft(): Promise<void> {
    await deleteDraft(documentId);
    setDraftExists(false);
    setIsDirty(false);
    draftCurrentRef.current = false;
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
    setLastSavedAt(Date.now());
    draftCurrentRef.current = true;
  }

  return { isDirty, draftExists, lastSavedAt, clearDraft, loadDraftContent, markDraftSaved, draftCurrentRef };
}
