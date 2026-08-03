import path from "node:path";
import { createRequire } from "node:module";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const shikiPkg = path.dirname(require.resolve("shiki/package.json"));

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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@lobehub/editor") || id.includes("lexical")) {
            return "editor";
          }
          if (id.includes("@lobehub/ui") || id.includes("antd") || id.includes("antd-style")) {
            return "ui";
          }
          if (id.includes("mermaid") || id.includes("cytoscape") || id.includes("@braintree")) {
            return "diagram";
          }
          if (id.includes("motion") || id.includes("framer-motion")) {
            return "motion";
          }
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("react-router") ||
            id.includes("scheduler")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: "@shared", replacement: path.resolve(__dirname, "src/shared") },
      { find: "@shiki", replacement: path.resolve(__dirname, "src/web/shiki/index.ts") },
      { find: "shiki/themes", replacement: path.join(shikiPkg, "dist/themes.mjs") },
      { find: "shiki/engine/oniguruma", replacement: path.join(shikiPkg, "dist/engine-oniguruma.mjs") },
      { find: "shiki/core", replacement: path.join(shikiPkg, "dist/core.mjs") },
      { find: "shiki/engine/javascript", replacement: path.join(shikiPkg, "dist/engine-javascript.mjs") },
      { find: "shiki/wasm", replacement: path.join(shikiPkg, "dist/wasm.mjs") },
      // Exact `shiki` only — do not shadow `shiki/wasm`, `shiki/themes`, etc.
      { find: /^shiki$/, replacement: path.resolve(__dirname, "src/web/shiki/shiki-shim.ts") },
    ],
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
