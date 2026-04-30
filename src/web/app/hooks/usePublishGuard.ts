import { useEffect } from "react";

interface UsePublishGuardOptions {
  isDirty: boolean;
  draftExists: boolean;
}

/**
 * Block tab close / refresh only when changes exist
 * that are NOT yet persisted to IndexedDB (no draft).
 */
export function usePublishGuard({ isDirty, draftExists }: UsePublishGuardOptions) {
  const shouldBlock = isDirty && !draftExists;

  useEffect(() => {
    if (!shouldBlock) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);
}
