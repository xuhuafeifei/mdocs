/**
 * Thin chunk boundary for version-history compare.
 * Lazy-load this file (not the bare package) so Vite keeps a stable module URL
 * across optimizeDeps rewrites; the package itself is in optimizeDeps.include.
 */
export { LexicalDiff as default } from "@lobehub/editor/renderer";
