import { useEffect, useRef } from "react";
import { listAllDrafts } from "../../storage/drafts";

/**
 * Periodic draft scanner inspired by Linux pdflush.
 *
 * Every 10 s, scans IndexedDB for drafts whose `published` is false
 * and `updatedAt` is older than 30 s (i.e. the user has stopped editing).
 * Publishes each stale draft via `onPublishDraft`.
 *
 * The caller (App.tsx) is responsible for implementing optimistic-lock
 * deletion inside `onPublishDraft` so that a draft modified concurrently
 * during the publish is not removed.
 */
export function useAutoPublish(
  enabled: boolean,
  onPublishDraft: (docId: string) => Promise<void>,
) {
  const onPublishDraftRef = useRef(onPublishDraft);
  onPublishDraftRef.current = onPublishDraft;

  useEffect(() => {
    if (!enabled) return;

    const STALE_MS = 30_000;
    const SCAN_MS = 10_000;

    const scan = async () => {
      const drafts = await listAllDrafts();
      const now = Date.now();

      for (const draft of drafts) {
        if (draft.published) continue;
        if (now - draft.updatedAt < STALE_MS) continue;

        try {
          await onPublishDraftRef.current(draft.documentId);
        } catch (err) {
          console.log("[autoPublish] scan publish failed:", err);
        }
      }
    };

    const interval = setInterval(scan, SCAN_MS);
    return () => clearInterval(interval);
  }, [enabled]);
}
