import type Vditor from "vditor";

declare global {
  interface Window {
    /** Set by DocumentEditor for `useFlowRenderer` (markdown-docs contract). */
    vditorInstance: Vditor | undefined;
    /** Shared with markdown-docs useFlowRenderer / Meta2d pen registration. */
    _pensRegistered?: boolean;
  }
}

export {};
