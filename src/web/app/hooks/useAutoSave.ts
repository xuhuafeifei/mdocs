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

  // Check for existing draft on document change
  useEffect(() => {
    let cancelled = false;
    getDraft(documentId).then((draft) => {
      if (cancelled) return;
      if (draft) {
        setDraftExists(true);
        setLastSavedAt(draft.updatedAt);
      } else {
        setDraftExists(false);
        setLastSavedAt(null);
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
      if (!enabled) return;
      setIsDirty(true);

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
        } catch {
          // IndexedDB write failed — silently ignore
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
  }

  /** Load draft content if newer than server version */
  async function loadDraftContent(): Promise<string | null> {
    const draft = await getDraft(documentId);
    if (!draft) return null;
    return draft.content;
  }

  return { isDirty, draftExists, lastSavedAt, clearDraft, loadDraftContent };
}
