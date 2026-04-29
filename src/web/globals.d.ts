declare global {
  interface Window {
    _pensRegistered?: boolean;
    /** Lobe Editor playground debug hook (same as upstream demo). */
    editor?: import("@lobehub/editor").IEditor;
    __scrollIntoView?: typeof import("@lobehub/editor").scrollIntoView;
  }
}

export {};
