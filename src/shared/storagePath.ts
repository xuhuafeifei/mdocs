/**
 * Storage path normalisation (shared by server and web).
 * Persisted `relative_path` uses slugged segments; human-facing labels use `display_name` / UI copy.
 */

import { DocPathError } from "./docPath.js";

const DISPLAY_FOLDER_MAX = 120;
const DISPLAY_FILE_MAX = 200;

/**
 * One path segment (directory name or `.md` filename stem) safe for storage / RELATIVE_PATH_RX.
 */
export function normalisePathSegmentForStorage(raw: string): string {
  let t = raw.trim().replace(/\s+/g, "_");
  t = t.replace(/[^A-Za-z0-9_\-\.\u4e00-\u9fa5]/g, "_");
  t = t.replace(/_+/g, "_");
  t = t.replace(/^[._]+|[._]+$/g, "");
  while (t.includes("..")) {
    t = t.replace(/\.\./g, "_");
  }
  if (t === "." || t === ".." || !t) return "";
  return t;
}

/** Validate a single folder label (display); storage path uses {@link normalisePathSegmentForStorage}. */
export function parseDisplayNameFolder(raw: string): { ok: true; display: string } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: false, message: "enter a folder name" };
  if (t.includes("/") || t.includes("\\")) return { ok: false, message: "use a single name, not a path" };
  if (t === "." || t === "..") return { ok: false, message: "invalid folder name" };
  if (t.length > DISPLAY_FOLDER_MAX) return { ok: false, message: "folder name is too long" };
  return { ok: true, display: t };
}

/**
 * Validate a markdown filename the user typed (one segment, may omit `.md` before normalise elsewhere).
 * Returns trimmed display filename ending with `.md`.
 */
export function parseDisplayNameMarkdownFile(raw: string): { ok: true; displayFile: string } | { ok: false; message: string } {
  let t = raw.trim();
  if (!t) return { ok: false, message: "enter a file name" };
  if (t.includes("/") || t.includes("\\")) return { ok: false, message: "use a file name, not a path" };
  if (t === "." || t === "..") return { ok: false, message: "invalid file name" };
  if (!t.toLowerCase().endsWith(".md")) t += ".md";
  if (t.length > DISPLAY_FILE_MAX) return { ok: false, message: "file name is too long" };
  return { ok: true, displayFile: t };
}

/**
 * Normalise every `/`-separated segment for storage (dirs + final `.md` stem).
 * Last segment must end with `.md`; extension casing preserved as input segment.
 */
export function normaliseRelativePathForStorage(raw: string): string {
  const t = raw.trim().replace(/\\/g, "/");
  if (!t) throw new DocPathError("relative path is required");
  if (t.startsWith("/")) throw new DocPathError("path must be relative");
  if (t.includes("..")) throw new DocPathError("path must not contain ..");
  const parts = t.split("/").filter((p) => p.length > 0);
  if (parts.length === 0) throw new DocPathError("relative path is required");
  const out: string[] = [];
  for (let i = 0; i < parts.length - 1; i += 1) {
    const s = normalisePathSegmentForStorage(parts[i]!);
    if (!s) throw new DocPathError("invalid path segment");
    out.push(s);
  }
  const last = parts[parts.length - 1]!;
  if (!last.toLowerCase().endsWith(".md")) {
    throw new DocPathError("document path must end with .md");
  }
  const stem = last.slice(0, -3);
  const suffix = last.slice(-3);
  const ns = normalisePathSegmentForStorage(stem);
  if (!ns) throw new DocPathError("invalid file name");
  out.push(ns + suffix);
  return out.join("/");
}
