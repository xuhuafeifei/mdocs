import { initializeShapeLibrary } from "../diagram/registerPens";

let ready = false;

export function ensureMeta2Shapes(): void {
  if (ready) return;
  try {
    initializeShapeLibrary();
  } catch {
    // Most often HMR / double-mount; treat as already registered.
  }
  ready = true;
}

