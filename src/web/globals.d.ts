import type Vditor from "vditor";

declare global {
  interface Window {
    /**
     * Single Vditor instance for the active document (markdown-docs: `useVditor` + `useFlowRenderer`).
     * mdocs: set in `DocumentEditor` `after` hook; read by `useDiagramPreview` / `useFlowRenderer`.
     */
    vditorInstance: Vditor | undefined;
    _pensRegistered?: boolean;
  }
}

export {};
