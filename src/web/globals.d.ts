import type Vditor from "vditor";

declare global {
  interface Window {
    activeEditor: Vditor | undefined;
  }
}

export {};
