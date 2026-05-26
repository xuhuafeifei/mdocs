import path from "node:path";

/**
 * `@lobehub/editor` pulls CJS deps (e.g. eventemitter3) that need Vite dep pre-bundle interop —
 * do not `optimizeDeps.exclude` it or you get missing default exports in the browser.
 * After edits to file:../my-lobe-editor, run `pnpm dev:web:fresh` once (or rm node_modules/.vite).
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(__dirname, "src/web"),
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/web"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  optimizeDeps: {
    include: [
      "@lobehub/ui",
      "motion",
      "lucide-react",
      "react-router-dom",
    ],
    // Note: do NOT exclude @lobehub/editor — it pulls CJS deps (e.g. eventemitter3)
    // that need Vite dep pre-bundle interop (see comment at top of this file).
  },
});
